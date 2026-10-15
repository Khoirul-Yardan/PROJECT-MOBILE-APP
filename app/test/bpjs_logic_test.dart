import 'package:ai_hub/services/assemblyai_service.dart';
import 'package:ai_hub/services/bpjs_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('mapSpeakers: pembicara pertama = perawat, lainnya = pasien', () {
    final segs = AssemblyAiService.mapSpeakers([
      {'speaker': 'B', 'text': 'Ada keluhan apa, Bu?', 'start': 0},
      {'speaker': 'A', 'text': 'Pusing sejak kemarin.', 'start': 3000},
      {'speaker': 'B', 'text': 'Demam juga?', 'start': 6000},
      {'speaker': 'A', 'text': '  ', 'start': 7000},
    ]);
    expect(segs.map((s) => s.speaker), ['perawat', 'pasien', 'perawat']);
    expect(segs[1].offsetMs, 3000);
  });

  test('splitIntoSentences memecah satu blok menjadi kalimat', () {
    final pieces = AssemblyAiService.splitIntoSentences([
      DiarizedSegment(speaker: 'perawat', text: 'Keluhannya apa? Pusing. Sudah minum obat!', offsetMs: 500),
    ]);
    expect(pieces.map((p) => p.text), ['Keluhannya apa?', 'Pusing.', 'Sudah minum obat!']);
    expect(pieces.every((p) => p.offsetMs == 500), isTrue);
  });

  test('comparisonLines kosong tanpa metrik, terisi dengan metrik', () {
    expect(BpjsExport.comparisonLines(null), isEmpty);
    final lines = BpjsExport.comparisonLines({
      'durasi_audio_ms': 60000, 'stt_kata': 120, 'stt_segmen': 8, 'stt_waktu_ms': 9000,
      'llm_kata': 40, 'llm_waktu_ms': 3000, 'llm_provider': 'Hermes',
      'rasio_ringkas': '33%', 'pembicara_terdeteksi': 1, 'relabel_llm': true,
    });
    expect(lines.length, 5);
    expect(lines.join('\n'), contains('dikoreksi LLM'));
  });
}
