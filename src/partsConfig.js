import { scrollProgressAtScene } from './timeline.js';

const FASTENERS = { count: 16, radiusX: .218, radiusY: .085, layerMin: -.36, layerMax: .36 };
// All distances use the normalized headset. Every part moves along Z only.
export const EXPLODE_CONFIG = {
  chapter: { enter: .345, start: .345, end: .55, exit: .585 },
  split: { distance: 1.02, seamZ: .355 },
  // Arrival and opening share this entire interval: no closed wait or open hold.
  stretch: { start: 0, end: 1 },
  spring: {
    turns: 10, radius: .013, tubeRadius: .0015, segments: 120, radialSegments: 5,
    closedLength: .025, anchors: [[-.20, .025], [.20, .025], [0, -.13]],
  },
  camera: { yaw: -.95, pitch: -.08, orbitDegrees: 0, scale: .52, x: -.20, y: .035, z: .22 },
  framing: { halfWidth: .40, halfHeight: .30, restDepth: .50, margin: .025 },
  internals: { revealAt: .22, cavityRadiusX: .30, cavityRadiusY: .165, cavityCenterY: -.04 },
  colors: { seam: '#9fcfff', internal: '#617789', board: '#13362b', metal: '#646b70', white: '#e4eeff' },
  // Direct rendering by default: spend the GPU budget on actual internal geometry.
  glow: { intensity: .035, seamIntensity: 1.4, bloom: 0, radius: .35, threshold: 1.05 },
  render: { maxPixelRatio: 1.15 },
  // Preserve the original desktop fallback budget. Responsive budgets live in mobileConfig.js.
  reduced: { maxParts: 9, fasteners: 8, cables: 2, segments: 60 },
  fasteners: FASTENERS,
  // layer is the final Z offset within the gap, as a fraction of split.distance.
  // Source X/Y, orientation and the alignment of the optics remain unchanged.
  parts: [
    { name: 'lens_left', type: 'lens', origin: [-.139, -.074, .277], layer: -.29, mobile: true },
    { name: 'lens_right', type: 'lens', origin: [.139, -.074, .277], layer: -.29, mobile: true },
    { name: 'pcb_main', type: 'board', origin: [0, .045, .36], layer: .10, mobile: true },
    { name: 'battery', type: 'battery', origin: [0, -.105, .32], layer: .30, mobile: true },
    { name: 'sensors_11', type: 'sensor', origin: [.122, -.07, .477], mount: 'front_shell', layer: .38, mobile: true },
    { name: 'sensors_12', type: 'sensor', origin: [-.122, -.07, .477], mount: 'front_shell', layer: .38, mobile: true },
    { name: 'display_left', type: 'display', origin: [-.139, -.074, .30], layer: -.16, mobile: true },
    { name: 'display_right', type: 'display', origin: [.139, -.074, .30], layer: -.16, mobile: true },
    { name: 'frame_inner', type: 'frame', origin: [0, -.035, .35], layer: -.39, mobile: true },
    { name: 'pcb_radio', type: 'board', origin: [-.19, .015, .355], scale: [.38, .55, 1], layer: .21 },
    { name: 'pcb_power', type: 'board', origin: [.19, -.10, .355], scale: [.38, .50, 1], layer: .23 },
    { name: 'heatsink', type: 'heatsink', origin: [0, .05, .355], layer: .24 },
    { name: 'fan', type: 'fan', origin: [.18, .018, .34], layer: .08 },
    { name: 'shield_left', type: 'shield', origin: [-.139, -.074, .355], layer: -.02 },
    { name: 'shield_right', type: 'shield', origin: [.139, -.074, .355], layer: -.02 },
    { name: 'cable_left', type: 'cable', origin: [-.165, .04, .33], layer: -.07 },
    { name: 'cable_right', type: 'cable', origin: [.165, .04, .33], layer: -.07 },
    ...Array.from({ length: FASTENERS.count }, (_, i) => {
      const angle = i % 8 / 8 * Math.PI * 2 + Math.floor(i / 8) * Math.PI / 8;
      return { name: `screws_${i + 1}`, type: 'screw', index: i, origin: [Math.cos(angle) * FASTENERS.radiusX, -.035 + Math.sin(angle) * FASTENERS.radiusY, .355], layer: FASTENERS.layerMin + (i * 5 % FASTENERS.count) / (FASTENERS.count - 1) * (FASTENERS.layerMax - FASTENERS.layerMin), mobile: true };
    }),
  ],
};

export const clamp01 = value => Math.max(0, Math.min(1, value));
export function smoothRange(start, end, value) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

// A monotonic stretch, sampled from scroll. No spring solver, noise, spin or overshoot.
const stretchStart = scrollProgressAtScene(EXPLODE_CONFIG.chapter.start);
const stretchEnd = scrollProgressAtScene(EXPLODE_CONFIG.chapter.end);
const stretchExit = scrollProgressAtScene(EXPLODE_CONFIG.chapter.exit);
export function explodeStateAt(progress) {
  const { split, stretch } = EXPLODE_CONFIG;
  const scroll = scrollProgressAtScene(progress);
  const local = clamp01((scroll - stretchStart) / (stretchEnd - stretchStart));
  const exit = smoothRange(stretchEnd, stretchExit, scroll);
  const opening = smoothRange(stretch.start, stretch.end, local);
  // The approach and the shell separation begin and finish together, in both directions.
  const extension = opening * (1 - exit);
  const weight = extension;
  return { local, weight, exit, extension, separation: split.distance * extension, active: weight > 0 };
}
