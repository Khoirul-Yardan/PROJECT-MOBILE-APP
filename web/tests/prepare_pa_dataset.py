"""Prepare fictional recording worksheets, NEVER measured results. Stdlib only."""
import csv
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'docs' / 'PAKET-UJI-PA'


def write_csv(name, columns, rows):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def main():
    data = json.loads((OUT / 'skenario.json').read_text(encoding='utf-8'))
    manifest, assignments, facts, measurements = [], [], [], []
    text = ['# Naskah simulasi fiktif', '', 'Draf untuk ditinjau perawat/dosen. Bukan transkrip referensi final: setelah direkam, cocokkan kata demi kata dengan audio.', '']
    for index, scenario in enumerate(data['scenarios']):
        text += [f"## {scenario['id']} — {scenario['title']}", '', f"Fokus: {scenario['focus']}", '', scenario.get('direction', 'Dua pemeran dewasa: perawat dan pasien.'), '']
        for turn, (role, utterance) in enumerate(scenario['turns'], 1):
            text.append(f'{turn}. **{role.title()}:** {utterance}')
        text += ['', 'Fakta acuan skenario (wajib dicocokkan lagi dengan rekaman):', '']
        for number, (turn, fact) in enumerate(scenario['facts'], 1):
            assert 1 <= turn <= len(scenario['turns'])
            fid = f"{scenario['id']}-F{number:02}"
            facts.append(dict(scenario_id=scenario['id'], fact_id=fid, turn=turn, role=scenario['turns'][turn-1][0], fact=fact))
            text.append(f'- {fid}: {fact} (giliran {turn}).')
        text += ['', 'Belum diketahui: ' + '; '.join(scenario['unknown']) + '.', '', 'Kesalahan yang harus dicari: ' + '; '.join(scenario['traps']) + '.', '']
        for cindex, condition in enumerate(['C0-tenang', 'C1-kipas', 'C2-pelan-jarak']):
            rid = f"{scenario['id']}-{condition[:2]}"
            row_number = index * 3 + cindex
            manifest.append(dict(recording_id=rid, scenario_id=scenario['id'], speaker_pair=f'P{index % 3 + 1:02}', condition=condition,
                                 suggested_order=(cindex-index % 3) % 3 + 1, audio_file='', sha256='', duration_s='', device='', distance_cm='', noise_description='', recorded_at='', reference_checked_by=''))
            for arm, reviewer in [('baseline', row_number % 6 + 1), ('proposed', (row_number + 3) % 6 + 1)]:
                assignments.append(dict(recording_id=rid, condition=arm, reviewer=f'N{reviewer:02}', order='', status='belum diuji'))
                measurements.append(dict(recording_id=rid, condition=arm, reviewer=f'N{reviewer:02}', status='belum diuji'))
    (OUT / 'NASKAH-SIMULASI.md').write_text('\n'.join(text) + '\n', encoding='utf-8')
    write_csv('manifest-rekaman.csv', list(manifest[0]), manifest)
    write_csv('penugasan.csv', list(assignments[0]), assignments)
    write_csv('fakta-acuan.csv', list(facts[0]), facts)
    write_csv('hasil-kosong.csv', ['recording_id','condition','reviewer','status','stt_model','llm_model','prompt_version','commit','stt_s','llm_s','editing_s','total_s','wer_S','wer_D','wer_I','wer_N','facts_present','facts_total','claims_supported','claims_contradicted','claims_unsupported','content_score_0_3','corrections_count','failure_reason'], measurements)
    write_csv('penilaian-klaim-kosong.csv', ['recording_id','condition','stage','rater','claim_id','claim_text','reference_turn','label_supported_contradicted_unsupported','comment'], [])
    write_csv('penilaian-fakta-kosong.csv', ['recording_id','condition','stage','rater','fact_id','present_0_1','comment'], [])
    assert len(manifest) == 36 and len(assignments) == 72
    print(f'Prepared {len(data["scenarios"])} fictional scenarios, {len(manifest)} planned recordings, {len(assignments)} blank comparisons. No measured results.')


if __name__ == '__main__':
    main()
