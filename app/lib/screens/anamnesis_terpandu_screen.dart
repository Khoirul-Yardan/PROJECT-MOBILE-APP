import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/supabase_service.dart';
import '../services/bpjs_service.dart';
import '../services/assemblyai_service.dart';
import '../services/web_hub_config.dart';

enum _Stage { intro, asking, recording, transcribing, confirm, drafting, review, denied }

class _Question {
  const _Question(this.field, this.text);
  final String field;
  final String text;
}

const _fieldLabels = <String, String>{
  'ringkasan': 'RINGKASAN',
  'keluhan_utama': 'KELUHAN UTAMA',
  'durasi_gejala': 'DURASI GEJALA',
  'lokasi_dan_berat': 'LOKASI & SKALA',
  'riwayat_kesehatan': 'RIWAYAT KESEHATAN',
  'riwayat_penyakit': 'RIWAYAT PENYAKIT',
  'alergi': 'ALERGI',
  'obat_rutin': 'OBAT RUTIN',
  'keluhan_lain': 'KELUHAN LAIN',
  'hasil_anamnesis': 'HASIL ANAMNESIS',
};

/// Standard anamnesis questions, read aloud one by one. The wording follows
/// the fields Bot BPJS already produces (keluhan utama, durasi gejala,
/// riwayat kesehatan), plus allergy/medication which a nurse always asks.
const _questions = <_Question>[
  _Question('keluhan_utama', 'Apa keluhan utama yang Anda rasakan saat ini?'),
  _Question('durasi_gejala', 'Sejak kapan keluhan itu mulai Anda rasakan?'),
  _Question('lokasi_dan_berat', 'Di bagian tubuh mana keluhan itu terasa, dan seberapa berat dari nol sampai sepuluh?'),
  _Question('riwayat_penyakit', 'Apakah Anda punya riwayat penyakit sebelumnya, misalnya darah tinggi, kencing manis, atau sakit jantung?'),
  _Question('alergi', 'Apakah Anda punya alergi terhadap obat atau makanan?'),
  _Question('obat_rutin', 'Obat apa yang sedang rutin Anda minum?'),
  _Question('keluhan_lain', 'Apakah ada keluhan lain yang ingin Anda sampaikan?'),
];

/// Guided anamnesis: the app asks (TTS), the patient answers by voice (STT),
/// the nurse can correct each answer, then the connected LLM turns the Q&A
/// into the same BPJS-shaped draft Bot BPJS produces. The session is stored
/// in the same tables, so it shows up in "Dokumentasi BPJS" for export.
///
/// Everything here is a DRAFT: the nurse reads and approves it. Speech
/// recognition in clinical documentation is faster but adds errors
/// (docs/REFERENSI-SUMBER-ILMIAH.md [4][5]), so each answer is shown and
/// editable before it is used.
class AnamnesisTerpanduScreen extends StatefulWidget {
  const AnamnesisTerpanduScreen({super.key});
  @override
  State<AnamnesisTerpanduScreen> createState() => _AnamnesisTerpanduScreenState();
}

class _AnamnesisTerpanduScreenState extends State<AnamnesisTerpanduScreen> {
  _Stage _stage = _Stage.intro;
  final AudioRecorder _recorder = AudioRecorder();
  final FlutterTts _tts = FlutterTts();
  bool _ttsReady = false;

  final _patientCtrl = TextEditingController();
  final _doctorCtrl = TextEditingController();
  final _answerCtrl = TextEditingController();

  int _index = 0;
  String? _recordingPath;
  Timer? _elapsedTimer;
  Duration _elapsed = Duration.zero;
  String? _errorMessage;
  final List<String> _answers = List.filled(_questions.length, '');
  // Audit trail for transparency: what the speech recognizer heard vs what
  // the nurse finally accepted, and whether the answer came by voice.
  final List<String> _rawStt = List.filled(_questions.length, '');
  final List<bool> _viaVoice = List.filled(_questions.length, false);
  String _pendingRaw = '';
  bool _pendingVoice = false;

