import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Stores the AssemblyAI API key on-device only (Keystore/Keychain) — same
/// storage class as VpnConfigService, same reasoning: this is a native-only
/// credential Bot BPJS needs for itself, not a chat provider the web layer
/// also calls, so it doesn't belong in the shared `api_credentials` table
/// (which assumes a chat/agent endpoint+model shape this isn't).
class AssemblyAiConfigService {
  AssemblyAiConfigService._();

  static const _storage = FlutterSecureStorage();
  static const _key = 'assemblyai_api_key';
  static const _timeout = Duration(seconds: 3);

  static Future<String?> load() async {
    try {
      return await _storage.read(key: _key).timeout(_timeout);
    } catch (_) {
      return null;
    }
  }

  static Future<void> save(String apiKey) async {
    try {
      await _storage.write(key: _key, value: apiKey).timeout(_timeout);
    } catch (_) {
      // Best-effort, same contract as VpnConfigService.
    }
  }
}

/// One diarized utterance from AssemblyAI, already mapped onto this app's
/// speaker vocabulary.
class DiarizedSegment {
  DiarizedSegment({required this.speaker, required this.text, required this.offsetMs});
  final String speaker; // 'perawat' | 'pasien'
  final String text;
  final int offsetMs;
}

/// Everything one STT pass produced — the diarized segments plus the raw
/// numbers Bot BPJS needs to compare "STT mentah" against "ringkasan LLM"
/// (word counts, speaker split, how long AssemblyAI took).
class SttResult {
  SttResult({
    required this.segments,
    required this.processingMs,
    required this.audioDurationMs,
    required this.speakersDetected,
  });
  final List<DiarizedSegment> segments;
  final int processingMs;
  final int audioDurationMs;

  /// How many distinct voices AssemblyAI itself reported, BEFORE any
  /// fallback. 1 means diarization collapsed (see Bot BPJS's LLM relabel).
  final int speakersDetected;

  String get plainText => segments.map((s) => s.text).join(' ');
}

/// Thrown when the relay-backed shared key isn't configured
/// (`ASSEMBLYAI_API_KEY` unset on the deployed relay — see
/// docs/ASSEMBLYAI-DIARIZATION.md) — the caller catches this specifically
/// and falls back to asking the nurse for her own AssemblyAI key instead of
/// surfacing a confusing network-looking error.
class AssemblyAiRelayNotConfiguredException implements Exception {
  @override
  String toString() => 'Kunci AssemblyAI bersama belum diset di server.';
}

/// Real speaker diarization via AssemblyAI — on-device `speech_to_text`
/// (what this replaced) has no concept of "who is speaking," only a live
/// transcript, so every segment used to get tagged 'perawat' by default.
/// AssemblyAI listens to the actual audio and tells speakers apart by voice,
/// which is the only way to get this right even for fast, overlapping
/// back-and-forth — see the recording flow in bot_bpjs_screen.dart, which
/// now captures a raw audio file instead of a live transcript and hands it
/// here once the session ends.
///
/// Two ways to reach AssemblyAI, same request/response shape either way:
///  - Relay-backed (`relayBaseUrl` set, `apiKey` null): calls this
///    deployment's own `/relay/assemblyai/*` routes (see
///    web/relay/server.js), which attach a server-held key — no per-device
///    setup needed. Throws [AssemblyAiRelayNotConfiguredException] if that
///    deployment hasn't set one.
///  - Direct (`apiKey` set, `relayBaseUrl` null): calls api.assemblyai.com
///    straight with the nurse's own key — the original behavior, still
///    used as the fallback when no relay key is configured.
class AssemblyAiService {
  AssemblyAiService._();

  static const _directBase = 'https://api.assemblyai.com/v2';

  static Future<SttResult> transcribeWithDiarization(
    File audioFile, {
    String? apiKey,
    String? relayBaseUrl,
  }) async {
    assert(
      (apiKey == null) != (relayBaseUrl == null),
      'Pass exactly one of apiKey (direct) or relayBaseUrl (shared key).',
    );
    final base = relayBaseUrl != null ? '$relayBaseUrl/relay/assemblyai' : _directBase;
    final headers = apiKey != null ? {'authorization': apiKey} : <String, String>{};
    final sw = Stopwatch()..start();
    final audioUrl = await _upload(audioFile, base, headers);
    final transcriptId = await _requestTranscript(audioUrl, base, headers);
    final done = await _pollUntilDone(transcriptId, base, headers);
    final utterances = done.utterances;
    return SttResult(
      segments: mapSpeakers(utterances),
      processingMs: sw.elapsedMilliseconds,
      audioDurationMs: done.audioDurationMs,
      speakersDetected: utterances.map((u) => u['speaker']).toSet().length,
    );
  }

  static Future<String> _upload(
    File file,
    String base,
    Map<String, String> headers,
  ) async {
    final res = await http
        .post(
          Uri.parse('$base/upload'),
          headers: headers,
          body: await file.readAsBytes(),
        )
        .timeout(const Duration(seconds: 60));
    if (res.statusCode == 503) throw AssemblyAiRelayNotConfiguredException();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Upload audio ke AssemblyAI gagal (${res.statusCode}).');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final url = body['upload_url'] as String?;
    if (url == null) throw Exception('AssemblyAI tidak mengembalikan upload_url.');
    return url;
  }

