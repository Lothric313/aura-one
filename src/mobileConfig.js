import { assetUrl } from './assets.js';

/** Responsive presentation contract. Desktop CONFIG remains authoritative at >=1200px. */
export const MOBILE_CONFIG = Object.freeze({
  breakpoints: { mobile: 767, tablet: 1199, desktop: 1200 },
  performance: {
    maxPixelRatio: 2, lowPixelRatio: 1.5, backgroundPixelRatio: 1.25,
    lowCores: 4, lowMemoryGB: 4, smallScreenPixels: 390 * 700,
    slowFrameMs: 28, slowFrameThreshold: 95,
    particles: 300, lowParticles: 140,
    grass: 1400, lowGrass: 600, butterflies: 7, lowButterflies: 3, flowers: 48,
    textureSize: 1024, antialias: false,
  },
  model: { url: assetUrl('/models/aura-one-mobile.glb'), fallback: assetUrl('/models/aura-one.glb'), decoderPath: assetUrl('/draco/'),
    quantization: { position: 14, normal: 10, uv: 12 }, textureQuality: 80 },
  finishes: [
    { id: 'white', name: 'Лунный белый', color: '#f2f2f4' },
    { id: 'gray', name: 'Титановый серый', color: '#8c8c92' },
    { id: 'black', name: 'Космический чёрный', color: '#222226' },
  ],
  scroll: { progressResponse: .11, reducedResponse: .025, wheelInertiaSeconds: 2, refreshDebounceMs: 180, navigationSeconds: .75 },
  menu: { swipeClosePx: 72, scrollGlassPx: 24 },
  framing: {
    margin: .055, top: .13, modelBottom: .49, landscapeTop: .16, landscapeBottom: .43,
    initialScale: .64, widthFactor: .98, diveStart: .805, diveEnd: .982,
    controllerScale: .53, controllerSpread: .265, flySpread: .35,
    panelY: .20, controllerY: .22, controllerHeadsetScale: .23,
    turnAmplitude: .6,
  },
  explode: {
    preloadAt: .27, releaseBefore: .24, releaseAfter: .64,
    parts: ['lens_left', 'lens_right', 'pcb_main', 'battery', 'display_left', 'display_right'],
    maxParts: 6, fasteners: 0, cables: 0, yaw: -.38, pitch: .18, scale: .67,
    shellY: .31, shellX: .07, depthFactor: .24, partY: .85,
    callouts: ['Оптика · 110°', 'Spatial X1'],
  },
  world: { preloadAt: .70, releaseBefore: .64, releaseAfter: .978, fov: 52, timeScale: .4 },
  copy: {
    design: 'Точное движение. Мягкое касание.', controllers: 'Точность в каждом жесте.',
    controllersValues: ['Тактильный', '6 степеней свободы', 'Удобный хват', 'Сменные батареи'],
  },
});

export function deviceProfile({ width = globalThis.innerWidth ?? 1920, height = globalThis.innerHeight ?? 1080,
  cores = globalThis.navigator?.hardwareConcurrency, memory = globalThis.navigator?.deviceMemory,
  touch = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false } = {}) {
  const responsive = width < MOBILE_CONFIG.breakpoints.desktop;
  const mobile = width <= MOBILE_CONFIG.breakpoints.mobile;
  const p = MOBILE_CONFIG.performance;
  const low = responsive && ((cores != null && cores <= p.lowCores) ||
    (memory != null && memory <= p.lowMemoryGB) ||
    (touch && cores == null && memory == null && width * height <= p.smallScreenPixels));
  return { responsive, mobile, tablet: responsive && !mobile, landscape: responsive && width > height,
    touch, low, width, height, tier: responsive ? mobile ? 'mobile' : 'tablet' : 'desktop' };
}

// A separate pose track is sampled only below the desktop breakpoint.
export const MOBILE_HEADSET_POSES = [
  [0, [0,0,0], [0,0,0], .64],
  [.15, [0,.13,0], [.04,.28,-.01], .67],
  [.22, [0,.17,0], [.03,0,0], .67],
  [.30, [0,.20,0], [.05,-.22,-.015], .65],
  [.37, [0,.20,0], [.06,-.18,-.01], .65],
  [.42, [0,.20,0], [.05,.02,0], .63],
  [.47, [0,.20,0], [.07,.22,.01], .64],
  [.55, [0,.20,0], [.08,.18,.01], .65],
  [.635, [0,.28,-1.1], [.06,.30,.01], .23],
  [.695, [0,.29,-1.05], [.08,.34,.015], .23],
  [.735, [0,.60,-1.3], [.06,.48,.01], .22],
  [.765, [0,.9,-2], [0,.2,0], .21],
  [.780, [.32,-.65,-2], [0,0,0], .48],
  [.810, [0,.03,-.6], [.01,.22,.01], .66],
  [.835, [0,.08,1], [0,Math.PI,0], .72],
  [.875, [0,.08,8], [0,Math.PI,0], .72],
  [.915, [0,.08,8.2], [0,Math.PI,0], .72],
  [.933, [0,.08,7.35], [0,Math.PI,0], .72],
  [.948, [0,.10,5.2], [0,Math.PI,0], .70],
  [.957, [0,.12,3.6], [0,Math.PI,0], .68],
  [.975, [0,.15,1.2], [0,4.4,0], .65],
  [.991, [0,.16,.12], [0,6.1,0], .64],
  [1, [0,.16,0], [0,Math.PI*2,0], .64],
].map(([progress, position, rotation, scale]) => ({ progress, position, rotation, scale }));

export function mobileControllerPoses(side) {
  const sign = side === 'left' ? -1 : 1, f = MOBILE_CONFIG.framing;
  return [
    [0, [sign * f.controllerSpread,-.085,.15], .50],
    [.18, [sign * f.flySpread,.01,-.4], .47],
    [.28, [sign * .40,.11,-.8], .40],
    [.55, [sign * .40,.14,-.8], .40],
    [.64, [sign * .17,.16,-.15], f.controllerScale],
    [.70, [sign * .18,.17,-.10], f.controllerScale],
    [.765, [sign * .38,.60,-1.5], .40],
    [.915, [sign * .40,.65,-1.6], .39],
    [.965, [sign * .30,-.04,-.25], .46],
    [1, [sign * f.controllerSpread,-.085,.15], .50],
  ].map(([progress, position, scale]) => ({ progress, position, scale, rotation: [Math.PI/2,0,Math.PI] }));
}
export const MOBILE_CONTROLLER_LEFT = mobileControllerPoses('left');
export const MOBILE_CONTROLLER_RIGHT = mobileControllerPoses('right');
