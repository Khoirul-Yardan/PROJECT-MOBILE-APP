import { h, toast, logoSvg } from '../ui.js';
import { signInWithEmail, signUpWithEmail } from '../db.js';
import { navigate } from '../router.js';

export default async function render(root) {
  let isRegister = false;
  let loading = false;

  const el = h(`
    <div class="page card login-page">
      <div class="brand-mark login-brand">${logoSvg(40)}<span>AI Hub</span></div>
      <h1 id="title" class="login-title">Masuk</h1>
      <p class="muted login-intro">Gunakan akun asli agar percakapan, teman, dan sesi tersimpan aman untukmu.</p>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" placeholder="nama@instansi.go.id" />
      </div>
      <div class="field">
        <label for="password">Kata sandi</label>
        <input id="password" type="password" placeholder="Minimal 6 karakter" />
      </div>
      <p id="error" class="error-text" role="alert" style="display:none;"></p>
      <button id="submit" class="btn btn-primary">Masuk</button>
      <button id="toggle" class="btn btn-text login-toggle">
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
    titleEl.textContent = isRegister ? 'Buat akun' : 'Masuk';
    submitEl.textContent = loading ? 'Menyimpan…' : isRegister ? 'Buat akun' : 'Masuk';
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

  return {};
}
