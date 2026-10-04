// Lightweight, local SVG artwork: crisp at any screen density, no network fetch.
// Each illustration is decorative; the adjacent card title names the feature.
const ART = {
  providers: `<path fill="#195d61" d="m57 101 81-33 51 28-80 35z"/>
    <path fill="#fffdf1" d="m57 94 81-33 51 28-80 35z"/>
    <path fill="#55b5ac" d="m61 87 4-49 79-25-3 48z"/>
    <path fill="#daf2e9" d="m71 73 2-27 61-20-2 29z"/>
    <path d="m82 62 1-9m12 5 1-15m12 11 1-20m12 16 1-12" stroke="#257777" stroke-width="5"/>
    <path d="m88 96 44-17m-32 24 44-17"/>
    <path fill="#ffe08a" d="m157 60 20-8 14 8v24l-21 9-13-8z"/>
    <path d="m157 60 14 8 20-8m-20 8v25"/>
    <path fill="#fffdf1" d="m181 30 3-9 4 7 9 3-8 4-3 9-3-8-8-3z"/>`,
  chat: `<path fill="#195d61" d="m58 100 88-31 49 24-89 34z"/>
    <path fill="#fffdf1" d="m58 94 88-31 49 24-89 34z"/>
    <path fill="#63b7c7" d="M61 84V36l84-21v50z"/>
    <path fill="#d9eef6" d="M70 70V43l66-17v31z"/>
    <path d="m81 49 39-10m-39 19 26-7m-18 42 42-15m-32 22 42-15"/>
    <path fill="#fff5bc" d="M148 39q0-8 8-8h34q8 0 8 8v22q0 8-8 8h-18l-14 12V69h-2q-8 0-8-8z"/>
    <path d="M159 45h27m-27 10h18"/>
    <path fill="#f5bcad" d="m45 55 3-8 3 7 8 3-7 3-3 8-3-7-8-3z"/>`,
  bot: `<ellipse cx="126" cy="119" rx="60" ry="10" fill="#a6d5c5" stroke="none"/>
    <path fill="#176b70" d="m83 109 45-20 40 19-43 21z"/>
    <path fill="#fffdf1" d="m91 75 36-13 30 15v29l-34 14-32-16z"/>
    <path fill="#ffc964" d="m91 75 33 16 33-14-30-15z"/>
    <path fill="#fffdf1" d="M91 37q0-10 10-10h45q10 0 10 10v35q0 10-10 10h-45q-10 0-10-10z"/>
    <rect x="101" y="40" width="45" height="26" rx="9" fill="#27868a"/>
    <path d="M113 50v6m20-6v6" stroke="#fffdf1" stroke-width="4"/>
    <path d="M122 27V17m-39 31v16m81-16v16m-57 35 10 5m21-8 8-3"/>
    <circle cx="122" cy="14" r="5" fill="#ffc964"/>
    <path fill="#ffc964" d="m182 38 3-9 4 8 9 3-8 4-4 9-3-8-9-4z"/>`,
  vpn: `<path fill="#195d61" d="m62 105 73-30 49 26-73 30z"/>
    <path fill="#fffdf1" d="m62 97 73-30 49 26-73 30z"/>
    <path fill="#74b5bf" d="m98 31 35-12 35 16-3 41q-3 23-36 38-33-20-33-44z"/>
    <path fill="#e6f3df" d="m106 38 27-9 26 12-2 34q-2 16-28 30-25-16-25-35z"/>
    <rect x="118" y="57" width="28" height="26" rx="5" fill="#ffda7c"/>
    <path d="M123 57v-8a9 9 0 0 1 18 0v8m-9 11v6"/>
    <path d="m62 51 11 5m-6-20 9 9m-23 21 15-1m116 7 8-5m-10 19 13-2"/>`,
};

export function illustration(kind) {
  return `<span class="card-art art-${kind}" aria-hidden="true"><svg viewBox="0 0 250 145" fill="none" stroke="#263b3c" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" focusable="false">${ART[kind] || ART.chat}</svg></span>`;
}
