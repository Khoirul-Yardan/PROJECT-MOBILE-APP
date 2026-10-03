import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/bpjs_service.dart';

enum _Stage { preparation, recording, processing, review }

class BotBpjsScreen extends StatefulWidget {
  const BotBpjsScreen({super.key});
  @override
  State<BotBpjsScreen> createState() => _BotBpjsScreenState();
}

class _BotBpjsScreenState extends State<BotBpjsScreen>
    with WidgetsBindingObserver {
  final _form = GlobalKey<FormState>();
  final _patient = TextEditingController();
  final _doctor = TextEditingController();
  final _institution = TextEditingController();
  final _speech = stt.SpeechToText();
  final _elapsed = Stopwatch();
  final List<Map<String, String>> _segments = [];
  final List<int> _offsets = [];
  _Stage _stage = _Stage.preparation;
  Timer? _timer;
  bool _starting = false,
      _micActive = false,
      _stopping = false,
      _exporting = false,
      _saved = false,
      _leaving = false;
  String _live = '', _progress = '', _provider = '';
  String? _error, _sessionId;
  DateTime? _createdAt;
  Map<String, dynamic>? _draft;
  BpjsAiCredential? _credential;
  int _savedSegments = 0;
  bool _documentSaved = false;
  bool get _raw => _provider.isEmpty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _elapsed.stop();
    _speech.cancel();
    _patient.dispose();
    _doctor.dispose();
    _institution.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused && _stage == _Stage.recording) {
      _stopCapture().then((_) {
        if (mounted) {
          setState(
            () => _error = 'Mikrofon terhenti saat aplikasi masuk latar belakang. Periksa transkrip lalu proses hasil.',
          );
        }
      });
    }
  }

  void _onStatus(String status) {
    if (!mounted) return;
    setState(() {
      _micActive = status == 'listening';
      if (_micActive) {
        _elapsed.start();
      } else {
        _elapsed.stop();
      }
    });
  }

  Future<void> _start() async {
    if (_starting || !_form.currentState!.validate()) return;
    setState(() {
      _starting = true;
      _error = null;
    });
    try {
      final ready = await _speech.initialize(
        onStatus: _onStatus,
        onError: (error) {
          if (mounted) {
            setState(() {
              _micActive = false;
              _elapsed.stop();
              _error =
                  'Mikrofon terhenti: ${error.errorMsg}. Transkrip yang sudah tersedia tetap dapat diproses.';
            });
          }
        },
      );
      if (!mounted) return;
      if (!ready) {
        setState(
          () => _error = 'Izin mikrofon ditolak atau pengenalan suara tidak tersedia. Periksa izin mikrofon pada pengaturan perangkat, lalu coba lagi.',
        );
        return;
      }
      _createdAt = DateTime.now();
      _elapsed.reset();
      setState(() => _stage = _Stage.recording);
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted && _micActive) setState(() {});
      });
      await _speech.listen(
        onResult: _onResult,
        listenOptions: stt.SpeechListenOptions(
          partialResults: true,
          cancelOnError: true,
          localeId: 'id_ID',
        ),
      );
      if (mounted) {
        setState(() {
          _micActive = _speech.isListening;
          if (_micActive) _elapsed.start();
        });
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Mikrofon belum dapat diaktifkan. Periksa izin perangkat lalu coba lagi.',
        );
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  void _onResult(SpeechRecognitionResult result) {
    if (!mounted || _stage != _Stage.recording) return;
    setState(() {
      _live = result.recognizedWords;
      if (result.finalResult && _live.trim().isNotEmpty) _commitLive();
    });
  }

  void _commitLive() {
    if (_live.trim().isEmpty) return;
    _segments.add({'speaker': 'perawat', 'text': _live.trim()});
    // Actual observation time, not an invented interval or diarization result.
    _offsets.add(_elapsed.elapsedMilliseconds);
    _live = '';
  }

  Future<void> _stopCapture() async {
    if (_stopping) return;
    _stopping = true;
    try {
      await _speech.stop();
    } finally {
      _elapsed.stop();
      _timer?.cancel();
      if (mounted) {
        setState(() {
          _micActive = false;
          _commitLive();
        });
      }
      _stopping = false;
    }
  }

  Future<void> _process() async {
    if (_stage == _Stage.processing || _stopping) return;
    await _stopCapture();
    if (!mounted) return;
    if (_segments.isEmpty) {
      setState(() {
        _stage = _Stage.preparation;
        _error = 'Tidak ada ucapan yang terekam. Identitas tetap tersimpan; coba rekam lagi.';
      });
      return;
    }
    setState(() {
      _stage = _Stage.processing;
      _error = null;
      _progress = 'Menyusun draf';
    });
    if (_draft == null) {
      _credential = await BpjsAiService.firstAvailableCredential();
      final text = _segments.map((s) => s['text']).join('\n');
      final generated = _credential == null
          ? null
          : await BpjsAiService.generateDocumentation(
              credential: _credential!,
              transcriptText: text,
            );
      _provider = generated == null ? '' : _credential!.label;
      _draft =
          generated ??
          {
            'ringkasan': text,
            'catatan': 'Transkrip mentah — belum disusun AI. Provider belum tersedia atau penyusunan draf gagal.',
          };
    }
    if (!mounted) return;
    setState(() => _progress = 'Menyimpan transkrip dan draf');
    try {
      _sessionId ??= await BpjsSessionRepo.createSession(
        dokterNama: _doctor.text.trim(),
        dokterInstansi: _institution.text.trim(),
        pasienNama: _patient.text.trim(),
      );
      if (_sessionId == null) throw StateError('Sesi belum tersimpan');
      await BpjsSessionRepo.markStatus(_sessionId!, 'processing');
      while (_savedSegments < _segments.length) {
        final segment = _segments[_savedSegments];
        await BpjsSessionRepo.addTranscriptSegment(
          sessionId: _sessionId!,
          speaker: segment['speaker']!,
          text: segment['text']!,
          offsetMs: _offsets[_savedSegments],
        );
        _savedSegments++;
      }
      if (!_documentSaved) {
        await BpjsSessionRepo.saveDocumentation(
          sessionId: _sessionId!,
          structured: _draft!,
          alurPercakapan: _segments,
          providerId: _raw ? null : _credential?.id,
        );
        _documentSaved = true;
      }
      await BpjsSessionRepo.markStatus(_sessionId!, 'siap_dikirim');
      _saved = true;
    } catch (_) {
      _error = 'Belum tersimpan lengkap di riwayat. Transkrip dan draf masih tersedia di layar ini. Salin atau ekspor sebelum keluar.';
    }
    if (mounted) setState(() => _stage = _Stage.review);
  }

  String get _reference =>
      _sessionId ?? 'lokal-${_createdAt?.millisecondsSinceEpoch ?? 0}';
  String get _documentLabel => _raw
      ? 'Transkrip mentah — belum disusun AI'
      : 'Draf AI — perlu verifikasi dokter';

  Future<void> _copy() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      await Clipboard.setData(
        ClipboardData(
          text: BpjsExport.plainText(
            dokterNama: _doctor.text.trim(),
            dokterInstansi: _institution.text.trim(),
            pasienNama: _patient.text.trim(),
            createdAt: _createdAt!,
            structured: _draft!,
            transcript: _segments,
            sessionReference: _reference,
            providerLabel: _provider,
          ),
        ),
      );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Teks disalin')));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Teks belum dapat disalin. Coba lagi.');
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _chooseExport() async {
    final format = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ekspor dokumen',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(
                  'Pasien: ${_patient.text}\nDokter tujuan: ${_doctor.text}',
                ),
                const Text(
                  'Periksa penerima pada aplikasi tujuan. Membagikan file tidak membuktikan dokter telah menerimanya.',
                ),
                ListTile(
                  title: const Text('PDF'),
                  subtitle: const Text('Untuk membaca dokumen'),
                  onTap: () => Navigator.pop(context, 'pdf'),
                ),
                ListTile(
                  title: const Text('DOCX'),
                  subtitle: const Text('Untuk koreksi di aplikasi dokumen'),
                  onTap: () => Navigator.pop(context, 'docx'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (format == null || !mounted) return;
    setState(() => _exporting = true);
    try {
      final build = format == 'pdf'
          ? BpjsExport.buildPdf
          : BpjsExport.buildDocx;
      final bytes = await build(
        dokterNama: _doctor.text.trim(),
        dokterInstansi: _institution.text.trim(),
        pasienNama: _patient.text.trim(),
        createdAt: _createdAt!,
        structured: _draft!,
        transcript: _segments,
        sessionReference: _reference,
        providerLabel: _provider,
      );
      await BpjsExport.shareFile(
        bytes: bytes,
        filename:
            'draf-bpjs-${_createdAt!.toIso8601String().substring(0, 10)}-$_reference.$format',
        mimeSubject: 'Draf dokumentasi BPJS',
      );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('File siap dibagikan')));
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'File belum dapat dibuat atau dibagikan. Draf tetap tersedia; coba lagi.',
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _leave() async {
    if (_leaving || _stage == _Stage.processing || _starting || _exporting) {
      return;
    }
    _leaving = true;
    await _stopCapture();
    if (!mounted) return;
    if (_segments.isNotEmpty && (_stage == _Stage.recording || !_saved)) {
      final choice = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Hasil sesi belum tersimpan'),
          content: const Text(
            'Mikrofon telah dihentikan. Periksa hasil sebelum meninggalkan sesi.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, 'stay'),
              child: const Text('Tetap di sini'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, 'discard'),
              child: const Text('Buang hasil'),
            ),
            if (_stage == _Stage.recording)
              FilledButton(
                onPressed: () => Navigator.pop(context, 'process'),
                child: const Text('Proses hasil'),
              ),
          ],
        ),
      );
      if (!mounted) return;
      _leaving = false;
      if (choice == 'process') {
        await _process();
        return;
      }
      if (choice != 'discard') return;
    }
    if (mounted) Navigator.of(context).pop();
  }

  Widget _notice(String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Text(text, style: const TextStyle(color: AppColors.warn)),
  );
  Widget _transcript() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Transkrip pendukung',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const Text(
        'Pembicara belum diverifikasi.',
        style: TextStyle(color: AppColors.inkMuted),
      ),
      ..._segments.map(
        (s) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: SelectableText(s['text']!),
        ),
      ),
      if (_live.isNotEmpty) Text(_live),
    ],
  );

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop) _leave();
    },
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Bot BPJS'),
        leading: IconButton(
          tooltip: 'Kembali',
          icon: const Icon(Icons.arrow_back),
          onPressed: _leave,
        ),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_stage == _Stage.preparation)
                Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Persiapan dokumentasi',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _patient,
                        decoration: const InputDecoration(
                          labelText: 'Nama pasien',
                        ),
                        validator: (v) =>
                            v!.trim().isEmpty ? 'Isi nama pasien' : null,
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _doctor,
                        decoration: const InputDecoration(
                          labelText: 'Nama dokter tujuan',
                        ),
                        validator: (v) =>
                            v!.trim().isEmpty ? 'Isi nama dokter tujuan' : null,
                      ),
                      const Text(
                        'Digunakan pada dokumen; pengiriman dilakukan saat Anda membagikan hasil.',
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _institution,
                        decoration: const InputDecoration(
                          labelText: 'Instansi (opsional)',
                        ),
                      ),
                      _notice(
                        'Pastikan persetujuan perekaman sesuai prosedur instansi sebelum mulai. Suara diproses menjadi teks dan dapat dikirim ke layanan AI pada akun Anda. Jika AI tidak tersedia, hasil berupa transkrip mentah. Hasil tetap perlu diverifikasi dokter.',
                      ),
                      FilledButton(
                        onPressed: _starting ? null : _start,
                        child: Text(
                          _starting ? 'Menyiapkan mikrofon…' : 'Mulai rekam',
                        ),
                      ),
                    ],
                  ),
                )
              else ...[
                HubCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Pasien: ${_patient.text}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text('Dokter tujuan: ${_doctor.text}'),
                      if (_institution.text.isNotEmpty) Text(_institution.text),
                      Text('Tanggal: ${_createdAt?.toLocal()}'),
                      if (_sessionId != null) Text('Referensi: $_sessionId'),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                if (_stage == _Stage.recording) ...[
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      _micActive ? 'Mikrofon aktif' : 'Mikrofon terhenti',
                      style: TextStyle(
                        color: _micActive ? AppColors.danger : AppColors.warn,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    'Durasi mikrofon aktif: ${_elapsed.elapsed.inMinutes}:${(_elapsed.elapsed.inSeconds % 60).toString().padLeft(2, '0')}',
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _stopping || _starting ? null : _process,
                    child: Text(
                      _micActive ? 'Hentikan rekaman' : 'Proses hasil',
                    ),
                  ),
                  const SizedBox(height: 24),
                  _transcript(),
                ],
                if (_stage == _Stage.processing) ...[
                  Text(_progress),
                  const LinearProgressIndicator(),
                  const SizedBox(height: 24),
                  _transcript(),
                ],
                if (_stage == _Stage.review) ...[
                  _notice(_documentLabel),
                  for (final field in const {
                    'ringkasan': 'Ringkasan',
                    'keluhan_utama': 'Keluhan utama',
                    'durasi_gejala': 'Durasi gejala',
                    'riwayat_kesehatan': 'Riwayat kesehatan',
                    'hasil_anamnesis': 'Hasil anamnesis',
                  }.entries) ...[
                    Text(
                      field.value,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    SelectableText(
                      '${_draft?[field.key] ?? 'Belum disebutkan dalam percakapan'}',
                    ),
                    const SizedBox(height: 24),
                  ],
                  if (_raw) _notice('${_draft?['catatan'] ?? ''}'),
                  _transcript(),
                  const SizedBox(height: 24),
                  if (!_raw) Text('Penyusun: $_provider'),
                  Text(
                    _saved
                        ? 'Tersimpan di riwayat.'
                        : 'Belum tersimpan lengkap di riwayat.',
                  ),
                  const Text(
                    'Pemeriksaan baca-saja. Koreksi dilakukan pada salinan DOCX.',
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _exporting ? null : _chooseExport,
                    child: Text(
                      _exporting ? 'Menyiapkan dokumen…' : 'Ekspor dokumen',
                    ),
                  ),
                  OutlinedButton(
                    onPressed: _exporting ? null : _copy,
                    child: const Text('Salin teks'),
                  ),
                ],
              ],
              if (_error != null)
                Semantics(
                  liveRegion: true,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}