  static Future<String> _requestTranscript(
    String audioUrl,
    String base,
    Map<String, String> headers,
  ) async {
    final res = await http
        .post(
          Uri.parse('$base/transcript'),
          headers: {
            ...headers,
            'content-type': 'application/json',
          },
          // speaker_labels/language_code are redundant when `base` is the
          // relay (it fixes them server-side — see
          // handleAssemblyAiTranscriptCreate in web/relay/server.js) but
          // required for the direct-to-AssemblyAI path, which has no
          // server-side default for either.
          body: jsonEncode({
            'audio_url': audioUrl,
            'speaker_labels': true,
            // Percakapan klinis selalu 2 orang (perawat + pasien). Tanpa
            // hint ini AssemblyAI sering menebak 1 pembicara untuk audio
            // satu-mikrofon, sehingga semua teks jatuh ke 'perawat'.
            'speakers_expected': 2,
            'language_code': 'id',
            'punctuate': true,
            'format_text': true,
          }),
        )
        .timeout(const Duration(seconds: 30));
    if (res.statusCode == 503) throw AssemblyAiRelayNotConfiguredException();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Permintaan transkrip AssemblyAI gagal (${res.statusCode}).');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final id = body['id'] as String?;
    if (id == null) throw Exception('AssemblyAI tidak mengembalikan transcript id.');
    return id;
  }

  static Future<({List<Map<String, dynamic>> utterances, int audioDurationMs})> _pollUntilDone(
    String transcriptId,
    String base,
    Map<String, String> headers,
  ) async {
    final deadline = DateTime.now().add(const Duration(minutes: 5));
    while (DateTime.now().isBefore(deadline)) {
      await Future.delayed(const Duration(seconds: 3));
      final res = await http
          .get(
            Uri.parse('$base/transcript/$transcriptId'),
            headers: headers,
          )
          .timeout(const Duration(seconds: 30));
      if (res.statusCode == 503) throw AssemblyAiRelayNotConfiguredException();
      if (res.statusCode < 200 || res.statusCode >= 300) continue;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final status = body['status'] as String?;
      if (status == 'completed') {
        final durationMs = ((body['audio_duration'] as num?) ?? 0).toInt() * 1000;
        final utterances = body['utterances'] as List?;
        if (utterances == null || utterances.isEmpty) {
          // speaker_labels sometimes comes back empty for very short/quiet
          // audio even when transcription itself succeeded — fall back to
          // the flat transcript as one 'perawat' segment rather than
          // failing the whole session over it.
          final text = body['text'] as String?;
          if (text == null || text.trim().isEmpty) {
            return (utterances: <Map<String, dynamic>>[], audioDurationMs: durationMs);
          }
          return (
            utterances: <Map<String, dynamic>>[
              {'speaker': 'A', 'text': text, 'start': 0},
            ],
            audioDurationMs: durationMs,
          );
        }
        return (utterances: utterances.cast<Map<String, dynamic>>(), audioDurationMs: durationMs);
      }
      if (status == 'error') {
        throw Exception('AssemblyAI gagal memproses audio: ${body['error']}');
      }
      // 'queued' / 'processing' — keep polling.
    }
    throw Exception('AssemblyAI belum selesai memproses dalam 5 menit.');
  }

  @visibleForTesting
  static List<DiarizedSegment> mapSpeakers(List<Map<String, dynamic>> utterances) {
    String? firstSpeakerLabel;
    final segments = <DiarizedSegment>[];
    for (final u in utterances) {
      final label = u['speaker'] as String? ?? 'A';
      firstSpeakerLabel ??= label;
      final text = (u['text'] as String? ?? '').trim();
      if (text.isEmpty) continue;
      segments.add(DiarizedSegment(
        speaker: label == firstSpeakerLabel ? 'perawat' : 'pasien',
        text: text,
        offsetMs: (u['start'] as num?)?.toInt() ?? 0,
      ));
    }
    return segments;
  }

  /// Sentence-level split for the case AssemblyAI collapses everything into
  /// ONE speaker (common on a single phone mic) — gives the LLM relabel pass
  /// (BpjsAiService.relabelSpeakers) turn-sized pieces to classify instead
  /// of one giant paragraph. Splits after . ? ! and keeps the original
  /// offset for every piece (AssemblyAI gave no finer timing here).
  static List<DiarizedSegment> splitIntoSentences(List<DiarizedSegment> segments) {
    final out = <DiarizedSegment>[];
    final re = RegExp(r'[^.!?]+[.!?]*');
    for (final seg in segments) {
      for (final m in re.allMatches(seg.text)) {
        final t = m.group(0)!.trim();
        if (t.isEmpty) continue;
        out.add(DiarizedSegment(speaker: seg.speaker, text: t, offsetMs: seg.offsetMs));
      }
    }
    return out;
  }
}
