export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

const tracks = new WeakMap();
function makeTracks(frames) {
  const keys = frames[0].rotation ? ['position', 'rotation', 'scale'] : ['position'];
  const result = {};
  for (const key of keys) {
    const channels = key === 'scale' ? 1 : 3;
    result[key] = Array.from({ length: channels }, (_, channel) => {
      const values = frames.map(f => key === 'scale' ? f.scale : f[key][channel]);
      const slopes = frames.map((f, i) => {
        if (i === 0 || i === frames.length - 1) return 0;
        const h0 = f.progress - frames[i - 1].progress, h1 = frames[i + 1].progress - f.progress;
        const d0 = (values[i] - values[i - 1]) / h0, d1 = (values[i + 1] - values[i]) / h1;
        if (d0 * d1 <= 0) return 0;
        const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
        return (w0 + w1) / (w0 / d0 + w1 / d1);
      });
      return { values, slopes };
    });
  }
  tracks.set(frames, result);
  return result;
}
export function sampleKeyframes(frames, progress, output = {}) {
  let i = frames.findIndex((_, i) => i < frames.length - 1 && progress <= frames[i + 1].progress);
  if (i < 0) i = frames.length - 2;
  const a = frames[i], b = frames[i + 1], h = b.progress - a.progress;
  const t = clamp((progress - a.progress) / h), t2 = t * t, t3 = t2 * t;
  const data = tracks.get(frames) || makeTracks(frames);
  for (const [key, channels] of Object.entries(data)) {
    if (key !== 'scale') output[key] ||= [0, 0, 0];
    channels.forEach(({ values, slopes }, channel) => {
      const value = (2*t3-3*t2+1)*values[i] + (t3-2*t2+t)*h*slopes[i] + (-2*t3+3*t2)*values[i+1] + (t3-t2)*h*slopes[i+1];
      if (key === 'scale') output.scale = value; else output[key][channel] = value;
    });
  }
  return output;
}
