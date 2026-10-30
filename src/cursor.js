import { followMotion } from './motion.js';

export function createCursor({ reducedMotion, coarsePointer }) {
  const element = document.querySelector('.cursor');
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, active: false };
  let x = pointer.x, y = pointer.y, disabled = false;
  const usable = () => !reducedMotion.matches && !coarsePointer.matches && !disabled;
  window.addEventListener('pointermove', event => {
    pointer.x = event.clientX; pointer.y = event.clientY;
    pointer.nx = event.clientX / innerWidth * 2 - 1;
    pointer.ny = event.clientY / innerHeight * 2 - 1;
    pointer.active = event.pointerType !== 'touch';
    if (usable()) element.style.opacity = '1';
  }, { passive: true });
  document.addEventListener('pointerover', event => element.classList.toggle('hover', Boolean(event.target.closest('a,button'))));
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; element.style.opacity = '0'; });
  return {
    pointer,
    update(dt) {
      if (!usable()) return;
      x = followMotion(x, pointer.x, dt); y = followMotion(y, pointer.y, dt);
      element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    },
    reduceQuality() { disabled = true; element.classList.add('disabled'); },
    hide() { element.style.opacity = '0'; },
  };
}
