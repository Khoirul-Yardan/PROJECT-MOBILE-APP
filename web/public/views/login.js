import { h, toast, logoSvg } from '../ui.js';
import { signInWithEmail, signUpWithEmail } from '../db.js';
import { navigate } from '../router.js';

export default async function render(root) {
  let isRegister = false;
  let loading = false;

  document.body.classList.add('aurora');

  const el = h(`
    <div style="padding-top:36px;">
      <div class="brand-mark" style="margin-bottom:22px;">${logoSvg(44)}</div>
      <h1 id="title" class="gradient-text" style="font-size:28px;margin:0 0 8px;">Welcome back</h1>
      <p class="eyebrow" style="margin:0 0 18px;">ONE HUB. INFINITE POSSIBILITIES.</p>
      <p class="muted small" style="margin:0 0 26px;">Masuk dengan akun asli agar teman & chat tersimpan untukmu.</p>
      <div class="field">
        <label>Email</label>
        <input id="email" type="email" placeholder="you@example.com" />
      </div>
      <div class="field">
        <label>Password</label>
        <input id="password" type="password" placeholder="Minimal 6 karakter" />
      </div>
      <p id="error" class="error-text" style="display:none;"></p>
      <button id="submit" class="btn btn-primary">Sign in</button>
      <button id="toggle" class="btn btn-text" style="display:block;margin:14px auto 0;">
        Belum punya akun? Daftar
      </button>
    </div>
  `);
  root.appendChild(el);

  const titleEl = el.querySelector('#title');
  const submitEl = el.querySelector('#submit');
  const toggleEl = el.querySelector('#toggle');
  const errorEl = el.querySelector('#error');

  function refresh() {
    titleEl.textContent = isRegister ? 'Create your account' : 'Welcome back';
    submitEl.textContent = loading ? 'Menyimpan…' : isRegister ? 'Create account' : 'Sign in';
    submitEl.disabled = loading;
    toggleEl.textContent = isRegister
      ? 'Sudah punya akun? Masuk'
      : 'Belum punya akun? Daftar';
  }

  toggleEl.onclick = () => {
    isRegister = !isRegister;
    errorEl.style.display = 'none';
    refresh();
  };

  submitEl.onclick = async () => {
    const email = el.querySelector('#email').value.trim();
    const password = el.querySelector('#password').value;
    if (!email.includes('@')) {
      errorEl.textContent = 'Masukkan email yang valid.';
      errorEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'Password minimal 6 karakter.';
      errorEl.style.display = 'block';
      return;
    }
    loading = true;
    errorEl.style.display = 'none';
    refresh();
    try {
      const { error, data } = isRegister
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      if (error) throw error;
      if (!data.session) {
        errorEl.textContent = isRegister
          ? 'Akun dibuat. Cek email untuk konfirmasi, lalu masuk.'
          : 'Tidak bisa masuk.';
        errorEl.style.display = 'block';
        return;
      }
      toast('Berhasil masuk.');
      navigate('/home');
    } catch (e) {
      errorEl.textContent = e.message || String(e);
      errorEl.style.display = 'block';
    } finally {
      loading = false;
      refresh();
    }
  };

  refresh();

  return {
    dispose: () => document.body.classList.remove('aurora'),
  };
}
