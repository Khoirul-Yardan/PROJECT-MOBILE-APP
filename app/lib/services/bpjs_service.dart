import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:docx_creator/docx_creator.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import 'supabase_service.dart';

/// Decrypts an `api_credentials` row the same way web/public/credentials.js
/// encrypted it (PBKDF2-SHA256 → AES-GCM-256), so Bot BPJS can call the
/// nurse's already-connected AI provider/agent natively without a second
/// "paste your key again" step. Mirrors that file byte-for-byte: same
/// pepper/salt/iteration count, so a key saved from the web Settings page
/// decrypts correctly here and vice versa.
class _CredentialCrypto {
  static const _pepper = 'aihub-credentials-v1';
  static const _salt = 'ai-hub-static-salt';

  static Future<SecretKey> _deriveKey(String uid) async {
    final pbkdf2 = Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: 100000,
      bits: 256,
    );
    return pbkdf2.deriveKeyFromPassword(
      password: uid + _pepper,
      nonce: utf8.encode(_salt),
    );
  }

  static Future<String> decrypt(
    String uid,
    String encryptedKeyB64,
    String ivB64,
  ) async {
    final secretKey = await _deriveKey(uid);
    final algorithm = AesGcm.with256bits();
    final cipherBytes = base64Decode(encryptedKeyB64);
    // Web's AES-GCM ciphertext is [encrypted bytes][16-byte tag] appended —
    // `cryptography`'s SecretBox wants them split, same layout Web Crypto
    // produces so no byte-order conversion is needed, just a slice.
    final macBytes = cipherBytes.sublist(cipherBytes.length - 16);
    final actualCipher = cipherBytes.sublist(0, cipherBytes.length - 16);
    final secretBox = SecretBox(
      actualCipher,
      nonce: base64Decode(ivB64),
      mac: Mac(macBytes),
    );
    final clear = await algorithm.decrypt(secretBox, secretKey: secretKey);
    return utf8.decode(clear);
  }
}

/// One registered AI provider/agent credential, enough to place a chat
/// call — mirrors the shape `listCredentials()`/`getCredentialKey()`
/// return in web/public/credentials.js.
class BpjsAiCredential {
  BpjsAiCredential({
    required this.id,
    required this.label,
    required this.format,
    required this.endpoint,
    required this.model,
    required this.apiKey,
  });
  final String id;
  final String label;
  final String format; // 'openai' | 'anthropic' | 'gemini' | 'openclaw'
  final String endpoint;
  final String? model;
  final String apiKey;
}

/// Native-side mirror of ai.js + credentials.js, scoped to exactly what
/// Bot BPJS needs: find *a* connected provider (any one — the nurse picked
/// it once in Settings, this doesn't need to re-ask), and turn a transcript
/// into a structured BPJS-form-shaped draft.
class BpjsAiService {
  BpjsAiService._();

  /// Returns the first credential the signed-in user has connected, or
  /// null if none — Bot BPJS's processing step uses this to generate the
  /// documentation draft with whatever the nurse already set up in
  /// Settings → API & Agent, same account as the web layer.
  static Future<BpjsAiCredential?> firstAvailableCredential() async {
    final uid = SupabaseService.userId;
    if (uid == null) return null;
    try {
      final rows = await SupabaseService.client
          .from('api_credentials')
          .select('provider_id,label,format,endpoint,model,encrypted_key,iv')
          .eq('user_id', uid)
          .order('created_at')
          .limit(1);
      if (rows.isEmpty) return null;
      final row = rows.first;
      final apiKey = await _CredentialCrypto.decrypt(
        uid,
        row['encrypted_key'] as String,
        row['iv'] as String,
      );
      return BpjsAiCredential(
        id: row['provider_id'] as String,
        label: row['label'] as String,
        format: row['format'] as String? ?? 'openai',
        endpoint: row['endpoint'] as String,
        model: row['model'] as String?,
        apiKey: apiKey,
      );
    } catch (_) {
      return null;
    }
  }

