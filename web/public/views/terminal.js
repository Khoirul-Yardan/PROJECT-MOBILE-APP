import { h, header, icon, pageIntro, toast } from '../ui.js';
import { Native } from '../bridge.js';

// An interactive SSH shell needs a real TCP socket, which this WebView page
// can't open itself — the actual terminal is 100% native (dartssh2 + xterm,
// see terminal_screen.dart). This page is just the door to it.
export default async function render(root) {
  const el = h(`<div class="page terminal-page"></div>`);
  el.appendChild(header('Terminal', { back: true }));
  el.appendChild(
    pageIntro(
      'Akses server lewat SSH.',
      'Biasanya server yang sama yang kamu tuju lewat tunnel VPN — hubungkan VPN dulu kalau servernya ada di jaringan privat.',
      { art: 'vpn', label: 'AKSES SERVER', tone: 'intro-mint' }
    )
  );
  el.appendChild(
    h(`
      <button type="button" class="card tappable" id="open-terminal" style="text-align:left;">
        <div class="row">
          <span class="feature-icon">${icon('layers')}</span>
          <div class="grow">
            <div class="item-title">Buka Terminal</div>
            <div class="muted small">Masuk dengan host/username + password atau private key.</div>
          </div>
          <span>›</span>
        </div>
      </button>
    `)
  );
  el.appendChild(
    h(`
      <p class="muted small" style="margin-top:14px;">
        Terminal ini tersambung langsung ke server tujuan — perintah yang kamu jalankan sungguhan,
        bukan simulasi. Tidak ada yang dijalankan otomatis dari sisi AI Hub.
      </p>
    `)
  );
  root.appendChild(el);

  el.querySelector('#open-terminal').onclick = async () => {
    // Unlike get_vpn_config/vpn_connect, there's no meaningful browser-only
    // fallback for an interactive SSH shell — Native.openTerminal() silently
    // resolves null with no native shell attached (see bridge.js's
    // devFallback), which otherwise looks exactly like a dead button.
    if (!Native.attached) {
      toast('Terminal cuma jalan di aplikasi Android terpasang — preview browser tidak punya socket SSH asli.');
      return;
    }
    await Native.openTerminal();
  };
}
