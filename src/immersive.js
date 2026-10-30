import * as THREE from 'three';
import { CONFIG } from './config.js';
import { sequenceState } from './timeline.js';
import { createGlassTitle } from './glass-title.js';

/** The original video supplies both optical screens and the full-screen scene. */
export function createImmersiveVideo({ reducedMotion, lowQuality = false }) {
  if (!CONFIG.video.enabled) return null;
  const video = document.createElement('video');
  video.className = 'inside-video'; video.id = 'inside-video';
  video.src = CONFIG.video.url; video.muted = true; video.defaultMuted = true;
  video.loop = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
  document.querySelector('.stage').appendChild(video);
  const title = document.querySelector('.landscape-title');
  const glassTitle = createGlassTitle({ video, element: title, reducedMotion, lowQuality });
  const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  texture.repeat.set(9 / 16, 1); texture.offset.set((1 - 9 / 16) / 2, 0);
  let pending = false, blocked = false, failed = false, opacity = 0, disposed = false;
  const events = new AbortController();
  video.addEventListener('error', () => { failed = true; video.style.opacity = '0'; title.style.opacity = '0'; }, { signal: events.signal });
  video.addEventListener('loadeddata', () => { if (reducedMotion.matches) { video.pause(); video.currentTime = .05; } }, { signal: events.signal });
  document.addEventListener('pointerdown', () => { blocked = false; }, { passive: true, signal: events.signal });
  function play() {
    if (disposed || reducedMotion.matches || !video.paused || pending || blocked || failed || document.hidden) return;
    pending = true;
    video.play().catch(() => { if (!disposed) blocked = true; }).finally(() => { pending = false; });
  }
  function update(progress) {
    const sequence = sequenceState(progress);
    if (sequence.videoActive && !reducedMotion.matches) play();
    else if (!video.paused) video.pause();
    const ready = video.readyState >= 2 && !failed;
    opacity = ready && CONFIG.video.useAsFinalView ? sequence.videoOpacity : 0;
    video.style.opacity = String(opacity);
    // The heading stays fixed and shares the scene's visibility.
    title.style.opacity = String(opacity);
    title.style.visibility = opacity > .001 ? 'visible' : 'hidden';
    glassTitle.update(progress, opacity);
    return opacity;
  }
  video.load();
  return {
    texture, update, prepare() { return glassTitle.prepare(); }, resize() { glassTitle.resize(); },
    reduceQuality() { glassTitle.reduceQuality(); },
    pause() { video.pause(); glassTitle.pause(); },
    get ready() { return video.readyState >= 2 && !failed; },
    get state() { return { source: 'video', released: video.readyState < 2, ready: video.readyState >= 2 && !failed, playing: !video.paused, opacity, title: glassTitle.state }; },
    dispose() { disposed = true; events.abort(); glassTitle.dispose(); video.pause(); video.removeAttribute('src'); video.load(); video.remove(); texture.dispose(); },
  };
}

