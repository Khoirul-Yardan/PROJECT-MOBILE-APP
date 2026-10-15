"""Render docs/simulasi-bpjs/simulasi.html jadi foto per langkah + video."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'Images' / 'UjiTest' / 'Simulasi'
OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'docs' / 'simulasi-bpjs' / 'simulasi.html').as_uri()
NAMES = ['perawat-buka-bot', 'isi-nama-pasien-dan-dokter', 'rekam-giliran-perawat', 'rekam-giliran-pasien',
         'proses-stt-dan-ringkasan', 'review-transkrip', 'review-ringkasan-ai-bisa-diedit', 'review-perbandingan', 'bagikan-ke-dokter']
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    ctx = b.new_context(viewport={'width': 1040, 'height': 940}, record_video_dir=str(OUT / '_v'), record_video_size={'width': 1040, 'height': 940})
    page = ctx.new_page(); page.goto(URL)
    for k, n in enumerate(NAMES):
        page.evaluate(f'show({k})'); page.wait_for_timeout(2600)
        page.screenshot(path=str(OUT / f'sim-{k+1:02d}-{n}.png'))
    video = page.video; ctx.close()
    video.save_as(str(OUT / 'sim-alur-bot-bpjs-perawat-pasien.webm'))
    b.close()
import shutil; shutil.rmtree(OUT / '_v', ignore_errors=True)
print(sorted(x.name for x in OUT.iterdir()))
