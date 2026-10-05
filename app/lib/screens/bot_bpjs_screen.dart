import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/supabase_service.dart';
import '../services/bpjs_service.dart';

enum _Stage { idle, listening, recording, processing, review, denied }

class BotBpjsScreen extends StatefulWidget {
  const BotBpjsScreen({super.key});
  @override
  State<BotBpjsScreen> createState() => _BotBpjsScreenState();
}

class _BotBpjsScreenState extends State<BotBpjsScreen> {
  _Stage _stage = _Stage.idle;
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _speechReady = false;

  String? _doctorName;
  String? _doctorInstansi;
  String? _patientName;
  DateTime? _sessionCreatedAt;
  String? _sessionId;
  String _liveTranscript = '';
  final List<Map<String, String>> _segments = []; // {speaker, text}
  String? _providerLabel;
  String? _errorMessage;
  bool _exporting = false;
  bool _restartingSpeech = false;
  final Map<String, TextEditingController> _draftControllers = {};

  /// The draft as currently edited in the review screen — export/copy reads
  /// this instead of `_draft` directly, so a nurse's corrections are what
  /// actually gets sent, not the AI's first pass.
  Map<String, dynamic> get _editedDraft => {
    for (final entry in _draftControllers.entries) entry.key: entry.value.text,
  };

