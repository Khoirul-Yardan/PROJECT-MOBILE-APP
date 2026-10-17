"""E2E layar VPN, Terminal, dan Riwayat Bot BPJS terhadap web di Docker.

Profil VPN diambil dari server tiruan di `TEST VPN/` (WireGuard + OpenVPN +
SSH, semuanya Docker). Data Supabase diganti fixture. Screenshot ->
Images/UjiTest/.  Run: python web/tests/e2e_vpn_bpjs.py
"""
from pathlib import Path
import json, re, sys
from playwright.sync_api import sync_playwright
import e2e_docker as e
from e2e_docker import ORIGIN, SHOTS, check

ROOT = Path(__file__).resolve().parents[2]
WG = (ROOT / 'TEST VPN' / 'wireguard' / 'out' / 'client.conf').read_text(encoding='utf-8')
OVPN_PATH = ROOT / 'TEST VPN' / 'docker' / 'out' / 'kp-la-test.ovpn'


def wg(field):
    return re.search(rf'^{field}\s*=\s*(.+)$', WG, re.M).group(1).strip()


PROFILES = [
    dict(id='vpn_wg', name='WireGuard Docker', protocol='WireGuard', privateKey=wg('PrivateKey'),
         publicKey=wg('PublicKey'), presharedKey=wg('PresharedKey'), endpoint=wg('Endpoint'),
         allowedIPs=wg('AllowedIPs'), dns=''),
    dict(id='vpn_ovpn', name='OpenVPN Docker', protocol='OpenVPN', ovpnSource=OVPN_PATH.read_text(encoding='utf-8'),
         ovpnFileName='kp-la-test.ovpn', username='tester', password='tester123', keyPassword='keypass123'),
    dict(id='vpn_ssh', name='SSH Docker', protocol='SSH', host='127.0.0.1', port='2222', username='tester', password='tester123'),
]

SESSIONS = [
    dict(id='s1', pasien_nama='Joko Santoso', dokter_nama='dr. Budi Hartono', dokter_instansi='RS Ahmad Yani Surabaya',
         status='terkirim', created_at='2026-10-13T08:15:00Z'),
    dict(id='s2', pasien_nama='Siti Aminah', dokter_nama='dr. Budi Hartono', dokter_instansi='RS Ahmad Yani Surabaya',
         status='siap_dikirim', created_at='2026-10-13T09:40:00Z'),
    dict(id='s3', pasien_nama='Agus Wibowo', dokter_nama='dr. Rina Putri', dokter_instansi='Puskesmas Wonokromo',
         status='processing', created_at='2026-10-14T07:05:00Z'),
]
DOC = dict(
    dokumentasi_terstruktur={
        'ringkasan': 'Pasien laki-laki 54 tahun datang dengan keluhan nyeri dada kiri sejak 3 hari, memberat saat aktivitas.',
        'keluhan_utama': 'Nyeri dada kiri seperti ditekan, menjalar ke lengan kiri.',
        'durasi_gejala': '3 hari, memberat saat naik tangga, membaik saat istirahat.',
        'riwayat_kesehatan': 'Hipertensi 5 tahun, tidak rutin minum obat. Perokok aktif. Tidak ada alergi obat.',
        'hasil_anamnesis': 'Nyeri hilang timbul, sesak ringan saat nyeri, tidak ada demam, tidak ada mual.',
    },
    generated_by_llm_provider='ChatGPT (gpt-4o-mini)',
    perbandingan=dict(durasi_audio_ms=96000, stt_kata=212, stt_segmen=14, stt_waktu_ms=11400, llm_provider='ChatGPT',
                      llm_kata=96, llm_waktu_ms=4300, rasio_ringkas=0.45, pembicara_terdeteksi=2, relabel_llm=False),
)
TRANSCRIPT = [
    ('perawat', 'Selamat pagi Pak Joko, ada keluhan apa hari ini?'),
    ('pasien', 'Dada kiri saya nyeri, Sus, sudah tiga hari ini.'),
    ('perawat', 'Nyerinya seperti apa? Menjalar ke mana?'),
    ('pasien', 'Seperti ditekan, sampai ke lengan kiri. Kalau naik tangga makin berat.'),
    ('perawat', 'Ada riwayat darah tinggi atau alergi obat?'),
    ('pasien', 'Darah tinggi sudah lima tahun, obatnya tidak rutin. Alergi tidak ada.'),
]


def db_with(overrides):
    """DB fixture dengan beberapa fungsi diganti data uji."""
    base = e.DB
    for name in overrides:
        base = re.sub(rf'^export const {name} = .*$', '', base, flags=re.M)
    return base + '\n' + '\n'.join(f'export const {n} = async () => ({json.dumps(v)});' for n, v in overrides.items())