  Map<String, dynamic> _draft = {};
  List<Map<String, String>> _segments = [];
  Map<String, dynamic> _metrics = {};
  String? _providerId;
  // Non-null while the last save to Dokumentasi failed; the review screen
  // shows it with a retry button instead of silently pretending it saved.
  String? _saveError;
  bool _saving = false;
  bool _docSaved = false;
  bool _transcriptFailed = false;
  String _draftNote = '';
  String? _sessionId;

  @override
  void initState() {
    super.initState();
    _initTts();
  }

  Future<void> _initTts() async {
    try {
      await _tts.setLanguage('id-ID');
      await _tts.setSpeechRate(0.45);
      await _tts.awaitSpeakCompletion(true);
      _ttsReady = true;
    } catch (_) {
      // No TTS engine: the question is still shown as text, nothing breaks.
      _ttsReady = false;
    }
  }

  @override
  void dispose() {
    _elapsedTimer?.cancel();
    _recorder.dispose();
    _tts.stop();
    _patientCtrl.dispose();
    _doctorCtrl.dispose();
    _answerCtrl.dispose();
    super.dispose();
  }

  Future<void> _speakQuestion() async {
    if (!_ttsReady) return;
    try {
      await _tts.stop();
      await _tts.speak(_questions[_index].text);
    } catch (_) {
      // Best-effort — the written question is always on screen.
    }
  }

  Future<void> _begin() async {
    if (_patientCtrl.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Isi kode/inisial pasien dulu.');
      return;
    }
    final hasPermission = await _recorder.hasPermission();
    if (!mounted) return;
    if (!hasPermission) {
      setState(() {
        _stage = _Stage.denied;
        _errorMessage = 'Izin mikrofon ditolak — aktifkan di pengaturan aplikasi lalu coba lagi.';
      });
      return;
    }
    _index = 0;
    for (var i = 0; i < _answers.length; i++) {
      _answers[i] = '';
      _rawStt[i] = '';
      _viaVoice[i] = false;
    }
    _pendingRaw = '';
    _pendingVoice = false;
    setState(() {
      _errorMessage = null;
      _stage = _Stage.asking;
    });
    unawaited(_speakQuestion());
  }

