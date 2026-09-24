import { h, header, toast } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';
import { PROVIDERS } from '../ai.js';

export default async function render(root) {
  const el = h(`<div></div>`);
  el.appendChild(header('AI Provider API Keys', { back: true }));
  root.appendChild(el);

  for (const [id, info] of Object.entries(PROVIDERS)) {
    const has = await Native.hasApiKey(id);
    const card = h(`
      <div class="card" style="margin-bottom:12px;">
        <div class="row-between">
          <label style="margin:0;">${info.label}</label>
          ${has?.has ? '<span class="pill pill--ok">Saved</span>' : ''}
        </div>
        <div class="field" style="margin-top:10px;margin-bottom:0;">
          <input type="password" placeholder="Enter your API key" data-key="${id}" />
        </div>
        <button class="btn btn-outline" style="margin-top:10px;" data-save="${id}">Save</button>
      </div>
    `);
    card.querySelector(`[data-save="${id}"]`).onclick = async () => {
      const value = card.querySelector(`[data-key="${id}"]`).value.trim();
      if (!value) {
        toast('Enter an API key, or leave it blank to skip.');
        return;
      }
      await Native.saveApiKey(id, value);
      await logActivity({ category: 'AI', title: 'API key saved', subtitle: info.label, badge: 'Success' });
      toast(`${info.label} key saved.`);
      card.querySelector(`[data-key="${id}"]`).value = '';
      card.querySelector('.row-between').insertAdjacentHTML('beforeend', '<span class="pill pill--ok">Saved</span>');
    };
    el.appendChild(card);
  }

  el.appendChild(
    h(`
    <p class="muted small">
      Keys are stored on this device (Keystore/Keychain) and sent directly to the
      provider you pick — never to AI Hub servers.
    </p>
  `)
  );
}
