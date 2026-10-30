import { MOBILE_CONFIG as M, deviceProfile } from './mobileConfig.js';

export function createMobileUI({ lenis, onNavigate }) {
  const menu = document.querySelector('#mobile-menu'), toggle = document.querySelector('.menu-toggle');
  const header = document.querySelector('.header'), main = document.querySelector('main');
  let savedOverflow = '', startY = null;
  const abort = new AbortController(), options = { signal: abort.signal };
  const lock = () => { savedOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; lenis.stop(); };
  const unlock = () => { document.documentElement.style.overflow = savedOverflow; lenis.start(); toggle.setAttribute('aria-expanded','false'); toggle.focus({ preventScroll: true }); };
  const close = () => { if (menu.open) menu.close(); };
  toggle.addEventListener('click', () => {
    if (menu.open) close(); else { lock(); menu.showModal(); toggle.setAttribute('aria-expanded','true'); menu.querySelector('.menu-close').focus(); }
  }, options);
  menu.addEventListener('close', unlock, options);
  menu.querySelector('.menu-close').addEventListener('click', close, options);
  menu.addEventListener('click', event => { if (event.target === menu) close(); }, options);
  menu.addEventListener('touchstart', event => { startY = event.touches[0]?.clientY ?? null; }, { ...options, passive: true });
  menu.addEventListener('touchend', event => {
    if (startY !== null && event.changedTouches[0].clientY - startY > M.menu.swipeClosePx && menu.scrollTop === 0) close();
    startY = null;
  }, { ...options, passive: true });
  // Native <dialog> provides focus containment, Escape handling and background inertness.
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); close(); onNavigate(link);
  }, options));
  const update = () => {
    const profile = deviceProfile();
    header.classList.toggle('scrolled', profile.responsive && scrollY > M.menu.scrollGlassPx);
    if (!profile.responsive) close();
  };
  window.addEventListener('scroll', update, { ...options, passive: true });
  window.addEventListener('resize', update, { ...options, passive: true });
  update();
  return { close, dispose() { close(); abort.abort(); main.inert = false; } };
}
