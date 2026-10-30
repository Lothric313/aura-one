import * as THREE from 'three';
import { assetUrl } from './assets.js';

/** One small alpha texture; imagery always comes from the original video. */
export function createButterflyOcclusion(video) {
  const texture = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false; texture.unpackAlignment = 1; texture.needsUpdate = true;
  const skyFraction = { value: .5 };
  const events = new AbortController();
  let data = null, alpha = null, frame = -1, pixels = 0, disposed = false;
  let mediaTime = null, callback = null;
  function presented(now, metadata) {
    mediaTime = metadata.mediaTime;
    if (!disposed) callback = video.requestVideoFrameCallback(presented);
  }
  if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(presented);
  fetch(assetUrl('/media/butterfly-occlusion.json'), { signal: events.signal }).then(response => {
    if (!response.ok) throw new Error(`Foreground mask: HTTP ${response.status}`);
    return response.json();
  }).then(mask => {
    if (disposed) return;
    data = mask; alpha = new Uint8Array(data.width * data.height);
    texture.image = { data: alpha, width: data.width, height: data.height };
    skyFraction.value = data.height / data.sourceHeight;
    texture.needsUpdate = true;
  }).catch(error => {
    if (!disposed) console.warn('Original-video foreground mask:', error);
  });
  return {
    texture, skyFraction,
    update() {
      if (!data) return false;
      const next = Math.min(data.frameCount - 1, Math.max(0,
        Math.floor((mediaTime ?? video.currentTime) * data.fps + .0001)));
      if (next === frame) return false;
      frame = next; alpha.fill(0); pixels = 0;
      const runs = data.frames[frame];
      for (let i = 0; i < runs.length; i += 3) {
        alpha.fill(runs[i + 2], runs[i], runs[i] + runs[i + 1]);
        pixels += runs[i + 1];
      }
      texture.needsUpdate = true;
      return true;
    },
    get state() { return { ready: Boolean(data), frame, pixels }; },
    dispose() {
      disposed = true; events.abort();
      if (callback !== null) video.cancelVideoFrameCallback(callback);
      texture.dispose(); data = null; alpha = null;
    },
  };
}