def open_page(browser, overrides=None, seed_vpn=True, width=390):
    page, errs = e.new_page(browser, 'sk-proj-fixture', width=width)
    db = db_with(overrides or {})
    inner = page.context  # route paling baru menang: pasang ulang pengganti db.js
    def db_route(route):
        route.fulfill(content_type='text/javascript', body=db)
    page.route(re.compile(r'.*/db\.js(\?.*)?$'), db_route)
    if seed_vpn:
        state = dict(profiles=PROFILES, activeId='vpn_wg')
        flat = dict(PROFILES[0], profiles=PROFILES, activeId='vpn_wg')
        page.add_init_script(f"localStorage.setItem('aihub_dev_vpn_config', {json.dumps(json.dumps(flat))});")
    return page, errs


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')

        # ---- VPN ----
        page, errs = open_page(browser, seed_vpn=False)
        page.goto(f'{ORIGIN}/#/vpn'); page.locator('.vpn-page').wait_for(); page.wait_for_timeout(800)
        page.screenshot(path=str(SHOTS / '10-vpn-belum-ada-server.png'))
        check('VPN: kondisi kosong menyuruh tambah server', 'Belum ada server' in page.locator('.vpn-page').inner_text())
        page.goto(f'{ORIGIN}/#/vpn-config'); page.wait_for_timeout(800)
        page.screenshot(path=str(SHOTS / '11-vpn-tambah-server-pilih-protokol.png'))
        page.context.close()

        page, errs = open_page(browser)
        page.goto(f'{ORIGIN}/#/vpn'); page.locator('.vpn-page').wait_for(); page.wait_for_timeout(1000)
        page.screenshot(path=str(SHOTS / '12-vpn-3-profil-wireguard-openvpn-ssh.png'))
        txt = page.locator('.vpn-page').inner_text()
        check('VPN: tiga profil Docker (WireGuard, OpenVPN, SSH) terdaftar',
              all(n in txt for n in ('WireGuard Docker', 'OpenVPN Docker', 'SSH Docker')))
        page.locator('#connect-btn').click(); page.wait_for_timeout(900)
        page.screenshot(path=str(SHOTS / '13-vpn-connect-SIMULASI-browser-bukan-tunnel-asli.png'))
        check('VPN: browser mengaku simulasi (bukan tunnel asli)', 'simulasi' in page.locator('#vpn-note').inner_text().lower())
        page.locator('[data-id="vpn_ssh"]').click(); page.wait_for_timeout(300)
        # sedang "terhubung" -> pindah profil harus ditolak
        page.locator('[data-id="vpn_ssh"]').click(); page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / '14-vpn-pindah-profil-saat-terhubung-ditolak.png'))
        check('VPN: pindah profil saat terhubung ditolak', 'Putuskan koneksi dulu' in page.locator('body').inner_text())
        page.locator('#connect-btn').click(); page.wait_for_timeout(600)
        page.locator('[data-id="vpn_ssh"]').click(); page.wait_for_timeout(800)
        page.screenshot(path=str(SHOTS / '15-vpn-profil-ssh-aktif.png'))
        # Catatan "SSH belum ada tunnel asli" hanya muncul di app (shell native), bukan di preview browser.
        check('VPN: profil SSH menjadi aktif', 'SSH Docker' in page.locator('#server-text').inner_text())
        page.goto(f'{ORIGIN}/#/vpn-config'); page.wait_for_timeout(900)
        page.screenshot(path=str(SHOTS / '16-vpn-daftar-profil-pengaturan.png'))
        check('VPN: tidak ada JS error', not errs, str(errs))
        page.context.close()

        # ---- Terminal ----
        page, errs = open_page(browser, seed_vpn=False)
        page.goto(f'{ORIGIN}/#/terminal'); page.locator('.terminal-page').wait_for(); page.wait_for_timeout(700)
        page.screenshot(path=str(SHOTS / '20-terminal-halaman-pintu-masuk.png'))
        page.locator('#open-terminal').click(); page.wait_for_timeout(700)
        page.screenshot(path=str(SHOTS / '21-terminal-di-browser-ditolak-jujur-hanya-di-app.png'))
        check('Terminal: browser memberi pesan jujur (hanya di app Android)', 'aplikasi Android' in page.locator('body').inner_text())
        page.context.close()

        # ---- Riwayat Bot BPJS ----
        # bpjs-review.js now loads every document/transcript at once (fetchAll*) and groups by session_id.
        ov = dict(fetchNurseBpjsSessions=SESSIONS, fetchBpjsDocument=DOC,
                  fetchBpjsTranscript=[dict(speaker=s, text_segment=t) for s, t in TRANSCRIPT],
                  fetchAllBpjsDocuments=[dict(DOC, session_id=x['id']) for x in SESSIONS],
                  fetchAllBpjsTranscripts=[dict(session_id=x['id'], speaker=s, text_segment=t, timestamp_offset_ms=i * 1000)
                                           for x in SESSIONS for i, (s, t) in enumerate(TRANSCRIPT)])
        page, errs = open_page(browser, ov, seed_vpn=False)
        page.goto(f'{ORIGIN}/#/bpjs'); page.locator('.bpjs-review-page').wait_for(); page.wait_for_timeout(800)
        page.screenshot(path=str(SHOTS / '30-bpjs-riwayat-3-sesi-status-berbeda.png'))
        txt = page.locator('.bpjs-review-page').inner_text()
        check('BPJS riwayat: 3 sesi dengan status Sudah Dikirim/Siap Dikirim/Diproses',
              all(x in txt.lower() for x in ('sudah dikirim', 'siap dikirim', 'diproses')))
        page.locator('.bpjs-open').first.click(); page.wait_for_timeout(900)
        page.add_style_tag(content='.web-nav{display:none!important}'); page.screenshot(path=str(SHOTS / '31-bpjs-detail-sesi-ringkasan-ai-stt-banding.png'), full_page=True)
        det = page.locator('.bpjs-detail-page').inner_text()
        check('BPJS detail: ringkasan AI + STT per pembicara + perbandingan tampil',
              all(x in det for x in ('Hasil 2', 'Hasil 1', 'Perbandingan')))
        page.get_by_text('Ekspor PDF').click(); page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / '32-bpjs-ekspor-pdf-di-browser-ditolak-jujur.png'))
        check('BPJS: ekspor file di browser ditolak jujur', 'aplikasi terpasang' in page.locator('body').inner_text())
        check('BPJS: tidak ada JS error', not errs, str(errs))
        page.context.close()
        browser.close()
    fails = [r for r in e.results if not r[1]]
    print(f'\n{len(e.results) - len(fails)}/{len(e.results)} lulus')
    (SHOTS / 'hasil-vpn-bpjs.json').write_text(json.dumps(e.results, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