  /// Sends the nurse-patient transcript to the connected LLM and asks for
  /// BPJS-form-shaped JSON back. Returns null on any failure (no
  /// credential, network error, malformed response) — caller falls back to
  /// a plain-text summary so the session still completes.
  static Future<Map<String, dynamic>?> generateDocumentation({
    required BpjsAiCredential credential,
    required String transcriptText,
  }) async {
    const systemPrompt =
        'Kamu asisten dokumentasi klinis untuk perawat. Dari transkrip '
        'percakapan perawat-pasien berikut, susun draf dokumentasi dalam '
        'format JSON PERSIS seperti ini, tanpa teks lain di luar JSON: '
        '{"ringkasan": "...", "keluhan_utama": "...", "durasi_gejala": "...", '
        '"riwayat_kesehatan": "...", "hasil_anamnesis": "..."}. '
        'Tulis dalam Bahasa Indonesia, ringkas, dan hanya berdasarkan isi '
        'transkrip — jangan mengarang data yang tidak disebutkan.';
    try {
      final replyText = await _callChat(
        credential: credential,
        systemPrompt: systemPrompt,
        userText: transcriptText,
      );
      if (replyText == null) return null;
      final jsonStart = replyText.indexOf('{');
      final jsonEnd = replyText.lastIndexOf('}');
      if (jsonStart == -1 || jsonEnd == -1 || jsonEnd <= jsonStart) {
        return {'ringkasan': replyText};
      }
      final parsed = jsonDecode(replyText.substring(jsonStart, jsonEnd + 1));
      return parsed is Map<String, dynamic> ? parsed : {'ringkasan': replyText};
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _callChat({
    required BpjsAiCredential credential,
    required String systemPrompt,
    required String userText,
  }) async {
    switch (credential.format) {
      case 'anthropic':
        return _callAnthropic(credential, systemPrompt, userText);
      case 'gemini':
        return _callGemini(credential, systemPrompt, userText);
      default:
        return _callOpenAiCompatible(credential, systemPrompt, userText);
    }
  }

  static Future<String?> _callOpenAiCompatible(
    BpjsAiCredential c,
    String systemPrompt,
    String userText,
  ) async {
    final res = await http
        .post(
          Uri.parse(c.endpoint),
          headers: {
            'Authorization': 'Bearer ${c.apiKey}',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'model': c.model,
            'messages': [
              {'role': 'system', 'content': systemPrompt},
              {'role': 'user', 'content': userText},
            ],
          }),
        )
        .timeout(const Duration(seconds: 30));
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final choices = body['choices'] as List?;
    if (choices == null || choices.isEmpty) return null;
    return ((choices.first as Map)['message'] as Map)['content'] as String?;
  }

  static Future<String?> _callAnthropic(
    BpjsAiCredential c,
    String systemPrompt,
    String userText,
  ) async {
    final res = await http
        .post(
          Uri.parse(c.endpoint),
          headers: {
            'x-api-key': c.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'model': c.model,
            'max_tokens': 1024,
            'system': systemPrompt,
            'messages': [
              {'role': 'user', 'content': userText},
            ],
          }),
        )
        .timeout(const Duration(seconds: 30));
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final content = body['content'] as List?;
    if (content == null || content.isEmpty) return null;
    return (content.first as Map)['text'] as String?;
  }

  static Future<String?> _callGemini(
    BpjsAiCredential c,
    String systemPrompt,
    String userText,
  ) async {
    final uri = Uri.parse('${c.endpoint}?key=${c.apiKey}');
    final res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'systemInstruction': {
              'parts': [
                {'text': systemPrompt},
              ],
            },
            'contents': [
              {
                'role': 'user',
                'parts': [
                  {'text': userText},
                ],
              },
            ],
          }),
        )
        .timeout(const Duration(seconds: 30));
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final candidates = body['candidates'] as List?;
    if (candidates == null || candidates.isEmpty) return null;
    final parts =
        ((candidates.first as Map)['content'] as Map)['parts'] as List?;
    if (parts == null || parts.isEmpty) return null;
    return (parts.first as Map)['text'] as String?;
  }
}

/// Database writes for one Bot BPJS session — thin wrapper so the screen
/// doesn't hand-roll Supabase calls inline. Mirrors schema.sql's
/// bpjs_sessions/bpjs_transcripts/bpjs_documents tables and their RLS:
/// every insert here only succeeds because the signed-in user is the
/// nurse and the target doctor is an accepted friend (enforced server-side,
/// not just assumed client-side).
class BpjsSessionRepo {
  BpjsSessionRepo._();

