// Pembaca ringan untuk isi file .ovpn — hanya membaca teks di perangkat,
// tidak ada yang dikirim ke mana pun. Dipakai halaman Server VPN (pratinjau
// sebelum simpan) dan halaman Koneksi VPN (label server aktif).

export function analyzeOvpn(text) {
  const src = String(text || '');
  const lines = src.split(/\r?\n/).map((l) => l.trim());
  const remote = lines.find((l) => /^remote\s+/i.test(l));
  const [, host, port, proto] = remote ? remote.split(/\s+/) : [];
  const protoLine = lines.find((l) => /^proto\s+/i.test(l))?.split(/\s+/)[1];
  const val = (name) => lines.find((l) => new RegExp('^' + name + '\\s+', 'i').test(l))?.split(/\s+/)[1] ?? null;
  const protoName = String(proto || protoLine || 'udp').toUpperCase();
  return {
    valid: /^client\b/im.test(src) || !!remote,
    host: host || null,
    port: port || (host ? '1194' : null),
    proto: protoName,
    server: host ? `${host}:${port || '1194'} (${protoName})` : null,
    cipher: val('cipher'),
    auth: val('auth'),
    needsAuth: lines.some((l) => /^auth-user-pass\s*$/i.test(l)),
    encryptedKey: /BEGIN ENCRYPTED PRIVATE KEY|Proc-Type:\s*4,ENCRYPTED/i.test(src),
    hasCa: /<ca>/i.test(src),
    hasCert: /<cert>/i.test(src),
    hasKey: /<key>/i.test(src),
  };
}

/** Isi file untuk ditampilkan: blok sertifikat/key diganti ringkasan supaya
 * tidak membanjiri layar dan private key tidak pernah tampil. */
export function redactedPreview(text) {
  const blocks = {
    ca: 'sertifikat CA',
    cert: 'sertifikat klien',
    key: 'private key — disembunyikan',
    'tls-auth': 'tls-auth key',
    'tls-crypt': 'tls-crypt key',
  };
  let out = String(text || '');
  for (const [tag, label] of Object.entries(blocks)) {
    out = out.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'gi'), `<${tag}> … [${label}] … </${tag}>`);
  }
  return out
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .join('\n');
}

export function ovpnLabel(config) {
  const a = analyzeOvpn(config?.ovpnFileContent);
  const name = config?.ovpnFileName ? `${config.ovpnFileName} · ` : '';
  return a.server ? `${name}${a.server}` : `${name}File .ovpn tersimpan`;
}

/** Semua baris `remote` di file (satu file bisa memuat beberapa host). */
export function listRemotes(text) {
  const protoLine = String(text || '').split(/\r?\n/).map((l) => l.trim()).find((l) => /^proto\s+/i.test(l))?.split(/\s+/)[1];
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^remote\s+/i.test(l))
    .map((raw) => {
      const [, host, port, proto] = raw.split(/\s+/);
      const p = port || '1194';
      return { raw, host, port: p, proto: String(proto || protoLine || 'udp').toLowerCase(), key: `${host}:${p}` };
    });
}

/** Terapkan pilihan host: file hanya menyisakan SATU baris `remote` (yang
 * dipilih, atau host kustom `host[:port]`), jadi tunnel native selalu memakai
 * host itu. `choice` kosong = biarkan file apa adanya. */
export function applyRemote(text, choice) {
  const src = String(text || '');
  const remotes = listRemotes(src);
  if (!choice || remotes.length === 0) return src;
  let chosenLine;
  const found = remotes.find((r) => r.key === choice);
  if (found) {
    chosenLine = found.raw;
  } else {
    const [host, port] = String(choice).split(':');
    const base = remotes[0];
    const hasProtoDirective = /^proto\s+/im.test(src);
    chosenLine = `remote ${host} ${port || base.port}${hasProtoDirective ? '' : ' ' + base.proto}`;
  }
  let placed = false;
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*remote\s+/i.test(line)) {
      if (!placed) {
        out.push(chosenLine);
        placed = true;
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Isi .ovpn yang benar-benar dikirim ke tunnel untuk sebuah profil. */
export function effectiveOvpn(profile) {
  return applyRemote(profile?.ovpnSource ?? profile?.ovpnFileContent ?? '', profile?.remote);
}
