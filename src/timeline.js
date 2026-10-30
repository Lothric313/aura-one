import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { CONFIG } from './config.js';
import { MOBILE_CONFIG, MOBILE_HEADSET_POSES, deviceProfile } from './mobileConfig.js';
import { MOTION, easeMotion, followMotion, scrollProgressAtClock, clockProgressAtScroll, clockProgressAtScene } from './motion.js';
gsap.registerPlugin(ScrollTrigger);
import { clamp, sampleKeyframes } from './keyframes.js';
export { clamp, sampleKeyframes } from './keyframes.js';
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const POSES = CONFIG.motion.headset;
export const dampProgress = followMotion;

export function samplePose(progress, mobile = false, output = {}) {
  sampleKeyframes(mobile ? MOBILE_HEADSET_POSES : POSES, progress, output);
  return output;
}

// All scenes share one clock; only the field uses a shorter scroll span.
export function sceneProgressAtScroll(scrollProgress) {
  return sampleKeyframes(CONFIG.timeline.scrollStops, clockProgressAtScroll(scrollProgress)).position[0];
}
export { clockProgressAtScene } from './motion.js';
export const scrollProgressAtScene = scene => scrollProgressAtClock(clockProgressAtScene(scene));
const fadeTiming = scene => ({ start: clockProgressAtScene(scene), duration: MOTION.revealSpan });
const immersionEnter = fadeTiming(.842);
const immersionExit = fadeTiming(.924);
const controllerFades = [.28, .590, .735, .965].map(fadeTiming);
export function sequenceState(progress) {
  const scroll = clockProgressAtScene(progress);
  const fade = ({ start, duration }) => smooth(start, start + duration, scroll);
  const entering = fade(immersionEnter);
  const returning = fade(immersionExit);
  return {
    productOpacity: Math.max(1 - entering, returning),
    videoOpacity: entering * (1 - returning),
    videoActive: progress > .76 && progress < .955,
    centerApproach: smooth(.805, .835, progress) * (1 - smooth(.952, .980, progress)),
    controllersOpacity: Math.max(1 - fade(controllerFades[0]), fade(controllerFades[1]) * (1 - fade(controllerFades[2])), fade(controllerFades[3])),
  };
}

// Text, controller fades and video use the same scene clock as the model.
export const UI_TRANSITIONS = Object.freeze([
  { enter: .08, exit: .16 },
  { enter: .215, exit: .32 },
  { enter: .41, exit: .55 },
  { enter: .590, exit: .695 },
  { enter: .875, exit: .915 },
].map(({ enter, exit }) => Object.freeze({
  enter: clockProgressAtScene(enter),
  exit: clockProgressAtScene(exit),
  duration: MOTION.revealSpan,
})));

export function createTimeline({ reducedMotion, lenis, profile = deviceProfile }) {
  const journey = document.querySelector('.journey');
  const title = document.querySelector('.scene-title');
  const hint = document.querySelector('.opening-scroll');
  const panels = ['design', 'specs', 'controllers'].map(name => document.querySelector('.' + name + '-panel'));
  const contents = panels.map(panel => panel.querySelector('.panel-content'));
  let progress = 0, target = 0, chapter = -1;
  let displayScroll = null;
  const ui = gsap.timeline({ paused: true });
  gsap.set([title, ...contents], { autoAlpha: 0 });
  gsap.set(hint, { autoAlpha: 1 });
  ui.to({}, { duration: 1 }, 0);
  function reveal(element, timing, stationary = false) {
    const { enter: start, exit, duration } = timing;
    const words = element.querySelectorAll('.title-word-inner, .line-inner');
    const motion = stationary || reducedMotion.matches ? 0 : 1;
    ui.fromTo(element, { autoAlpha: 0, y: 24 * motion, filter: `blur(${7 * motion}px)` },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration, ease: easeMotion, immediateRender: false }, start);
    if (words.length) ui.fromTo(words, { yPercent: 105 * motion, rotateX: -12 * motion },
      { yPercent: 0, rotateX: 0, duration, ease: easeMotion, immediateRender: false }, start);
    ui.to(element, { autoAlpha: 0, y: -24 * motion, filter: `blur(${7 * motion}px)`, duration, ease: easeMotion }, exit);
  }
  [title, ...contents].forEach((element, i) => reveal(element, UI_TRANSITIONS[i]));
  ui.to(hint, { autoAlpha: 0, duration: UI_TRANSITIONS[0].duration, ease: easeMotion }, UI_TRANSITIONS[0].exit);
  const trigger = ScrollTrigger.create({ trigger: journey, start: 'top top', end: 'bottom bottom', invalidateOnRefresh: true });
  const bounds = [0, .08, .22, .40, .59, .715, .805, .87, .93, 1.001];
  const labels = ['Первый кадр', 'Aura One', 'Выбор цвета', 'Всё внутри — раскрытие устройства', 'Контроллеры', 'Новая эра виртуальной реальности', 'Погружение', 'Цветочное поле', 'Aura One — финал'];
  function viewportHeight() { return profile().responsive ? document.querySelector('.stage').clientHeight : innerHeight; }
  function update(dt = 1/60) {
    const touch = profile().touch;
    const distance = Math.max(1, journey.offsetHeight - viewportHeight());
    const rawScroll = touch ? scrollY : lenis.animatedScroll;
    const raw = clamp((rawScroll - journey.offsetTop) / distance);
    if (displayScroll === null || !touch) displayScroll = raw;
    else displayScroll += (raw - displayScroll) * (1 - Math.exp(-dt / (reducedMotion.matches ? MOBILE_CONFIG.scroll.reducedResponse : MOBILE_CONFIG.scroll.progressResponse)));
    const scroll = displayScroll;
    const clock = clockProgressAtScroll(scroll);
    target = sceneProgressAtScroll(((touch ? scrollY : lenis.targetScroll) - journey.offsetTop) / distance);
    // Lenis is the only scroll smoother; model, text and video share its clock.
    progress = sceneProgressAtScroll(scroll);
    ui.progress(clock, true);
    panels.forEach((element, i) => {
      const timing = UI_TRANSITIONS[i + 1];
      const active = clock > timing.enter && clock < timing.exit + timing.duration;
      element.classList.toggle('is-active', active); element.inert = !active;
    });
    const next = Math.max(0, bounds.findIndex((value, i) => i < labels.length && progress >= value && progress < bounds[i + 1]));
    if (chapter !== next) {
      chapter = next; document.querySelector('#scene-status').textContent = labels[chapter];
      document.querySelectorAll('.nav-link').forEach((link, i) => link.setAttribute('aria-current', String(i === (chapter <= 1 ? 0 : chapter === 2 ? 1 : chapter === 3 ? 2 : -1))));
    }
    return progress;
  }
  function seek(value, immediate = false) {
    const position = journey.offsetTop + (journey.offsetHeight - viewportHeight()) * scrollProgressAtScene(value);
    if (profile().touch) {
      window.scrollTo({ top: position, behavior: immediate || reducedMotion.matches ? 'instant' : 'smooth' });
      if (immediate) displayScroll = scrollProgressAtScene(value);
      return;
    }
    lenis.scrollTo(position, { duration: MOTION.duration, easing: easeMotion, lerp: 0, immediate: immediate || reducedMotion.matches });
    if (immediate) { target = clamp(value); progress = target; ScrollTrigger.update(); }
  }
  return { update, seek, trigger, get progress() { return progress; }, get target() { return target; }, refresh() { ScrollTrigger.refresh(); } };
}

