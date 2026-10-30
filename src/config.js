import { MOTION, SCROLL_TIMING } from './motion.js';
import { assetUrl } from './assets.js';

/** All copy, visual constants and product placeholders live here. */
export const CONFIG = {
  name: 'Aura One',
  title: 'Aura One — A new point of view',
  description: 'Scroll-driven VR headset concept. A new point of view.',
  storageKey: 'aura-one-finish',
  modelUrl: assetUrl('/models/aura-one.glb'),
  decoderPath: assetUrl('/draco/'),
  environmentUrl: assetUrl('/environment/studio.hdr'),
  video: { enabled: true, url: assetUrl('/media/inside.mp4'), useAsFinalView: true },
  colors: {
    background: '#000000', surface: '#0d0d0f', text: '#f5f5f7', muted: '#86868b',
    line: 'rgba(255,255,255,0.08)', accent: '#4d8dff', glass: 'rgba(255,255,255,0.06)',
    cushion: '#171719', weave: '#37373d', strap: '#d7d7db', lens: '#ffffff',
    lensBacking: '#070b17', rim: '#a8a9ad', sensors: '#08090b',
    skyTop: '#51a9f1', skyHorizon: '#d2eff9', cloud: '#ffffff',
    terrain: '#729b42', grassBottom: '#315c29', grassTop: '#9abb50', fog: '#c5e1ca',
    flowerRedLight: '#ff7064', flowerRed: '#e23832', flowerRedDark: '#a51b27',
    butterflies: ['#e9be61', '#e6d9ed', '#f1f2ce', '#81b5df', '#dd957b'],
  },
  finishes: [
    { id: 'white', name: 'Лунный белый', color: '#f2f2f4' },
    { id: 'gray', name: 'Титановый серый', color: '#8c8c92' },
  ],
  copy: {
    nav: ['Обзор', 'Дизайн', 'Характеристики'], cta: 'Погрузиться', scroll: 'Scroll',
    designEyebrow: 'СОЗДАН ДЛЯ ВАС', designTitle: ['Ваш мир.', 'Ваш цвет.'],
    designBody: 'Точное движение. Мягкое касание.\nТехнологии, которые становятся ближе.',
    specsEyebrow: 'ПРОДУМАНО ИЗНУТРИ', specsTitle: ['Всё', 'Внутри.'],
    worldTitle: 'Aura One',
    specsNote: 'Концепт · демонстрационные параметры',
    // Illustrative specifications, deliberately editable rather than real product claims.
    specs: [
      { label: 'Дисплей', value: 'Micro-OLED · 4K' },
      { label: 'Линзы', value: 'Fresnel · 110°' },
      { label: 'Процессор', value: 'Spatial X1' },
      { label: 'Автономность', value: 'До 3 часов' },
      { label: 'Управление', value: 'Руки + контроллеры' },
    ],
    controllersEyebrow: 'ДВИЖЕНИЕ БЕЗ ГРАНИЦ',
    controllersTitle: ['В ваших', 'руках.'],
    controllersBody: 'Каждый жест становится частью мира.\nТочность, которую чувствуешь.',
    controllers: [
      { label: 'Отклик', value: 'Тактильная отдача' },
      { label: 'Отслеживание', value: 'Шесть степеней свободы' },
      { label: 'Эргономика', value: 'Естественный хват' },
      { label: 'Питание', value: 'Сменные батареи' },
    ],
    footerNote: 'Независимый дизайн-концепт', about: 'О концепте',
    aboutTitle: 'Другая точка зрения.',
    aboutBody: 'Aura One — интерактивный дизайн-концепт. Название и параметры демонстрационные. 3D-модель Oculus Quest 3: AVILOV, Sketchfab, CC BY 4.0. Геометрия разделена, материалы линз и анимация изменены.',
  },
  // Replace social placeholders with your own profiles.
  social: [
    { name: 'Telegram', label: 'TG', url: 'https://t.me/' },
    { name: 'Instagram', label: 'IG', url: 'https://www.instagram.com/' },
  ],
  performance: {
    maxPixelRatio: 2, desktopPixelRatio: 1.6, particles: 2000, lowParticles: 600,
    grass: 26000, lowGrass: 9000, butterflies: 18, lowButterflies: 10,
    cursorRadius: 160, slowFrameMs: 23, slowFrameThreshold: 95,
  },
  timeline: {
    heightVh: SCROLL_TIMING.heightVh, mobileHeightVh: SCROLL_TIMING.heightVh,
    // Shared scene clock with a half-length field chapter on desktop and mobile.
    scrollStops: SCROLL_TIMING.stops,
  },
  // x/y: fractions of camera width/height; z: world units; rotation: radians.
  // scale: normalized headset width / camera height (controllers use the same unit).
  motion: {
    camera: [
      {progress: 0,position: [0,0,6.5]},
      {progress: 1,position: [0,0,6.5]},
    ],
    headset: [
      {progress: 0,position: [0,0,0],rotation: [0,0,0],scale: 0.62},
      {progress: 0.15,position: [0,0.15,0],rotation: [0.08,0.48,-0.02],scale: 0.72},
      {progress: 0.22,position: [0,0.14,0],rotation: [0.05,0,0],scale: 0.72},
      {progress: 0.3,position: [0.215,0.04,0],rotation: [0.07,-0.34,-0.025],scale: 0.74},
      {progress: 0.37,position: [0.23,0.055,0],rotation: [0.09,-0.26,-0.015],scale: 0.76},
      {progress: 0.42,position: [0,0.085,0],rotation: [0.07,0.04,0],scale: 0.72},
      {progress: 0.47,position: [-0.215,0.04,0],rotation: [0.09,0.36,0.02],scale: 0.74},
      {progress: 0.55,position: [-0.23,0.055,0],rotation: [0.11,0.28,0.01],scale: 0.76},
      {progress: 0.635,position: [-0.3,0.265,-1.1],rotation: [0.08,0.48,0.015],scale: 0.5},
      {progress: 0.695,position: [-0.32,0.28,-1.05],rotation: [0.11,0.56,0.025],scale: 0.52},
      {progress: 0.735,position: [-0.85,0.18,-1.3],rotation: [0.09,0.8,0.01],scale: 0.50},
      {progress: 0.750,position: [-1.1,-0.05,-1.5],rotation: [0.06,0.9,0],scale: 0.48},
      {progress: 0.765,position: [-1.2,-1.4,-2],rotation: [0.02,0.35,0],scale: 0.50},
      {progress: 0.780,position: [1.15,-1.4,-2],rotation: [0,0,0],scale: 0.51},
      {progress: 0.792,position: [.95,-.75,-1.7],rotation: [0,0,0],scale: 0.52},
      {progress: 0.810,position: [.32,-.20,-.6],rotation: [0.02,.35,.015],scale: 0.70},
      {progress: 0.835,position: [0,0.1,1],rotation: [0,3.141592653589793,0],scale: 0.86},
      {progress: 0.875,position: [0,0.1,8],rotation: [0,3.141592653589793,0],scale: 0.86},
      {progress: 0.915,position: [0,0.1,8.2],rotation: [0,3.141592653589793,0],scale: 0.86},
      {progress: 0.933,position: [0,0.1,7.35],rotation: [0,3.141592653589793,0],scale: 0.86},
      {progress: 0.948,position: [0,0.12,5.2],rotation: [0,3.141592653589793,0],scale: 0.82},
      {progress: 0.957,position: [0,0.15,3.6],rotation: [0,3.141592653589793,0],scale: 0.76},
      {progress: 0.975,position: [0,0.18,1.2],rotation: [0,4.4,0],scale: 0.68},
      {progress: 0.991,position: [0,0.19,0.12],rotation: [0,6.1,0],scale: 0.63},
      {progress: 1,position: [0,0.2,0],rotation: [0,6.283185307179586,0],scale: 0.62},
    ],
    controllerLeft: [
      {progress: 0,position: [-0.235,-0.1,0.25],rotation: [1.5707963267948966,0,3.141592653589793],scale: 0.5},
      {progress: 0.18,position: [-0.4,-0.1,-0.4],rotation: [1.2,-0.3,3.5],scale: 0.6},
      {progress: 0.28,position: [-0.68,-0.04,-0.8],rotation: [0.9,-0.7,3.7],scale: 0.56},
      {progress: 0.55,position: [0.62,0.03,-0.8],rotation: [1.15,-0.6,3.5],scale: 0.56},
      {progress: 0.64,position: [0.125,0.045,-0.25],rotation: [1.2,-0.2,3.02],scale: 0.66},
      {progress: 0.700,position: [0.14,0.06,-0.15],rotation: [1.23,-0.13,3.07],scale: 0.68},
      {progress: 0.735,position: [.95,.06,-.8],rotation: [1.0,-.4,3.4],scale: 0.60},
      {progress: 0.765,position: [1.35,-.15,-1.5],rotation: [.8,-.65,3.7],scale: 0.48},
      {progress: 0.915,position: [1.5,-.3,-1.6],rotation: [.9,-.8,3.9],scale: 0.46},
      {progress: 0.947,position: [-0.43,-0.16,-0.25],rotation: [1.4,0.1,3.04],scale: 0.49},
      {progress: 0.985,position: [-0.24,-0.105,0.28],rotation: [1.55,0.02,3.16],scale: 0.505},
      {progress: 1,position: [-0.235,-0.1,0.25],rotation: [1.5707963267948966,0,3.141592653589793],scale: 0.5},
    ],
    controllerRight: [
      {progress: 0,position: [0.235,-0.1,0.25],rotation: [1.5707963267948966,0,3.141592653589793],scale: 0.5},
      {progress: 0.18,position: [0.4,-0.1,-0.4],rotation: [1.2,0.3,2.8],scale: 0.6},
      {progress: 0.28,position: [0.68,-0.04,-0.8],rotation: [0.9,0.7,2.6],scale: 0.56},
      {progress: 0.55,position: [0.72,0.03,-0.8],rotation: [1.15,0.6,2.8],scale: 0.56},
      {progress: 0.64,position: [0.3,-0.1,-0.1],rotation: [1.25,0.2,3.26],scale: 0.66},
      {progress: 0.700,position: [0.32,-0.085,-0.05],rotation: [1.28,0.26,3.21],scale: 0.68},
      {progress: 0.735,position: [1.12,-.1,-1],rotation: [1.05,.4,2.9],scale: 0.60},
      {progress: 0.765,position: [1.55,-.28,-1.7],rotation: [.85,.7,2.5],scale: 0.48},
      {progress: 0.915,position: [1.65,-.4,-1.8],rotation: [.9,.8,2.4],scale: 0.46},
      {progress: 0.947,position: [0.43,-0.16,-0.25],rotation: [1.4,-0.1,3.24],scale: 0.49},
      {progress: 0.985,position: [0.24,-0.105,0.28],rotation: [1.55,-0.02,3.12],scale: 0.505},
      {progress: 1,position: [0.235,-0.1,0.25],rotation: [1.5707963267948966,0,3.141592653589793],scale: 0.5},
    ],
  },
};

export function applyTheme() {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(CONFIG.colors)) {
    if (typeof value === 'string') root.style.setProperty(`--${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`, value);
  }
  document.title = CONFIG.title;
  document.querySelector('meta[name="description"]').content = CONFIG.description;
  root.style.setProperty('--journey-height', `${CONFIG.timeline.heightVh}vh`);
  root.style.setProperty('--journey-mobile-height', `${CONFIG.timeline.mobileHeightVh}vh`);
  root.style.setProperty('--duration', `${MOTION.duration}s`);
  root.style.setProperty('--ease', MOTION.cssEase);
}