  @override
  void dispose() {
    _speech.stop();
    for (final c in _draftControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Restarting the recognizer immediately (synchronously, back-to-back
  /// with it just stopping) is what tends to produce 'error_client' on
  /// Android — a short delay plus a re-entrancy guard (two overlapping
  /// restart triggers, e.g. onStatus *and* onError firing for the same
  /// pause) avoids hammering it.
  void _restartListening() {
    if (_restartingSpeech) return;
    _restartingSpeech = true;
    Future.delayed(const Duration(milliseconds: 350), () {
      _restartingSpeech = false;
      if (!mounted || _stage != _Stage.recording) return;
      _speech.listen(
        onResult: _onSpeechResult,
        listenOptions: stt.SpeechListenOptions(
          partialResults: true,
          cancelOnError: false,
          localeId: 'id_ID',
        ),
      );
    });
  }

  Future<void> _startSession() async {
    setState(() {
      _stage = _Stage.listening;
      _errorMessage = null;
    });
    _speechReady = await _speech.initialize(
      onStatus: (status) {
        if (status == 'notListening' && _stage == _Stage.recording) {
          // The platform speech engine stops itself after a pause; restart
          // it so a real multi-turn conversation keeps being captured
          // instead of the session silently going deaf after one utterance.
          if (mounted && _errorMessage != null) setState(() => _errorMessage = null);
          _restartListening();
        }
      },
      onError: (error) {
        if (!mounted) return;
        // Once recording has moved on to processing/review/idle, a trailing
        // STT event (the engine can fire onError slightly after stop()
        // returns) is no longer relevant to anything on screen — drop it
        // instead of leaving a stale "error" banner on a screen that has
        // nothing to do with the microphone anymore.
        if (_stage != _Stage.recording && _stage != _Stage.listening) return;
        // These fire naturally on every pause (or around a listen→relisten
        // restart, which 'error_client' usually means — the engine was
        // asked to start again while still tearing down the previous
        // session) — onStatus above (or the restart itself) already
        // recovers, so surfacing them as a red error would wrongly read as
        // the session being broken when it's just a normal hiccup.
        if (error.errorMsg == 'error_speech_timeout' ||
            error.errorMsg == 'error_no_match' ||
            error.errorMsg == 'error_client') {
          if (_stage == _Stage.recording) _restartListening();
          return;
        }
        setState(() {
          _errorMessage = 'Mikrofon/STT error: ${error.errorMsg}';
        });
      },
    );
    if (!mounted) return;
    if (!_speechReady) {
      setState(() {
        _stage = _Stage.denied;
        _errorMessage =
            'Izin mikrofon ditolak atau speech recognition tidak tersedia di perangkat ini.';
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
    setState(() => _stage = _Stage.recording);
    _liveTranscript = '';
    _segments.clear();
    await _speech.listen(
      onResult: _onSpeechResult,
      listenOptions: stt.SpeechListenOptions(
        partialResults: true,
        cancelOnError: false,
        localeId: 'id_ID',
      ),
    );
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
                hintText: 'mis. dr. Amma Haz',
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

  void _onSpeechResult(SpeechRecognitionResult result) {
    if (!mounted) return;
    setState(() => _liveTranscript = result.recognizedWords);
    if (result.finalResult && result.recognizedWords.trim().isNotEmpty) {
      // The on-device recognizer alone can't tell nurse from patient
      // (speaker diarization needs a dedicated model this app doesn't
      // bundle) — segments are tagged 'perawat' by default since the nurse
      // holds the phone; this is a documented limitation, not hidden.
      _segments.add({'speaker': 'perawat', 'text': result.recognizedWords.trim()});
      _liveTranscript = '';
    }
  }

  Future<void> _stopAndProcess() async {
    await _speech.stop();
    if (_liveTranscript.trim().isNotEmpty) {
      _segments.add({'speaker': 'perawat', 'text': _liveTranscript.trim()});
    }
    setState(() {
      _stage = _Stage.processing;
      _errorMessage = null;
    });

    if (_segments.isEmpty) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Tidak ada ucapan yang terekam. Coba lagi.';
        _stage = _Stage.idle;
      });
      return;
    }

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

    var offsetMs = 0;
    for (final seg in _segments) {
      await BpjsSessionRepo.addTranscriptSegment(
        sessionId: sessionId,
        speaker: seg['speaker']!,
        text: seg['text']!,
        offsetMs: offsetMs,
      );
      offsetMs += 4000;
    }

    final transcriptText = _segments.map((s) => s['text']).join(' ');
    final credential = await BpjsAiService.firstAvailableCredential();
    Map<String, dynamic> draft;
    if (credential != null) {
      final generated = await BpjsAiService.generateDocumentation(
        credential: credential,
        transcriptText: transcriptText,
      );
      draft = generated ??
          {
            'ringkasan': transcriptText,
            'catatan':
                'AI tidak merespons — ringkasan ini adalah transkrip mentah, perlu disusun manual oleh perawat.',
          };
      _providerLabel = credential.label;
    } else {
      draft = {
        'ringkasan': transcriptText,
        'catatan':
            'Belum ada provider/agent AI terhubung (Pengaturan → API & Agent) — ringkasan ini adalah transkrip mentah.',
      };
      _providerLabel = null;
    }
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

  Future<void> _copyText() async {
    final text = BpjsExport.plainText(
      dokterNama: _doctorName ?? 'Dokter',
      dokterInstansi: _doctorInstansi,
      pasienNama: _patientName ?? 'Pasien',
      createdAt: _sessionCreatedAt ?? DateTime.now(),
      structured: _editedDraft,
      transcript: _segments,
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
    _liveTranscript = '';
    _segments.clear();
    for (final c in _draftControllers.values) {
      c.dispose();
    }
    _draftControllers.clear();
    _errorMessage = null;
  });

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
                          _statusHint,
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
              if (_liveTranscript.isNotEmpty || _segments.isNotEmpty) ...[
                const SizedBox(height: 14),
                HubCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ..._segments.map(
                        (s) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Text(s['text'] ?? '', style: const TextStyle(fontSize: 13)),
                        ),
                      ),
                      if (_liveTranscript.isNotEmpty)
                        Text(
                          _liveTranscript,
                          style: const TextStyle(
                            fontSize: 13,
                            fontStyle: FontStyle.italic,
                            color: AppColors.textMuted,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
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
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: .15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.auto_awesome,
                      size: 14,
                      color: AppColors.warning,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _providerLabel != null
                          ? 'Draf AI ($_providerLabel) — perlu verifikasi dokter'
                          : 'Draf manual (tanpa AI) — perlu verifikasi dokter',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.warning,
                        fontWeight: FontWeight.w600,
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
                'Bagikan draf ini langsung ke dokter — salin teksnya, atau kirim sebagai file PDF/DOCX lewat WhatsApp, email, atau aplikasi lain di HP Anda.',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
              const SizedBox(height: 4),
              const Text(
                'Benarkan tulisannya langsung di sini sebelum disalin atau diekspor.',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic),
              ),
              const SizedBox(height: 10),
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
                              Text(
                                e.key,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                ),
                              ),
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
              const SizedBox(height: 18),
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

  String get _statusLabel => switch (_stage) {
    _Stage.idle => 'Siap merekam',
    _Stage.listening => 'Menyiapkan mikrofon...',
    _Stage.recording => 'Merekam sesi...',
    _Stage.processing => 'Memproses (STT + LLM + simpan ke database)...',
    _Stage.review => 'Draf siap — belum dibagikan',
    _Stage.denied => 'Izin mikrofon diperlukan',
  };

  String get _statusHint => switch (_stage) {
    _Stage.idle => 'Tekan tombol untuk mulai merekam percakapan.',
    _Stage.listening => 'Meminta izin mikrofon dan menyiapkan speech recognition.',
    _Stage.recording => 'Bicara dengan pasien — teks akan muncul di bawah.',
    _Stage.processing => 'Menyusun draf dokumentasi untuk dokter yang dituju.',
    _Stage.review => 'Salin atau ekspor untuk membagikan draf ini ke dokter.',
    _Stage.denied => 'Aktifkan izin mikrofon di pengaturan perangkat lalu coba lagi.',
  };
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