  static Future<String?> createSession({
    required String dokterNama,
    String? dokterInstansi,
    required String pasienNama,
  }) async {
    final uid = SupabaseService.userId;
    if (uid == null) return null;
    try {
      final row = await SupabaseService.client
          .from('bpjs_sessions')
          .insert({
            'perawat_id': uid,
            'dokter_nama': dokterNama,
            'dokter_instansi': dokterInstansi,
            'pasien_nama': pasienNama,
            'status': 'recording',
          })
          .select('id')
          .single();
      return row['id'] as String;
    } catch (_) {
      return null;
    }
  }

  static Future<void> addTranscriptSegment({
    required String sessionId,
    required String speaker, // 'perawat' | 'pasien'
    required String text,
    required int offsetMs,
  }) async {
    try {
      await SupabaseService.client.from('bpjs_transcripts').insert({
        'session_id': sessionId,
        'speaker': speaker,
        'text_segment': text,
        'timestamp_offset_ms': offsetMs,
      });
    } catch (_) {
      rethrow;
    }
  }

  static Future<void> saveDocumentation({
    required String sessionId,
    required Map<String, dynamic> structured,
    required List<Map<String, String>> alurPercakapan,
    String? providerId,
  }) async {
    try {
      await SupabaseService.client.from('bpjs_documents').insert({
        'session_id': sessionId,
        'ringkasan': structured['ringkasan'],
        'dokumentasi_terstruktur': structured,
        'alur_percakapan': alurPercakapan,
        'generated_by_llm_provider': providerId,
      });
    } catch (_) {
      rethrow;
    }
  }

