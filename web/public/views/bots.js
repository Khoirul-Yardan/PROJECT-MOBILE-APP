import { h, icon } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';

export default async function render(root) {
  const el = h(`<div class="page bots-page">
    <div class="topbar"><h1>Bot</h1></div>
    <section class="card task-panel">${icon('document')}<h2>Bot BPJS</h2>
      <p>Ubah percakapan perawat–pasien menjadi draf dokumentasi.</p>
      <ol class="workflow"><li>Persiapan</li><li>Rekam</li><li>Periksa draf</li><li>Ekspor</li></ol>
      <p class="notice">Hasil merupakan draf yang perlu diverifikasi dokter.</p>
      <p id="native-note" class="muted small">${Native.attached ? 'Mikrofon diaktifkan setelah identitas sesi dilengkapi.' : 'Perekaman tersedia di aplikasi mobile.'}</p>
      <button id="start" class="btn btn-primary" ${Native.attached ? '' : 'disabled'} aria-describedby="native-note">Mulai dokumentasi</button>
      <button id="history" class="btn btn-outline">Riwayat sesi</button>
      <p id="error" class="error-text" role="alert"></p>
    </section>
  </div>`);
  root.appendChild(el);
  el.querySelector('#history').onclick = () => navigate('/bpjs');
  el.querySelector('#start').onclick = async () => {
    const button = el.querySelector('#start'); button.disabled = true;
    const result = await Native.openBotBpjs();
    button.disabled = false;
    if (result === null) el.querySelector('#error').textContent = 'Layar perekaman belum dapat dibuka. Coba lagi.';
  };
}
