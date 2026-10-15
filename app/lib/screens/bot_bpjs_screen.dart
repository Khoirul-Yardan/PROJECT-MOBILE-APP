import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/supabase_service.dart';
import '../services/bpjs_service.dart';
import '../services/assemblyai_service.dart';
import '../services/web_hub_config.dart';

enum _Stage { idle, listening, recording, processing, review, denied }

/// The nurse backed out of the personal-key dialog (only reachable when
/// this deployment has no shared relay key) — not a real failure, just
/// "stop and let the idle-state UI explain why."
class _CancelledException implements Exception {}

class BotBpjsScreen extends StatefulWidget {
  const BotBpjsScreen({super.key});
  @override
  State<BotBpjsScreen> createState() => _BotBpjsScreenState();
}

class _BotBpjsScreenState extends State<BotBpjsScreen> {
  _Stage _stage = _Stage.idle;
  final AudioRecorder _recorder = AudioRecorder();
  String? _recordingPath;
  Timer? _elapsedTimer;
  Duration _elapsed = Duration.zero;

  String? _doctorName;
  String? _doctorInstansi;
  String? _patientName;
  DateTime? _sessionCreatedAt;
  String? _sessionId;
  final List<Map<String, String>> _segments = []; // {speaker, text}
  String? _providerLabel;
  Map<String, dynamic>? _metrics;
  bool _relabeledByLlm = false;
  int _view = 0; // 0 = hasil STT, 1 = ringkasan AI, 2 = perbandingan
  String? _errorMessage;
  String? _processingNote;
  bool _exporting = false;
  final Map<String, TextEditingController> _draftControllers = {};

  /// The draft as currently edited in the review screen — export/copy reads
  /// this instead of `_draft` directly, so a nurse's corrections are what
  /// actually gets sent, not the AI's first pass.
  Map<String, dynamic> get _editedDraft => {
    for (final entry in _draftControllers.entries) entry.key: entry.value.text,
  };

