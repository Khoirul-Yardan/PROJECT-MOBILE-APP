import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/supabase_service.dart';
import '../services/bpjs_service.dart';

enum _Stage { idle, listening, recording, processing, review, sent, denied }

class BotBpjsScreen extends StatefulWidget {
  const BotBpjsScreen({super.key});
  @override
  State<BotBpjsScreen> createState() => _BotBpjsScreenState();
}

class _BotBpjsScreenState extends State<BotBpjsScreen> {
  _Stage _stage = _Stage.idle;
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _speechReady = false;

  String? _doctorId;
  String? _doctorName;
  String? _patientName;
  String _liveTranscript = '';
  final List<Map<String, String>> _segments = []; // {speaker, text}
  Map<String, dynamic>? _draft;
  String? _providerLabel;
  String? _errorMessage;

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  Future<void> _sayHalo() async {
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
          _speech.listen(
            onResult: _onSpeechResult,
            listenOptions: stt.SpeechListenOptions(
              partialResults: true,
              cancelOnError: false,
              localeId: 'id_ID',
            ),
          );
        }
      },
      onError: (error) {
        if (!mounted) return;
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
    // Ask who the patient is before recording starts — the transcript and
    // generated draft need a name to attach to, and schema.sql's
    // bpjs_sessions.pasien_nama is not-null.
    final patientName = await _askPatientName();
    if (!mounted) return;
    if (patientName == null || patientName.trim().isEmpty) {
      setState(() => _stage = _Stage.idle);
      return;
    }
    _patientName = patientName.trim();
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
    setState(() => _stage = _Stage.processing);

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

    // Pick the target doctor *before* creating the session row — schema.sql
    // requires an accepted friendship with that doctor at insert time (see
    // bpjs_sessions' insert policy), so the ID has to be known up front,
    // not filled in after the fact.
    final doctors = await SupabaseService.fetchAcceptedDoctors();
    if (!mounted) return;
    if (doctors.isEmpty) {
      await _showNoDoctorDialog();
      if (!mounted) return;
      setState(() => _stage = _Stage.idle);
      return;
    }
    final picked = await _pickDoctor(doctors);
    if (!mounted) return;
    if (picked == null) {
      setState(() => _stage = _Stage.idle);
      return;
    }
    _doctorId = picked['id'] as String;
    _doctorName = picked['display_name'] as String? ?? 'Dokter';

    final sessionId = await BpjsSessionRepo.createSession(
      dokterId: _doctorId!,
      pasienNama: _patientName ?? 'Pasien',
    );
    if (!mounted) return;
    if (sessionId == null) {
      setState(() {
        _errorMessage =
            'Gagal membuat sesi — pastikan kamu dan $_doctorName sudah berteman (status "accepted"), bukan hanya "pending".';
        _stage = _Stage.idle;
      });
      return;
    }
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
    _draft = draft;

    await BpjsSessionRepo.saveDocumentation(
      sessionId: sessionId,
      structured: draft,
      alurPercakapan: _segments,
      providerId: credential?.id,
    );
    await BpjsSessionRepo.markStatus(sessionId, 'pending_review');

    if (!mounted) return;
    setState(() => _stage = _Stage.review);
    await SupabaseService.logActivity(
      category: 'Bots',
      title: 'Dokumentasi dikirim ke $_doctorName',
      subtitle: 'Menunggu review kecocokan form BPJS',
      badge: 'Info',
    );
  }

  Future<void> _showNoDoctorDialog() => showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Belum ada dokter terhubung'),
      content: const Text(
        'Tambahkan dokter sebagai teman dulu di menu Teman (Pengaturan → Teman) sebelum mengirim dokumentasi ini.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Mengerti'),
        ),
      ],
    ),
  );

  Future<Map<String, dynamic>?> _pickDoctor(
    List<Map<String, dynamic>> doctors,
  ) => showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Kirim ke dokter siapa?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Hanya dokter yang sudah berteman dengan Anda yang muncul di sini.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 8),
          for (final doc in doctors)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text((doc['display_name'] as String?) ?? 'Dokter'),
              onTap: () => Navigator.pop(context, doc),
            ),
          const SizedBox(height: 12),
        ],
      ),
    ),
  );

  void _reset() => setState(() {
    _stage = _Stage.idle;
    _doctorId = null;
    _doctorName = null;
    _patientName = null;
    _liveTranscript = '';
    _segments.clear();
    _draft = null;
    _errorMessage = null;
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Jarvis / Bot BPJS')),
    body: SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_stage != _Stage.review && _stage != _Stage.sent) ...[
              const SizedBox(height: 16),
              const Center(
                child: Text(
                  'Jarvis',
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'Asisten suara untuk dokumentasi klinis',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ),
              const SizedBox(height: 28),
              Center(
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppColors.gradient,
                    border: Border.all(
                      color: const Color(0xFFE1EBFF),
                      width: 8,
                    ),
                  ),
                  child: const Icon(
                    Icons.mic_none_rounded,
                    size: 46,
                    color: Colors.white,
                  ),
                ),
              ),
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
              GradientButton(
                label: 'Ucapkan "Halo Jarvis"',
                onPressed: _sayHalo,
              )
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
            else if (_stage == _Stage.review || _stage == _Stage.sent) ...[
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
                'Untuk: $_doctorName',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              const Text(
                'Dokter meninjau dan menandai status ini dari akunnya sendiri (web) — status di bawah diperbarui secara realtime.',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              HubCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: (_draft?.entries ?? const <MapEntry<String, dynamic>>[])
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
                              const SizedBox(height: 2),
                              Text('${e.value}', style: const TextStyle(fontSize: 13)),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
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
    _Stage.idle => 'Menunggu wake word',
    _Stage.listening => 'Menyiapkan mikrofon...',
    _Stage.recording => 'Merekam sesi...',
    _Stage.processing => 'Memproses (STT + LLM + simpan ke database)...',
    _Stage.review => 'Dikirim — menunggu review dokter',
    _Stage.sent => 'Terkirim',
    _Stage.denied => 'Izin mikrofon diperlukan',
  };

  String get _statusHint => switch (_stage) {
    _Stage.idle => 'Tekan tombol untuk mulai merekam percakapan.',
    _Stage.listening => 'Meminta izin mikrofon dan menyiapkan speech recognition.',
    _Stage.recording => 'Bicara dengan pasien — teks akan muncul di bawah.',
    _Stage.processing => 'Mengirim transkrip ke dokter yang dipilih.',
    _Stage.review => 'Dokter dan perawat dapat melihat status ini di Activity Log.',
    _Stage.sent => 'Dokter sudah meninjau sesi ini.',
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