  static Future<void> markStatus(String sessionId, String status) async {
    try {
      await SupabaseService.client
          .from('bpjs_sessions')
          .update({
            'status': status,
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', sessionId);
    } catch (_) {
      rethrow;
    }
  }
}

/// Builds the shareable output of one Bot BPJS session (plain text, PDF,
/// DOCX) from the same structured draft + transcript the review screen
/// shows — this is the actual deliverable: the nurse hands it to the named
/// doctor directly (copy/paste into WhatsApp/email, or share the file),
/// since there is no in-app doctor account to route it through anymore.
class BpjsExport {
  BpjsExport._();

  static String plainText({
    required String dokterNama,
    String? dokterInstansi,
    required String pasienNama,
    required DateTime createdAt,
    required Map<String, dynamic> structured,
    required List<Map<String, String>> transcript,
    String sessionReference = "",
    String providerLabel = "",
  }) {
    final buf = StringBuffer()
      ..writeln(
        providerLabel.isEmpty
            ? 'Transkrip mentah - belum disusun AI'
            : 'Draf AI - perlu verifikasi dokter',
      )
      ..writeln('Referensi: $sessionReference')
      ..writeln(
        'Penyusun: ${providerLabel.isEmpty ? 'Belum disusun AI' : providerLabel}',
      )
      ..writeln('DOKUMENTASI PERCAKAPAN PERAWAT-PASIEN')
      ..writeln(
        'Untuk: $dokterNama${dokterInstansi != null && dokterInstansi.isNotEmpty ? ' ($dokterInstansi)' : ''}',
      )
      ..writeln('Pasien: $pasienNama')
      ..writeln('Tanggal: ${createdAt.toLocal()}')
      ..writeln();
    for (final entry in structured.entries) {
      buf
        ..writeln(entry.key.replaceAll('_', ' ').toUpperCase())
        ..writeln('${entry.value}')
        ..writeln();
    }
    if (transcript.isNotEmpty) {
      buf.writeln('TRANSKRIP PERCAKAPAN:');
      for (final seg in transcript) {
        buf.writeln('Pembicara belum diverifikasi: ${seg['text']}');
      }
      buf.writeln();
    }
    buf.writeln(
      'Catatan: draf ini dibuat otomatis dan perlu diverifikasi oleh dokter sebelum digunakan sebagai dasar tindakan medis.',
    );
    return buf.toString();
  }

  static Future<Uint8List> buildPdf({
    required String dokterNama,
    String? dokterInstansi,
    required String pasienNama,
    required DateTime createdAt,
    required Map<String, dynamic> structured,
    required List<Map<String, String>> transcript,
    String sessionReference = "",
    String providerLabel = "",
  }) async {
    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        footer: (context) => pw.Text(
          'Referensi: $sessionReference | Halaman ${context.pageNumber} / ${context.pagesCount}',
          style: const pw.TextStyle(fontSize: 9),
        ),
        build: (context) => [
          pw.Text(
            providerLabel.isEmpty
                ? 'Transkrip mentah - belum disusun AI'
                : 'Draf AI - perlu verifikasi dokter',
          ),
          if (providerLabel.isNotEmpty) pw.Text('Penyusun: $providerLabel'),
          pw.Header(
            level: 0,
            child: pw.Text(
              'Dokumentasi Percakapan Perawat-Pasien',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold),
            ),
          ),
          pw.Text(
            'Untuk: $dokterNama${dokterInstansi != null && dokterInstansi.isNotEmpty ? ' ($dokterInstansi)' : ''}',
          ),
          pw.Text('Pasien: $pasienNama'),
          pw.Text('Tanggal: ${createdAt.toLocal()}'),
          pw.SizedBox(height: 12),
          ...structured.entries.expand(
            (e) => [
              pw.Text(
                e.key.replaceAll('_', ' ').toUpperCase(),
                style: pw.TextStyle(
                  fontWeight: pw.FontWeight.bold,
                  fontSize: 11,
                ),
              ),
              pw.Text('${e.value}'),
              pw.SizedBox(height: 8),
            ],
          ),
          if (transcript.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Text(
              'Transkrip Percakapan',
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 13),
            ),
            pw.SizedBox(height: 4),
            ...transcript.map(
              (seg) => pw.Text('Pembicara belum diverifikasi: ${seg['text']}'),
            ),
          ],
          pw.SizedBox(height: 16),
          pw.Text(
            'Catatan: draf ini dibuat otomatis dan perlu diverifikasi oleh dokter sebelum digunakan sebagai dasar tindakan medis.',
            style: pw.TextStyle(fontSize: 9, fontStyle: pw.FontStyle.italic),
          ),
        ],
      ),
    );
    return doc.save();
  }

  static Future<Uint8List> buildDocx({
    required String dokterNama,
    String? dokterInstansi,
    required String pasienNama,
    required DateTime createdAt,
    required Map<String, dynamic> structured,
    required List<Map<String, String>> transcript,
    String sessionReference = "",
    String providerLabel = "",
  }) async {
    final builder = DocxDocumentBuilder()
        .h1('Dokumentasi Percakapan Perawat-Pasien')
        .p(
          providerLabel.isEmpty
              ? 'Transkrip mentah - belum disusun AI'
              : 'Draf AI - perlu verifikasi dokter',
        )
        .p('Referensi: $sessionReference')
        .p(
          'Penyusun: ${providerLabel.isEmpty ? 'Belum disusun AI' : providerLabel}',
        )
        .p(
          'Untuk: $dokterNama${dokterInstansi != null && dokterInstansi.isNotEmpty ? ' ($dokterInstansi)' : ''}',
        )
        .p('Pasien: $pasienNama')
        .p('Tanggal: ${createdAt.toLocal()}')
        .p('');
    for (final entry in structured.entries) {
      builder
        ..h3(entry.key.replaceAll('_', ' ').toUpperCase())
        ..p('${entry.value}');
    }
    if (transcript.isNotEmpty) {
      builder.h2('Transkrip Percakapan');
      for (final seg in transcript) {
        builder.p('Pembicara belum diverifikasi: ${seg['text']}');
      }
    }
    builder.p('');
    builder.quote(
      'Draf ini dibuat otomatis dan perlu diverifikasi oleh dokter sebelum digunakan sebagai dasar tindakan medis.',
    );
    final built = builder.build();
    return Uint8List.fromList(await DocxExporter().exportToBytes(built));
  }

  /// Saves [bytes] to a temp file and opens the OS share sheet so the nurse
  /// can hand it off through WhatsApp, email, Drive, etc. — whichever app
  /// is already installed, no extra integration needed on this app's side.
  static Future<void> shareFile({
    required Uint8List bytes,
    required String filename,
    required String mimeSubject,
  }) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$filename');
    await file.writeAsBytes(bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], subject: mimeSubject),
    );
  }
}