  @override
  void dispose() {
    _elapsedTimer?.cancel();
    _recorder.dispose();
    for (final c in _draftControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _startSession() async {
    setState(() {
      _stage = _Stage.listening;
      _errorMessage = null;
    });
    // Check mic permission before asking for patient/doctor info — no point
    // collecting that data just to hit a permission wall afterward.
    final hasPermission = await _recorder.hasPermission();
    if (!mounted) return;
    if (!hasPermission) {
      setState(() {
        _stage = _Stage.denied;
        _errorMessage = 'Izin mikrofon ditolak — aktifkan di pengaturan aplikasi lalu coba lagi.';
      });
      return;
    }
    // Ask who the patient is, and who the session is for, before recording
    // starts — no doctor account/friendship to look up anymore: the
    // target doctor is just a typed name (+ instansi), same as filling in
    // a referral form by hand.
    final patientName = await _askPatientName();
    if (!mounted) return;
    if (patientName == null || patientName.trim().isEmpty) {
      setState(() => _stage = _Stage.idle);
      return;
    }
    final doctorInfo = await _askDoctorInfo();
    if (!mounted) return;
    if (doctorInfo == null || (doctorInfo['nama'] ?? '').trim().isEmpty) {
      setState(() => _stage = _Stage.idle);
      return;
    }
    _patientName = patientName.trim();
    _doctorName = doctorInfo['nama']!.trim();
    _doctorInstansi = doctorInfo['instansi']?.trim();

    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/bpjs_session_${DateTime.now().millisecondsSinceEpoch}.m4a';
    try {
      // AAC/m4a: good enough quality for speech, far smaller upload than
      // raw WAV — AssemblyAI accepts it directly, no transcoding needed.
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.denied;
        _errorMessage = 'Gagal menyalakan perekam: $e';
      });
      return;
    }
    if (!mounted) return;
    _recordingPath = path;
    _segments.clear();
    _elapsed = Duration.zero;
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _elapsed += const Duration(seconds: 1));
    });
    setState(() => _stage = _Stage.recording);
  }

  Future<String?> _askPatientName() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nama pasien'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'mis. Budi Santoso'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, null),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Lanjut'),
          ),
        ],
      ),
    );
  }

  Future<Map<String, String>?> _askDoctorInfo() {
    final namaController = TextEditingController();
    final instansiController = TextEditingController();
    return showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Dokumentasi untuk dokter siapa?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: namaController,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Nama dokter',
                hintText: 'mis. dr. Budi Hartono',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: instansiController,
              decoration: const InputDecoration(
                labelText: 'Instansi / RS (opsional)',
                hintText: 'mis. RS Ahmad Yani Surabaya',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, null),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, {
              'nama': namaController.text,
              'instansi': instansiController.text,
            }),
            child: const Text('Mulai Rekam'),
          ),
        ],
      ),
    );
  }

  /// Fallback only — only shown when this deployment has no shared relay
  /// key (see _transcribeWithFallback). AssemblyAI does the actual speaker
  /// diarization (see assemblyai_service.dart for why on-device STT alone
  /// can't). Stored in Keystore/Keychain so it only needs to be entered
  /// once per device.
  Future<String?> _askAssemblyAiKey() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Kunci API AssemblyAI'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Dipakai untuk memisahkan suara perawat dan pasien secara akurat. '
              'Daftar gratis di assemblyai.com, salin API key dari dashboard.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              autofocus: true,
              obscureText: true,
              decoration: const InputDecoration(hintText: 'Tempel API key di sini'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, null),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  /// Tries the shared relay key first (see web/relay/server.js +
  /// docs/ASSEMBLYAI-DIARIZATION.md) — most deployments configure this, so
  /// most nurses never see a key prompt at all. Only falls back to asking
  /// for (and remembering) a personal AssemblyAI key when this specific
  /// deployment hasn't set a shared one.
  Future<SttResult> _transcribeWithFallback(File audioFile) async {
    try {
      return await AssemblyAiService.transcribeWithDiarization(
        audioFile,
        relayBaseUrl: WebHubConfig.baseUrl,
      );
    } on AssemblyAiRelayNotConfiguredException {
      var apiKey = await AssemblyAiConfigService.load();
      if (apiKey == null || apiKey.isEmpty) {
        if (!mounted) throw _CancelledException();
        apiKey = await _askAssemblyAiKey();
        if (apiKey == null || apiKey.isEmpty) throw _CancelledException();
        await AssemblyAiConfigService.save(apiKey);
      }
      return AssemblyAiService.transcribeWithDiarization(audioFile, apiKey: apiKey);
    }
  }

  Future<void> _stopAndProcess() async {
    _elapsedTimer?.cancel();
    final path = await _recorder.stop();
    setState(() {
      _stage = _Stage.processing;
      _errorMessage = null;
      _processingNote = 'Memisahkan suara perawat dan pasien...';
    });

    final audioPath = path ?? _recordingPath;
    if (audioPath == null || !await File(audioPath).exists()) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Rekaman tidak ditemukan. Coba lagi.';
        _stage = _Stage.idle;
      });
      return;
    }

    SttResult stt;
    try {
      stt = await _transcribeWithFallback(File(audioPath));
    } on _CancelledException {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Butuh kunci API AssemblyAI untuk memproses rekaman. Coba lagi.';
        _stage = _Stage.idle;
      });
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Diarization gagal: $e';
        _stage = _Stage.idle;
      });
      return;
    } finally {
      try {
        await File(audioPath).delete();
      } catch (_) {
        // Best-effort cleanup — a leftover temp file isn't worth failing over.
      }
    }
    _relabeledByLlm = false;
    _segments
      ..clear()
      ..addAll(stt.segments.map((d) => {'speaker': d.speaker, 'text': d.text, 'offset': '${d.offsetMs}'}));

    if (_segments.isEmpty) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Tidak ada ucapan yang terekam. Coba lagi.';
        _stage = _Stage.idle;
      });
      return;
    }

    if (mounted) setState(() => _processingNote = 'Menyusun draf dokumentasi...');

    await SupabaseService.logActivity(
      category: 'Bots',
      title: 'Bot BPJS — sesi direkam',
      subtitle: 'Menyusun dokumentasi sesuai form BPJS',
      badge: 'Info',
    );

    final createdAt = DateTime.now();
    final sessionId = await BpjsSessionRepo.createSession(
      dokterNama: _doctorName ?? 'Dokter',
      dokterInstansi: _doctorInstansi,
      pasienNama: _patientName ?? 'Pasien',
    );
    if (!mounted) return;
    if (sessionId == null) {
      setState(() {
        _errorMessage = 'Gagal membuat sesi — periksa koneksi internet dan coba lagi.';
        _stage = _Stage.idle;
      });
      return;
    }
    _sessionId = sessionId;
    _sessionCreatedAt = createdAt;

    final credential = await BpjsAiService.firstAvailableCredential();

    // AssemblyAI sometimes hears one voice on a single phone mic, which
    // used to leave every line tagged 'perawat'. Repair that case with the
    // connected LLM (it only sees text, so it judges by who asks vs
    // answers) — and say so in the metrics so the comparison stays honest.
    if (stt.speakersDetected < 2 && credential != null) {
      if (mounted) setState(() => _processingNote = 'Suara terdeteksi satu orang — memisahkan peran dengan AI...');
      final pieces = AssemblyAiService.splitIntoSentences(stt.segments);
      final labels = await BpjsAiService.relabelSpeakers(
        credential: credential,
        sentences: pieces.map((p) => p.text).toList(),
      );
      if (labels != null) {
        _segments
          ..clear()
          ..addAll([
            for (var i = 0; i < pieces.length; i++)
              {'speaker': labels[i], 'text': pieces[i].text, 'offset': '${pieces[i].offsetMs}'},
          ]);
        _relabeledByLlm = true;
      }
    }
    if (mounted) setState(() => _processingNote = 'Menyusun draf dokumentasi...');

    await BpjsSessionRepo.replaceTranscript(sessionId, _segments);

    final transcriptText = _segments.map((s) => '${s['speaker']}: ${s['text']}').join('\n');
    final llmWatch = Stopwatch()..start();
    Map<String, dynamic> draft;
    if (credential != null) {
      final generated = await BpjsAiService.generateDocumentation(
        credential: credential,
        transcriptText: transcriptText,
      );
      draft = generated ??
          {
            'ringkasan': _segments.map((s) => s['text']).join(' '),
            'catatan':
                'AI tidak merespons — ringkasan ini adalah transkrip mentah, perlu disusun manual oleh perawat.',
          };
      _providerLabel = credential.label;
    } else {
      draft = {
        'ringkasan': _segments.map((s) => s['text']).join(' '),
        'catatan':
            'Belum ada provider/agent AI terhubung (Pengaturan → API & Agent) — ringkasan ini adalah transkrip mentah.',
      };
      _providerLabel = null;
    }
    llmWatch.stop();
    _metrics = _buildMetrics(stt, draft, llmWatch.elapsedMilliseconds, aiUsed: credential != null && !draft.containsKey('catatan'));
    for (final c in _draftControllers.values) {
      c.dispose();
    }
    _draftControllers
      ..clear()
      ..addEntries(draft.entries.map((e) => MapEntry(e.key, TextEditingController(text: '${e.value}'))));

    await BpjsSessionRepo.saveDocumentation(
      sessionId: sessionId,
      structured: draft,
      alurPercakapan: _segments,
      providerId: credential?.id,
      perbandingan: _metrics,
    );
    await BpjsSessionRepo.markStatus(sessionId, 'siap_dikirim');

    if (!mounted) return;
    setState(() => _stage = _Stage.review);
    await SupabaseService.logActivity(
      category: 'Bots',
      title: 'Draf dokumentasi siap untuk $_doctorName',
      subtitle: 'Siap disalin atau diekspor PDF/DOCX',
      badge: 'Success',
    );
  }

  static int _wordCount(String t) => t.trim().isEmpty ? 0 : t.trim().split(RegExp(r'\s+')).length;

  /// Numbers for the "STT mentah vs ringkasan LLM" comparison. The STT side
  /// counts what the nurse would otherwise have to read; the LLM side only
  /// counts the AI's own fields (not the fallback note), so the ratio is a
  /// fair "how much shorter is the summary" figure.
  Map<String, dynamic> _buildMetrics(SttResult stt, Map<String, dynamic> draft, int llmMs, {required bool aiUsed}) {
    final sttWords = _wordCount(_segments.map((s) => s['text']).join(' '));
    final llmWords = _wordCount(draft.entries.where((e) => e.key != 'catatan').map((e) => '${e.value}').join(' '));
    return {
      'durasi_audio_ms': stt.audioDurationMs,
      'stt_waktu_ms': stt.processingMs,
      'stt_kata': sttWords,
      'stt_segmen': _segments.length,
      'pembicara_terdeteksi': stt.speakersDetected,
      'relabel_llm': _relabeledByLlm,
      'llm_provider': aiUsed ? _providerLabel : null,
      'llm_waktu_ms': llmMs,
      'llm_kata': llmWords,
      'rasio_ringkas': sttWords == 0 ? '-' : '${(llmWords / sttWords * 100).toStringAsFixed(0)}%',
      'llm_berhasil': aiUsed,
    };
  }

  /// Flips perawat<->pasien across the whole transcript. The "first voice =
  /// nurse" rule is a heuristic; when the patient happened to speak first
  /// this is the one-tap fix, and it is persisted so history matches.
  Future<void> _swapSpeakers() async {
    setState(() {
      for (final s in _segments) {
        s['speaker'] = s['speaker'] == 'perawat' ? 'pasien' : 'perawat';
      }
    });
    if (_sessionId != null) await BpjsSessionRepo.replaceTranscript(_sessionId!, _segments);
  }

  Future<void> _copyText() async {
    final text = BpjsExport.plainText(
      dokterNama: _doctorName ?? 'Dokter',
      dokterInstansi: _doctorInstansi,
      pasienNama: _patientName ?? 'Pasien',
      createdAt: _sessionCreatedAt ?? DateTime.now(),
      structured: _editedDraft,
      transcript: _segments,
      comparison: _metrics,
    );
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    await _markSentAndNotify('Teks disalin — siap ditempel ke WhatsApp/Email.');
  }

  Future<void> _exportAs(String format) async {
    setState(() => _exporting = true);
    try {
      final createdAt = _sessionCreatedAt ?? DateTime.now();
      final safeName = (_patientName ?? 'pasien').replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '_');
      if (format == 'pdf') {
        final bytes = await BpjsExport.buildPdf(
          dokterNama: _doctorName ?? 'Dokter',
          dokterInstansi: _doctorInstansi,
          pasienNama: _patientName ?? 'Pasien',
          createdAt: createdAt,
          structured: _editedDraft,
          transcript: _segments,
          comparison: _metrics,
        );
        await BpjsExport.shareFile(
          bytes: bytes,
          filename: 'dokumentasi_bpjs_$safeName.pdf',
          mimeSubject: 'Dokumentasi BPJS — $_patientName',
        );
      } else {
        final bytes = await BpjsExport.buildDocx(
          dokterNama: _doctorName ?? 'Dokter',
          dokterInstansi: _doctorInstansi,
          pasienNama: _patientName ?? 'Pasien',
          createdAt: createdAt,
          structured: _editedDraft,
          transcript: _segments,
          comparison: _metrics,
        );
        await BpjsExport.shareFile(
          bytes: bytes,
          filename: 'dokumentasi_bpjs_$safeName.docx',
          mimeSubject: 'Dokumentasi BPJS — $_patientName',
        );
      }
      if (!mounted) return;
      await _markSentAndNotify('File ${format.toUpperCase()} siap dibagikan.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = 'Gagal membuat file: $e');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _markSentAndNotify(String message) async {
    if (_sessionId != null) {
      await BpjsSessionRepo.markStatus(_sessionId!, 'terkirim');
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  void _reset() => setState(() {
    _stage = _Stage.idle;
    _doctorName = null;
    _doctorInstansi = null;
    _patientName = null;
    _sessionId = null;
    _sessionCreatedAt = null;
    _recordingPath = null;
    _elapsed = Duration.zero;
    _segments.clear();
    for (final c in _draftControllers.values) {
      c.dispose();
    }
    _draftControllers.clear();
    _errorMessage = null;
    _processingNote = null;
    _metrics = null;
    _relabeledByLlm = false;
    _view = 0;
  });

  String get _elapsedLabel {
    final m = _elapsed.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = _elapsed.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Bot BPJS')),
    body: SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_stage != _Stage.review) ...[
              const SizedBox(height: 16),
              HubCard(
                fill: AppColors.mint,
                child: const Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('ASISTEN DOKUMENTASI', style: TextStyle(fontSize: 10, letterSpacing: 1.4)),
                          SizedBox(height: 10),
                          Text('Bot BPJS', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
                          SizedBox(height: 6),
                          Text('Nyalakan mikrofon untuk mulai mendokumentasikan sesi', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                        ],
                      ),
                    ),
                    SizedBox(width: 12),
                    Icon(Icons.smart_toy_outlined, size: 48, color: AppColors.accentInk),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              Center(
                child: GestureDetector(
                  onTap: (_stage == _Stage.idle || _stage == _Stage.denied) ? _startSession : null,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.butter,
                      border: Border.all(
                        color: AppColors.lineStrong,
                        width: 1.5,
                      ),
                      boxShadow: const [BoxShadow(color: AppColors.lineStrong, offset: Offset(0, 4))],
                    ),
                    child: const Icon(
                      Icons.mic_none_rounded,
                      size: 46,
                      color: AppColors.accentInk,
                    ),
                  ),
                ),
              ),
              if (_stage == _Stage.idle || _stage == _Stage.denied) ...[
                const SizedBox(height: 10),
                const Center(
                  child: Text(
                    'Tekan untuk mulai merekam',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              ],
              const SizedBox(height: 30),
            ],
            HubCard(
              child: Row(
                children: [
                  IconTile(Icons.mic_none_rounded, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _statusLabel,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _stage == _Stage.processing && _processingNote != null
                              ? _processingNote!
                              : _statusHint,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(fontSize: 12, color: AppColors.danger),
                ),
              ),
            ],
            const SizedBox(height: 20),
            if (_stage == _Stage.idle || _stage == _Stage.denied)
              const SizedBox.shrink()
            else if (_stage == _Stage.listening)
              const Center(child: CircularProgressIndicator())
            else if (_stage == _Stage.recording) ...[
              _WaveformPreview(active: true),
              const SizedBox(height: 10),
              Center(
                child: Text(
                  _elapsedLabel,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
                ),
              ),
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'Audio direkam utuh — suara perawat dan pasien dipisahkan otomatis setelah sesi berhenti.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  style: TextButton.styleFrom(
                    backgroundColor: const Color(0xFFFFE7E7),
                    padding: const EdgeInsets.all(17),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: _stopAndProcess,
                  child: const Text(
                    'Hentikan Sesi',
                    style: TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ] else if (_stage == _Stage.processing)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_stage == _Stage.review) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: .15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 1),
                      child: Icon(
                        Icons.auto_awesome,
                        size: 14,
                        color: AppColors.warning,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _providerLabel != null
                            ? 'Draf AI ($_providerLabel) — perlu verifikasi dokter'
                            : 'Draf manual (tanpa AI) — perlu verifikasi dokter',
                        softWrap: true,
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.35,
                          color: AppColors.warning,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Untuk: $_doctorName${_doctorInstansi != null && _doctorInstansi!.isNotEmpty ? ' · $_doctorInstansi' : ''}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              const Text(
                'Periksa dan benarkan isi draf, lalu salin atau ekspor PDF/DOCX untuk dibagikan ke dokter (WhatsApp, email, dll).',
                style: TextStyle(fontSize: 12, height: 1.4, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<int>(
                  showSelectedIcon: false,
                  style: const ButtonStyle(
                    visualDensity: VisualDensity.compact,
                    padding: WidgetStatePropertyAll(
                      EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                    ),
                  ),
                  segments: const [
                    ButtonSegment(value: 0, label: _SegLabel('Transkrip')),
                    ButtonSegment(value: 1, label: _SegLabel('Ringkasan')),
                    ButtonSegment(value: 2, label: _SegLabel('Banding')),
                  ],
                  selected: {_view},
                  onSelectionChanged: (v) => setState(() => _view = v.first),
                ),
              ),
              const SizedBox(height: 10),
              ..._reviewBody(),
              const SizedBox(height: 8),
              if (_exporting)
                const Center(child: CircularProgressIndicator())
              else ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _copyText,
                    icon: const Icon(Icons.copy_all_rounded, size: 18),
                    label: const Text('Salin Teks'),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _exportAs('pdf'),
                        icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                        label: const Text('Ekspor PDF'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _exportAs('docx'),
                        icon: const Icon(Icons.description_outlined, size: 18),
                        label: const Text('Ekspor DOCX'),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: _reset,
                  child: const Text('Mulai sesi baru'),
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );

  List<Widget> _reviewBody() => switch (_view) {
    0 => _sttView(),
    1 => _aiView(),
    _ => _compareView(),
  };

  List<Widget> _sttView() => [
    const Text(
      'Transkrip mentah speech-to-text, dipisah per pembicara.',
      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
    ),
    if (_relabeledByLlm)
      const Padding(
        padding: EdgeInsets.only(top: 4),
        child: Text(
          'Suara terdeteksi satu orang oleh STT — peran perawat/pasien ditentukan AI dari isi kalimat.',
          style: TextStyle(fontSize: 11, color: AppColors.warning),
        ),
      ),
    const SizedBox(height: 8),
    HubCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final s in _segments)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(
                    text: s['speaker'] == 'perawat' ? 'Perawat: ' : 'Pasien: ',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: s['speaker'] == 'perawat' ? AppColors.primary : AppColors.accentInk,
                    ),
                  ),
                  TextSpan(text: s['text']),
                ]),
                style: const TextStyle(fontSize: 13),
              ),
            ),
        ],
      ),
    ),
    Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: _swapSpeakers,
        icon: const Icon(Icons.swap_vert_rounded, size: 18),
        label: const Text('Tukar peran perawat ↔ pasien'),
      ),
    ),
  ];

  List<Widget> _aiView() => [
    const Text(
      'Rangkuman AI dari transkrip. Ketuk kolom untuk mengedit.',
      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
    ),
    const SizedBox(height: 8),
    HubCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: _draftControllers.entries
            .map(
              (e) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_humanizeKey(e.key), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: e.value,
                      maxLines: null,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.all(10),
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    ),
  ];

  List<Widget> _compareView() {
    final m = _metrics;
    if (m == null) return const [Text('Belum ada data perbandingan.')];
    String sec(num? ms) => ms == null ? '-' : '${(ms / 1000).toStringAsFixed(1)} dtk';
    Widget row(String k, String a, String b) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(flex: 4, child: Text(k, style: const TextStyle(fontSize: 12, color: AppColors.textMuted))),
          Expanded(flex: 3, child: Text(a, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
          Expanded(flex: 3, child: Text(b, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
        ],
      ),
    );
    return [
      HubCard(
        child: Column(
          children: [
            row('', 'STT mentah', 'Ringkasan AI'),
            const Divider(height: 8),
            row('Jumlah kata', '${m['stt_kata']}', '${m['llm_kata']}'),
            row('Waktu proses', sec(m['stt_waktu_ms'] as num?), sec(m['llm_waktu_ms'] as num?)),
            row('Isi', '${m['stt_segmen']} segmen', m['llm_berhasil'] == true ? 'terstruktur' : 'gagal/tanpa AI'),
            row('Rasio ringkas', '100%', '${m['rasio_ringkas']}'),
            const Divider(height: 8),
            row('Durasi audio', sec(m['durasi_audio_ms'] as num?), ''),
            row('Pembicara (STT)', '${m['pembicara_terdeteksi']}', _relabeledByLlm ? 'dikoreksi AI' : ''),
          ],
        ),
      ),
      const SizedBox(height: 6),
      const Text(
        'Angka ini ikut tersimpan di riwayat dan dimasukkan ke ekspor PDF/DOCX/teks untuk bahan perbandingan.',
        style: TextStyle(fontSize: 11, color: AppColors.textMuted),
      ),
    ];
  }

  String get _statusLabel => switch (_stage) {
    _Stage.idle => 'Siap merekam',
    _Stage.listening => 'Menyiapkan sesi...',
    _Stage.recording => 'Merekam sesi...',
    _Stage.processing => 'Memproses sesi...',
    _Stage.review => 'Draf siap — belum dibagikan',
    _Stage.denied => 'Izin mikrofon diperlukan',
  };

  String get _statusHint => switch (_stage) {
    _Stage.idle => 'Tekan tombol untuk mulai merekam percakapan.',
    _Stage.listening => 'Menyiapkan data sesi dan mikrofon.',
    _Stage.recording => 'Bicara dengan pasien — audio direkam utuh.',
    _Stage.processing => 'Memisahkan pembicara, menyusun draf, menyimpan ke database.',
    _Stage.review => 'Salin atau ekspor untuk membagikan draf ini ke dokter.',
    _Stage.denied => 'Aktifkan izin mikrofon di pengaturan perangkat lalu coba lagi.',
  };
}

/// "keluhan_utama" -> "Keluhan utama" — label field draf tampil seperti
/// bahasa manusia, bukan nama kolom database.
String _humanizeKey(String key) {
  final t = key.replaceAll('_', ' ').trim();
  return t.isEmpty ? key : t[0].toUpperCase() + t.substring(1);
}

/// Label segmen satu baris: mengecil bila sempit, tidak pernah patah dua baris.
class _SegLabel extends StatelessWidget {
  const _SegLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => FittedBox(
    fit: BoxFit.scaleDown,
    child: Text(text, maxLines: 1, softWrap: false),
  );
}

class _WaveformPreview extends StatefulWidget {
  const _WaveformPreview({this.active = true});
  final bool active;
  @override
  State<_WaveformPreview> createState() => _WaveformPreviewState();
}

class _WaveformPreviewState extends State<_WaveformPreview>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 60,
    child: AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(16, (i) {
          final phase = i * 0.4;
          final wave = math.sin(_controller.value * 2 * math.pi + phase);
          final height = 8 + 26 * (0.5 + 0.5 * wave);
          return Container(
            width: 4,
            height: height,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              gradient: AppColors.gradient,
              borderRadius: BorderRadius.circular(4),
            ),
          );
        }),
      ),
    ),
  );
}
