import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/supabase_service.dart';

enum _Stage { idle, listening, recording, processing, review }

class BotBpjsScreen extends StatefulWidget {
  const BotBpjsScreen({super.key});
  @override
  State<BotBpjsScreen> createState() => _BotBpjsScreenState();
}

class _BotBpjsScreenState extends State<BotBpjsScreen> {
  _Stage _stage = _Stage.idle;
  String? _doctor;
  String? _verdict;

  static const _formFields = [
    ('Keluhan utama', 'Nyeri perut bagian kanan bawah sejak 2 hari'),
    ('Durasi gejala', '2 hari, memberat setelah makan'),
    ('Riwayat kesehatan', 'Tidak ada riwayat penyakit kronis'),
    ('Hasil anamnesis', 'Nyeri tekan (+), demam ringan (+)'),
  ];

  Future<void> _sayHalo() async {
    setState(() => _stage = _Stage.listening);
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    setState(() => _stage = _Stage.recording);
  }

  Future<void> _stopAndProcess() async {
    setState(() => _stage = _Stage.processing);
    SupabaseService.logActivity(
      category: 'Bots',
      title: 'Bot BPJS — sesi direkam',
      subtitle: 'Menyusun dokumentasi sesuai form BPJS',
      badge: 'Info',
    );
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    await _pickDoctor();
  }

  Future<void> _pickDoctor() async {
    final doctors = await SupabaseService.fetchAcceptedDoctors();
    if (!mounted) return;
    if (doctors.isEmpty) {
      await showDialog<void>(
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
      if (!mounted) return;
      setState(() => _stage = _Stage.idle);
      return;
    }
    final selected = await showModalBottomSheet<String>(
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
                onTap: () => Navigator.pop(
                  context,
                  (doc['display_name'] as String?) ?? 'Dokter',
                ),
              ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (selected == null || !mounted) return;
    setState(() {
      _doctor = selected;
      _stage = _Stage.review;
    });
    SupabaseService.logActivity(
      category: 'Bots',
      title: 'Dokumentasi dikirim ke $selected',
      subtitle: 'Menunggu review kecocokan form BPJS',
      badge: 'Info',
    );
  }

  void _reset() => setState(() {
    _stage = _Stage.idle;
    _doctor = null;
    _verdict = null;
  });

  void _markVerdict(String verdict) {
    setState(() => _verdict = verdict);
    SupabaseService.logActivity(
      category: 'Bots',
      title: verdict == 'Sesuai'
          ? 'Dokumentasi sesuai form BPJS'
          : 'Dokumentasi perlu perbaikan',
      subtitle: 'Ditinjau untuk $_doctor',
      badge: verdict == 'Sesuai' ? 'Success' : 'Info',
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          verdict == 'Sesuai'
              ? 'Ditandai sesuai form BPJS. Dokumentasi ini yang dipakai RS untuk proses klaim mereka sendiri — aplikasi ini tidak mencairkan dana.'
              : 'Dikirim kembali ke perawat untuk revisi.',
        ),
      ),
    );
  }

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
            if (_stage != _Stage.review) ...[
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
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x207950FF),
                        blurRadius: 0,
                        spreadRadius: 10,
                      ),
                    ],
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
            const SizedBox(height: 20),
            if (_stage == _Stage.idle)
              GradientButton(
                label: 'Ucapkan "Halo Jarvis"',
                onPressed: _sayHalo,
              )
            else if (_stage == _Stage.listening)
              const Center(child: CircularProgressIndicator())
            else if (_stage == _Stage.recording) ...[
              const _WaveformPreview(),
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
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.auto_awesome,
                      size: 14,
                      color: AppColors.warning,
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Draf AI — perlu verifikasi dokter',
                      style: TextStyle(
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
                'Untuk: $_doctor',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              const Text(
                'Field di bawah mengikuti struktur form BPJS agar tidak perlu ditulis manual.',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              HubCard(
                child: Column(
                  children: _formFields
                      .map(
                        (f) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                f.$1,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(f.$2, style: const TextStyle(fontSize: 13)),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              const SizedBox(height: 18),
              if (_verdict == null)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _markVerdict('Perlu Perbaikan'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.danger,
                          side: const BorderSide(color: AppColors.danger),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Perlu Perbaikan'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GradientButton(
                        label: 'Tandai Sesuai',
                        onPressed: () => _markVerdict('Sesuai'),
                      ),
                    ),
                  ],
                )
              else
                Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color:
                            (_verdict == 'Sesuai'
                                    ? AppColors.success
                                    : AppColors.textMuted)
                                .withValues(alpha: .12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        _verdict == 'Sesuai'
                            ? 'Sesuai form BPJS — dokumentasi ini diteruskan ke proses klaim RS sendiri.'
                            : 'Ditandai perlu perbaikan — dikirim kembali ke perawat.',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: _reset,
                        child: const Text('Mulai sesi baru'),
                      ),
                    ),
                  ],
                ),
            ],
          ],
        ),
      ),
    ),
  );

  String get _statusLabel => switch (_stage) {
    _Stage.idle => 'Menunggu wake word',
    _Stage.listening => 'Mendengarkan...',
    _Stage.recording => 'Merekam sesi...',
    _Stage.processing => 'Memproses (STT + diarization + LLM)...',
    _Stage.review => 'Menunggu review dokter',
  };

  String get _statusHint => switch (_stage) {
    _Stage.idle =>
      'Preview mode — tekan tombol untuk mensimulasikan "Halo Jarvis".',
    _Stage.listening => 'Jarvis: "Iya, ada yang bisa saya bantu?"',
    _Stage.recording => 'Jarvis: "Oke, saya akan mengaktifkan Bot BPJS."',
    _Stage.processing => 'Menyusun dokumentasi sesuai field form BPJS.',
    _Stage.review =>
      'Perawat & dokter dapat melihat status ini di Activity Log.',
  };
}

class _WaveformPreview extends StatefulWidget {
  const _WaveformPreview();
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