  Future<void> _startRecording() async {
    await _tts.stop();
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/anamnesis_${DateTime.now().millisecondsSinceEpoch}.m4a';
    try {
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.denied;
        _errorMessage = 'Gagal menyalakan perekam: $e';
      });
      return;
    }
    _recordingPath = path;
    _elapsed = Duration.zero;
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _elapsed += const Duration(seconds: 1));
    });
    if (!mounted) return;
    setState(() {
      _errorMessage = null;
      _stage = _Stage.recording;
    });
  }

  Future<void> _stopAndTranscribe() async {
    _elapsedTimer?.cancel();
    final stopped = await _recorder.stop();
    setState(() => _stage = _Stage.transcribing);
    final audioPath = stopped ?? _recordingPath;
    if (audioPath == null || !await File(audioPath).exists()) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Rekaman tidak ditemukan. Coba lagi.';
        _stage = _Stage.asking;
      });
      return;
    }
    try {
      final stt = await _transcribe(File(audioPath));
      _answerCtrl.text = stt.plainText.trim();
      _pendingRaw = stt.plainText.trim();
      _pendingVoice = true;
      if (!mounted) return;
      setState(() {
        _errorMessage = stt.plainText.trim().isEmpty ? 'Tidak ada ucapan terdengar. Ulangi atau ketik jawabannya.' : null;
        _stage = _Stage.confirm;
      });
    } catch (e) {
      if (!mounted) return;
      _answerCtrl.clear();
      _pendingRaw = '';
      _pendingVoice = false;
      setState(() {
        _errorMessage = e is _NoKey ? 'Butuh kunci API AssemblyAI untuk mengenali suara. Ketik jawabannya atau coba lagi.' : 'Pengenalan suara gagal: $e';
        _stage = _Stage.confirm;
      });
    } finally {
      try {
        await File(audioPath).delete();
      } catch (_) {
        // Best-effort cleanup of the temp recording.
      }
    }
  }

  /// Same key strategy as Bot BPJS: shared relay key first, personal key as
  /// the stored fallback.
  Future<SttResult> _transcribe(File file) async {
    try {
      return await AssemblyAiService.transcribeWithDiarization(file, relayBaseUrl: WebHubConfig.baseUrl);
    } on AssemblyAiRelayNotConfiguredException {
      final apiKey = await AssemblyAiConfigService.load();
      if (apiKey == null || apiKey.isEmpty) throw _NoKey();
      return AssemblyAiService.transcribeWithDiarization(file, apiKey: apiKey);
    }
  }

  void _acceptAnswer() {
    _answers[_index] = _answerCtrl.text.trim();
    _rawStt[_index] = _pendingRaw;
    _viaVoice[_index] = _pendingVoice;
    _pendingRaw = '';
    _pendingVoice = false;
    _next();
  }

  void _skip() {
    _answers[_index] = '';
    _rawStt[_index] = '';
    _viaVoice[_index] = false;
    _pendingRaw = '';
    _pendingVoice = false;
    _next();
  }

  void _next() {
    _answerCtrl.clear();
    if (_index + 1 >= _questions.length) {
      _buildDraft();
      return;
    }
    setState(() {
      _index++;
      _errorMessage = null;
      _stage = _Stage.asking;
    });
    unawaited(_speakQuestion());
  }

  Future<void> _buildDraft() async {
    setState(() {
      _stage = _Stage.drafting;
      _errorMessage = null;
    });
    final segments = <Map<String, String>>[];
    var offset = 0;
    for (var i = 0; i < _questions.length; i++) {
      if (_answers[i].isEmpty) continue;
      segments.add({'speaker': 'perawat', 'text': _questions[i].text, 'offset': '$offset'});
      segments.add({'speaker': 'pasien', 'text': _answers[i], 'offset': '${offset + 1}'});
      offset += 2;
    }
    if (segments.isEmpty) {
      setState(() {
        _errorMessage = 'Belum ada jawaban yang terekam.';
        _stage = _Stage.intro;
      });
      return;
    }
    final transcriptText = segments.map((s) => '${s['speaker']}: ${s['text']}').join('\n');

    await SupabaseService.logActivity(
      category: 'Bots',
      title: 'Anamnesis Terpandu — jawaban terkumpul',
      subtitle: 'Menyusun draf dokumentasi',
      badge: 'Info',
    );

    final sessionId = await BpjsSessionRepo.createSession(
      dokterNama: _doctorCtrl.text.trim().isEmpty ? 'Belum ditentukan' : _doctorCtrl.text.trim(),
      pasienNama: _patientCtrl.text.trim(),
    );
    if (!mounted) return;
    if (sessionId == null) {
      setState(() {
        _errorMessage = BpjsSessionRepo.lastError ?? 'Gagal membuat sesi — periksa koneksi internet dan coba lagi.';
        _stage = _Stage.intro;
      });
      return;
    }
    _sessionId = sessionId;
    _segments = segments;
    final transcriptErr = await BpjsSessionRepo.replaceTranscript(sessionId, segments);

    final credential = await BpjsAiService.firstAvailableCredential();
    Map<String, dynamic>? generated;
    if (credential != null) {
      generated = await BpjsAiService.generateDocumentation(credential: credential, transcriptText: transcriptText);
    }
    if (generated != null) {
      _draft = generated;
      _draftNote = '';
    } else {
      // No AI or it failed: fall back to the answers themselves, field by
      // field, so the nurse still gets a usable form instead of nothing.
      _draft = {
        for (var i = 0; i < _questions.length; i++)
          if (_answers[i].isNotEmpty) _questions[i].field: _answers[i],
      };
      _draftNote = credential == null
          ? 'Belum ada provider AI terhubung (Pengaturan → API & Agent) — ini jawaban mentah per pertanyaan.'
          : 'AI tidak merespons — ini jawaban mentah per pertanyaan.';
    }

    _metrics = _buildMetrics(credential?.label, generated != null);
    _providerId = generated != null ? credential?.id : null;
    _transcriptFailed = transcriptErr != null;
    _saveError = transcriptErr;
    await _persist();
    await SupabaseService.logActivity(
      category: 'Bots',
      title: 'Anamnesis Terpandu — draf siap ditinjau',
      subtitle: 'Tersimpan di Dokumentasi BPJS',
      badge: 'Success',
    );
    if (!mounted) return;
    setState(() => _stage = _Stage.review);
  }

  Future<void> _persist() async {
    final sessionId = _sessionId;
    if (sessionId == null) return;
    if (mounted) setState(() => _saving = true);
    final errors = <String>[];
    if (_transcriptFailed) {
      final e = await BpjsSessionRepo.replaceTranscript(sessionId, _segments);
      if (e == null) {
        _transcriptFailed = false;
      } else {
        errors.add(e);
      }
    }
    if (!_docSaved) {
      final e = await BpjsSessionRepo.saveDocumentation(
        sessionId: sessionId,
        structured: _draft,
        alurPercakapan: _segments,
        providerId: _providerId,
        perbandingan: _metrics,
      );
      if (e == null) {
        _docSaved = true;
      } else {
        errors.add(e);
      }
    }
    if (errors.isEmpty) {
      final e = await BpjsSessionRepo.markStatus(sessionId, 'siap_dikirim');
      if (e != null) errors.add(e);
    }
    _saveError = errors.isEmpty ? null : errors.join('\n');
    if (mounted) setState(() => _saving = false);
  }

  /// Stored in bpjs_documents.perbandingan. `sumber` is what the web history
  /// uses to tell this apart from a Bot BPJS recording; `audit_jawaban` keeps
  /// the raw speech-recognition text next to the accepted answer so a reader
  /// can see exactly what the nurse changed.
  Map<String, dynamic> _buildMetrics(String? providerLabel, bool llmOk) {
    var answered = 0, voice = 0, typed = 0, corrected = 0;
    final audit = <Map<String, dynamic>>[];
    for (var i = 0; i < _questions.length; i++) {
      final fin = _answers[i];
      if (fin.isNotEmpty) {
        answered++;
        _viaVoice[i] ? voice++ : typed++;
      }
      final changed = _viaVoice[i] && fin.isNotEmpty && fin != _rawStt[i];
      if (changed) corrected++;
      audit.add({
        'pertanyaan': _questions[i].text,
        'via': fin.isEmpty ? 'dilewati' : (_viaVoice[i] ? 'suara' : 'ketik'),
        'stt_mentah': _rawStt[i],
        'final': fin,
        'dikoreksi': changed,
      });
    }
    return {
      'sumber': 'anamnesis_terpandu',
      'pertanyaan_total': _questions.length,
      'pertanyaan_dijawab': answered,
      'jawaban_suara': voice,
      'jawaban_diketik': typed,
      'jawaban_dikoreksi': corrected,
      'llm_provider': providerLabel,
      'llm_berhasil': llmOk,
      'audit_jawaban': audit,
    };
  }

  String get _draftText {
    final buf = StringBuffer()
      ..writeln('ANAMNESIS TERPANDU (DRAF - PERLU DISETUJUI PERAWAT)')
      ..writeln('Pasien: ${_patientCtrl.text.trim()}')
      ..writeln();
    _draft.forEach((k, v) {
      buf
        ..writeln(k.replaceAll('_', ' ').toUpperCase())
        ..writeln('$v')
        ..writeln();
    });
    return buf.toString();
  }

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _draftText));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Draf disalin')));
  }

  void _reset() {
    _patientCtrl.clear();
    _doctorCtrl.clear();
    _answerCtrl.clear();
    setState(() {
      _index = 0;
      _draft = {};
      _sessionId = null;
      _saveError = null;
      _docSaved = false;
      _transcriptFailed = false;
      _errorMessage = null;
      _stage = _Stage.intro;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Anamnesis Terpandu')),
    body: SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: _body()),
      ),
    ),
  );

  List<Widget> _body() => switch (_stage) {
    _Stage.intro || _Stage.denied => _introBody(),
    _Stage.review => _reviewBody(),
    _Stage.drafting => [
      const SizedBox(height: 80),
      const Center(child: CircularProgressIndicator()),
      const SizedBox(height: 16),
      const Center(child: Text('Menyusun draf anamnesis...', style: TextStyle(color: AppColors.textMuted))),
    ],
    _ => _questionBody(),
  };

  Widget _error() => _errorMessage == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(_errorMessage!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
        );

  List<Widget> _introBody() => [
    const SizedBox(height: 16),
    HubCard(
      fill: AppColors.butter,
      child: const Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ASISTEN ANAMNESIS', style: TextStyle(fontSize: 10, letterSpacing: 1.4)),
                SizedBox(height: 10),
                Text('Anamnesis Terpandu', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                SizedBox(height: 6),
                Text(
                  'Aplikasi membacakan $_questionsCount pertanyaan standar, pasien menjawab dengan suara, lalu jawaban disusun menjadi draf form.',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          SizedBox(width: 12),
          Icon(Icons.record_voice_over_outlined, size: 44, color: AppColors.accentInk),
        ],
      ),
    ),
    const SizedBox(height: 20),
    TextField(
      controller: _patientCtrl,
      textCapitalization: TextCapitalization.words,
      decoration: const InputDecoration(labelText: 'Kode / inisial pasien', hintText: 'Jangan tulis nama lengkap'),
    ),
    const SizedBox(height: 12),
    TextField(
      controller: _doctorCtrl,
      textCapitalization: TextCapitalization.words,
      decoration: const InputDecoration(labelText: 'Dokter tujuan (opsional)'),
    ),
    _error(),
    const SizedBox(height: 20),
    FilledButton.icon(
      onPressed: _begin,
      icon: const Icon(Icons.play_arrow),
      label: const Text('Mulai anamnesis'),
    ),
    const SizedBox(height: 16),
    const Text(
      'Hasilnya berupa DRAF. Perawat wajib memeriksa dan menyetujuinya; jangan dipakai sebagai dasar tindakan tanpa verifikasi.',
      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
    ),
  ];

  static const _questionsCount = 7;

  List<Widget> _questionBody() {
    final q = _questions[_index];
    final progress = (_index + 1) / _questions.length;
    return [
      const SizedBox(height: 12),
      LinearProgressIndicator(value: progress, minHeight: 6, color: AppColors.accent, backgroundColor: AppColors.surfaceSunken),
      const SizedBox(height: 6),
      Text('Pertanyaan ${_index + 1} dari ${_questions.length}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
      const SizedBox(height: 14),
      HubCard(
        fill: AppColors.mint,
        child: Text(q.text, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, height: 1.4)),
      ),
      const SizedBox(height: 10),
      if (_stage == _Stage.asking)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: _speakQuestion,
            icon: const Icon(Icons.volume_up_outlined),
            label: Text(_ttsReady ? 'Ulangi pertanyaan' : 'Suara tidak tersedia'),
          ),
        ),
      _error(),
      const SizedBox(height: 16),
      ..._stageControls(),
    ];
  }

  List<Widget> _stageControls() {
    switch (_stage) {
      case _Stage.asking:
        return [
          Center(
            child: GestureDetector(
              onTap: _startRecording,
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.lineStrong, width: 1.5),
                ),
                child: const Icon(Icons.mic, size: 52, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Center(child: Text('Ketuk untuk menjawab', style: TextStyle(color: AppColors.textMuted))),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    _answerCtrl.clear();
                    _pendingRaw = '';
                    _pendingVoice = false;
                    setState(() => _stage = _Stage.confirm);
                  },
                  child: const Text('Ketik jawaban'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: OutlinedButton(onPressed: _skip, child: const Text('Lewati'))),
            ],
          ),
        ];
      case _Stage.recording:
        final mm = _elapsed.inMinutes.toString().padLeft(2, '0');
        final ss = (_elapsed.inSeconds % 60).toString().padLeft(2, '0');
        return [
          Center(
            child: GestureDetector(
              onTap: _stopAndTranscribe,
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  color: AppColors.danger,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.lineStrong, width: 1.5),
                ),
                child: const Icon(Icons.stop, size: 52, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Center(child: Text('Merekam $mm:$ss — ketuk untuk selesai', style: const TextStyle(color: AppColors.textMuted))),
        ];
      case _Stage.transcribing:
        return [
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 10),
          const Center(child: Text('Mengenali suara...', style: TextStyle(color: AppColors.textMuted))),
        ];
      case _Stage.confirm:
        return [
          const Text('Jawaban (periksa dan perbaiki bila salah dengar):', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          const SizedBox(height: 6),
          TextField(controller: _answerCtrl, maxLines: 5, minLines: 3, decoration: const InputDecoration(hintText: 'Jawaban pasien')),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() {
                    _errorMessage = null;
                    _stage = _Stage.asking;
                  }),
                  icon: const Icon(Icons.mic),
                  label: const Text('Rekam ulang'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _acceptAnswer,
                  child: Text(_index + 1 >= _questions.length ? 'Selesai' : 'Lanjut'),
                ),
              ),
            ],
          ),
        ];
      default:
        return const [];
    }
  }

  List<Widget> _reviewBody() => [
    const SizedBox(height: 12),
    HubCard(
      fill: AppColors.butter,
      child: const Text(
        'DRAF — perlu diperiksa dan disetujui perawat sebelum dipakai.',
        style: TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    if (_draftNote.isNotEmpty) ...[
      const SizedBox(height: 8),
      Text(_draftNote, style: const TextStyle(fontSize: 12, color: AppColors.danger)),
    ],
    const SizedBox(height: 12),
    if (_saveError != null)
      HubCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Belum tersimpan ke Dokumentasi', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.danger)),
            const SizedBox(height: 4),
            Text(_saveError!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _saving ? null : _persist,
              icon: _saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.refresh),
              label: const Text('Simpan ulang'),
            ),
          ],
        ),
      )
    else
      const HubCard(
        fill: AppColors.mint,
        child: Row(children: [
          Icon(Icons.check_circle_outline, size: 20),
          SizedBox(width: 8),
          Expanded(child: Text('Tersimpan di Dokumentasi (menu Dokumentasi, filter Anamnesis).', style: TextStyle(fontSize: 13))),
        ]),
      ),
    const SizedBox(height: 14),
    for (final e in _draft.entries.where((e) => '${e.value}'.trim().isNotEmpty)) ...[
      HubCard(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _fieldLabels[e.key] ?? e.key.replaceAll('_', ' ').toUpperCase(),
              style: const TextStyle(fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w700, color: AppColors.textMuted),
            ),
            const SizedBox(height: 6),
            SelectableText('${e.value}', style: const TextStyle(fontSize: 15, height: 1.4)),
          ],
        ),
      ),
      const SizedBox(height: 10),
    ],
    FilledButton.icon(onPressed: _copy, icon: const Icon(Icons.copy), label: const Text('Salin draf')),
    const SizedBox(height: 10),
    OutlinedButton(onPressed: _reset, child: const Text('Anamnesis baru')),
  ];
}

class _NoKey implements Exception {}
