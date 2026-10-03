import { h, toast, logoSvg } from '../ui.js';
import { signInWithEmail, signUpWithEmail } from '../db.js';
import { navigate } from '../router.js';

export default async function render(root) {
  let isRegister = false;
  let loading = false;

  const el = h(`
    <form class="page card login-page">
      <div class="brand-mark login-brand">${logoSvg(40)}<span>AI Hub</span></div>
      <p class="login-tagline">Satu aplikasi untuk AI, agen, kolaborasi, dan akses aman.</p>
      <h1 id="title" class="login-title">Masuk</h1>
      <p class="muted login-intro">Masuk untuk menggunakan layanan AI dan mengelola dokumentasi Anda.</p>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" placeholder="nama@instansi.go.id" />
      </div>
      <div class="field">
        <label for="password">Kata sandi</label>
        <input id="password" type="password" autocomplete="current-password" placeholder="Kata sandi" />
      </div>
      <p id="error" class="error-text" role="alert" style="display:none;"></p>
      <button id="submit" class="btn btn-primary">Masuk</button>
      <button type="button" id="toggle" class="btn btn-text login-toggle">
        Belum punya akun? Daftar
      </button>
    </form>
  `);
  root.appendChild(el);

  const titleEl = el.querySelector('#title');
  const submitEl = el.querySelector('#submit');
  const toggleEl = el.querySelector('#toggle');
  const errorEl = el.querySelector('#error');

  function refresh() {
    titleEl.textContent = isRegister ? 'Buat akun' : 'Masuk';
    submitEl.textContent = loading ? (isRegister ? 'Membuat akun…' : 'Sedang masuk…') : isRegister ? 'Buat akun' : 'Masuk';
    submitEl.disabled = loading;
    toggleEl.disabled = loading;
    el.querySelector('#password').autocomplete = isRegister ? 'new-password' : 'current-password';
    toggleEl.textContent = isRegister
      ? 'Sudah punya akun? Masuk'
      : 'Belum punya akun? Daftar';
  }

  toggleEl.onclick = () => {
    isRegister = !isRegister;
    errorEl.style.display = 'none';
    refresh();
  };

  el.onsubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const email = el.querySelector('#email').value.trim();
    const password = el.querySelector('#password').value;
    if (!email.includes('@')) {
      errorEl.textContent = 'Masukkan email yang valid.';
      errorEl.style.display = 'block';
      return;
    }
    if (!password || (isRegister && password.length < 6)) {
      errorEl.textContent = isRegister ? 'Kata sandi minimal 6 karakter.' : 'Isi kata sandi.';
      errorEl.style.display = 'block';
      return;
    }
    loading = true;
    errorEl.className = 'error-text';
    errorEl.style.display = 'none';
    refresh();
    try {
      const { error, data } = isRegister
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      if (error) throw error;
      if (!data.session) {
        errorEl.className = isRegister ? 'notice' : 'error-text';
        errorEl.textContent = isRegister
          ? 'Periksa email Anda. Akun dibuat; konfirmasi email sebelum masuk.'
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
