import { sampleKeyframes } from './keyframes.js';

// One timing contract for CSS, navigation, colour and pointer transitions.
export const MOTION = Object.freeze({
  duration: .75,
  // The field chapter needs half the scroll distance; other scenes keep their pace.
  scrollStops: Object.freeze([0, .08, .215, .345, .55, .585, .715, .805, .875, .915, .957, 1]),
  field: Object.freeze({ start: .87, end: .93, scrollScale: .5 }),
  baseJourneyHeightVh: 2650,
  scrollSpeed: 1.44,
  revealSpan: .03,
  cssEase: 'cubic-bezier(.3333333333,0,.6666666667,1)',
});

const baseBeats = MOTION.scrollStops.length - 1;
const clamp01 = value => Math.max(0, Math.min(1, value));
const stops = MOTION.scrollStops.map((scene, i) => ({ progress: i / baseBeats, position: [scene, 0, 0] }));
export function clockProgressAtScene(sceneProgress) {
  const desired = clamp01(sceneProgress);
  if (desired === 0 || desired === 1) return desired;
  let low = 0, high = 1;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (sampleKeyframes(stops, middle).position[0] < desired) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
const fieldStart = clockProgressAtScene(MOTION.field.start);
const fieldEnd = clockProgressAtScene(MOTION.field.end);
const fieldSpan = fieldEnd - fieldStart;
const removedSpan = fieldSpan * (1 - MOTION.field.scrollScale);
const totalSpan = 1 - removedSpan;

// Integrate smooth entrance/exit ramps. The integral is exactly half a chapter,
// and its slope is 1 at both ends, so neighbouring animations do not jerk.
function fieldDistance(t) {
  const ramp = .2;
  const middleRate = (MOTION.field.scrollScale - ramp) / (1 - ramp);
  if (t < ramp) {
    const u = t / ramp;
    return t - (1 - middleRate) * ramp * (u ** 3 - .5 * u ** 4);
  }
  if (t > 1 - ramp) return MOTION.field.scrollScale - fieldDistance(1 - t);
  return ramp * (1 + middleRate) / 2 + middleRate * (t - ramp);
}
export function scrollProgressAtClock(value) {
  const clock = clamp01(value);
  const distance = clock <= fieldStart ? clock : clock >= fieldEnd ? clock - removedSpan
    : fieldStart + fieldSpan * fieldDistance((clock - fieldStart) / fieldSpan);
  return distance / totalSpan;
}
export function clockProgressAtScroll(value) {
  const distance = clamp01(value) * totalSpan;
  if (distance <= fieldStart) return distance;
  if (distance >= fieldStart + fieldSpan * MOTION.field.scrollScale) return distance + removedSpan;
  let low = fieldStart, high = fieldEnd;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (scrollProgressAtClock(middle) * totalSpan < distance) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
export const SCROLL_TIMING = Object.freeze({
  // Scale the scrollable distance, excluding the sticky viewport itself.
  heightVh: 100 + (MOTION.baseJourneyHeightVh - 100) / MOTION.scrollSpeed * totalSpan,
  stops,
});

export const easeMotion = t => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

// Reach 99% of a moving target in the common duration, independent of FPS.
export const responseSeconds = MOTION.duration / Math.log(100);
export const followMotion = (value, target, dt) => value + (target - value) * (1 - Math.exp(-dt / responseSeconds));
// Lenis interprets this option as an exponential rate multiplied by 60.
export const scrollLerp = 1 / (60 * responseSeconds);
