// Keep the chat composer inside the visible phone viewport when the keyboard
// resizes either only the visual viewport (iOS) or the whole WebView (Android).
export function mountMobileViewport() {
  const viewport = window.visualViewport;
  let restingHeight = window.innerHeight;
  let width = window.innerWidth;
  function sync() {
    if (width !== window.innerWidth) {
      width = window.innerWidth;
      restingHeight = window.innerHeight;
    }
    const height = viewport?.height || window.innerHeight;
    restingHeight = Math.max(restingHeight, window.innerHeight, height);
    const editing = document.activeElement?.matches('input:not([type="checkbox"]),textarea,[contenteditable="true"]');
    const phone = matchMedia('(max-width: 1023px)').matches;
    const keyboard = phone && editing && restingHeight - height > 140 && (viewport?.scale || 1) < 1.1;
    document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--viewport-top', `${viewport?.offsetTop || 0}px`);
    document.body.classList.toggle('keyboard-open', !!keyboard);
  }
  viewport?.addEventListener('resize', sync);
  viewport?.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);
  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', () => requestAnimationFrame(sync));
  window.addEventListener('hashchange', sync);
  sync();
}
