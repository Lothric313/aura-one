import './styles.css';
import './mobile.css';
import './world-title.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { CONFIG, applyTheme } from './config.js';
import { createCursor } from './cursor.js';
import { createBackground } from './background.js';
import { createScene } from './scene.js';
import { createTimeline } from './timeline.js';
import { createImmersiveVideo } from './immersive.js';
import { createCylinderReveal } from './cylinder-reveal.js';
import { MOTION, easeMotion, scrollLerp } from './motion.js';
import { MOBILE_CONFIG as M, deviceProfile } from './mobileConfig.js';
import { createMobileUI } from './mobileUI.js';

applyTheme();
const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)');
let profile = deviceProfile();
let lowQuality = profile.responsive ? profile.low : (navigator.hardwareConcurrency || 8) <= 4;
document.body.classList.toggle('low-power', lowQuality && profile.responsive);
document.documentElement.style.setProperty('--journey-mobile-units', CONFIG.timeline.mobileHeightVh / 100);
document.body.dataset.device = profile.tier;
const lineText = (element, lines) => lines.forEach(text => { const span = document.createElement('span'); span.className = 'line'; const inner = document.createElement('span'); inner.className = 'line-inner'; inner.textContent = text; span.appendChild(inner); element.appendChild(span); });
document.querySelectorAll('.product-name').forEach(element => {
  CONFIG.name.split(' ').forEach((word, i) => {
    if (i) element.appendChild(document.createTextNode(' '));
    const span = document.createElement('span'); span.className = 'title-word';
    const inner = document.createElement('span'); inner.className = 'title-word-inner'; inner.textContent = word;
    span.appendChild(inner); element.appendChild(span);
  });
});
CONFIG.copy.nav.forEach((text, i) => {
  const anchor = document.createElement('a'); anchor.className = 'nav-link'; anchor.textContent = text;
  anchor.href = ['#overview', '#design', '#specifications'][i]; anchor.dataset.seek = [.165, .32, .49][i]; $('#nav').appendChild(anchor);
});
$('#design-eyebrow').textContent = CONFIG.copy.designEyebrow;
lineText($('#design-heading'), CONFIG.copy.designTitle);
$('#design-body').textContent = CONFIG.copy.designBody;
function responsiveCopy(element, short) {
  const full = document.createElement('span'); full.className = 'copy-full'; full.textContent = element.textContent;
  const concise = document.createElement('span'); concise.className = 'copy-short'; concise.textContent = short;
  element.replaceChildren(full, concise);
}
responsiveCopy($('#design-body'), M.copy.design);
$('#specs-eyebrow').textContent = CONFIG.copy.specsEyebrow;
$('#world-heading').textContent = CONFIG.copy.worldTitle;
lineText($('#specs-heading'), CONFIG.copy.specsTitle);
CONFIG.copy.specs.forEach((spec, i) => {
  const row = document.createElement('div'); row.className = 'spec-row';
  if (i > 2) row.classList.add('mobile-secondary');
  const term = document.createElement('dt'); term.textContent = spec.label;
  const detail = document.createElement('dd'); detail.textContent = spec.value;
  row.append(term, detail); $('.specs-list').appendChild(row);
});
$('.specs-note').textContent = CONFIG.copy.specsNote;
$('#controllers-eyebrow').textContent = CONFIG.copy.controllersEyebrow;
lineText($('#controllers-heading'), CONFIG.copy.controllersTitle);
$('#controllers-body').textContent = CONFIG.copy.controllersBody;
responsiveCopy($('#controllers-body'), M.copy.controllers);
CONFIG.copy.controllers.forEach((spec, i) => {
  const row = document.createElement('div'); row.className = 'spec-row';
  if (i > 2) row.classList.add('mobile-secondary');
  const term = document.createElement('dt'); term.textContent = spec.label;
  const detail = document.createElement('dd'); detail.textContent = spec.value;
  responsiveCopy(detail, M.copy.controllersValues[i]);
  row.append(term, detail); $('.controllers-list').appendChild(row);
});
const socialGlyphs = {
  Telegram: '<path d="m3 10 14-6-3 13-5-4-3 3v-5zM6 11l8-5-5 7"/>',
  Instagram: '<rect x="3" y="3" width="14" height="14" rx="4"/><circle cx="10" cy="10" r="3.3"/><circle cx="14.5" cy="5.5" r=".6"/>',
};
CONFIG.social.forEach(social => {
  const anchor = document.createElement('a'); anchor.href = social.url;
  if (socialGlyphs[social.name]) anchor.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">${socialGlyphs[social.name]}</svg>`;
  else anchor.textContent = social.label;
  anchor.ariaLabel = social.name + ' — демонстрационная ссылка'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; $('.social-links').appendChild(anchor);
});
$('#about-title').textContent = CONFIG.copy.aboutTitle;
$('#about-body').textContent = CONFIG.copy.aboutBody;
const dialog = $('#about-dialog');
$('#about-button').addEventListener('click', () => { lenis.stop(); cursor.hide(); dialog.showModal(); });
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => lenis.start());
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });

let finish = CONFIG.finishes[0];
const availableFinishes = () => deviceProfile().responsive ? M.finishes : CONFIG.finishes;
try { finish = availableFinishes().find(option => option.id === localStorage.getItem(CONFIG.storageKey)) || finish; } catch { /* private browsing still works */ }
let sceneController = null, forceRenderFrames = 2;
function updateFinishUI() {
  document.querySelectorAll('.swatch-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.finish === finish.id)));
  $('#finish-name').textContent = finish.name;
}
function buildFinishes() {
  $('.finishes').replaceChildren();
  availableFinishes().forEach(option => {
  const button = document.createElement('button'); button.className = 'swatch-button'; button.dataset.finish = option.id; button.ariaLabel = option.name;
  const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.setProperty('--finish-color', option.color); button.appendChild(swatch);
  button.addEventListener('click', () => { finish = option; sceneController?.setFinish(finish); forceRenderFrames = 36; updateFinishUI(); try { localStorage.setItem(CONFIG.storageKey, finish.id); } catch { /* optional persistence */ } });
  $('.finishes').appendChild(button);
  });
  updateFinishUI();
}
buildFinishes();
updateFinishUI();

// One smoothing layer, shared by every scene and by wheel/touch input.
const lenis = new Lenis({ autoRaf: false, smoothWheel: !coarsePointer.matches && !reducedMotion.matches, syncTouch: false, lerp: profile.responsive ? Math.log(100)/(60*M.scroll.wheelInertiaSeconds) : scrollLerp, wheelMultiplier: 1, anchors: false });
lenis.on('scroll', ScrollTrigger.update);
const cursor = createCursor({ reducedMotion, coarsePointer });
const background = createBackground($('#background'), { pointer: cursor.pointer, reducedMotion, lowQuality });
document.querySelectorAll('.info-panel').forEach(panel => {
  const content = document.createElement('div'); content.className = 'panel-content';
  while (panel.firstChild) content.appendChild(panel.firstChild);
  panel.appendChild(content);
});
const timeline = createTimeline({ reducedMotion, lenis });
const immersive = createImmersiveVideo({ reducedMotion, lowQuality, responsive: profile.responsive });
const eraReveal = createCylinderReveal($('.era-scene'), { reducedMotion });

document.querySelectorAll('[data-seek]:not(.mobile-menu a)').forEach(element => element.addEventListener('click', event => { event.preventDefault(); timeline.seek(Number(element.dataset.seek)); }));
const initialHash = { '#start': 0, '#overview': .165, '#design': .32, '#specifications': .49, '#explode': .535, '#controllers': .68, '#era': .765, '#lenses': .82, '#landscape': .90, '#video': .90, '#exit': .943, '#turn': .972, '#finale': .995 };
const seekFooter = immediate => lenis.scrollTo($('.footer'), { immediate: immediate || reducedMotion.matches, duration: MOTION.duration, easing: easeMotion, lerp: 0 });
const mobileUI = createMobileUI({ lenis, onNavigate(link) {
  if (link.hasAttribute('data-menu-footer')) {
    if (coarsePointer.matches) $('.footer').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    else seekFooter(false);
  } else timeline.seek(Number(link.dataset.seek));
} });
document.querySelectorAll('.mobile-callouts span').forEach((span,i) => { span.textContent = M.explode.callouts[i]; });
window.addEventListener('hashchange', () => {
  if (location.hash === '#footer') seekFooter(false);
  else if (initialHash[location.hash] !== undefined) timeline.seek(initialHash[location.hash]);
});
let initialSeekDone = false;
let loaderProgress=0;
const updateLoader = progress => { loaderProgress=Math.max(loaderProgress,Math.min(1,progress));$('.loader-track span').style.transform = `scaleX(${loaderProgress})`; $('.loader-number').textContent = `${Math.round(loaderProgress * 100)}%`; };

// Async loading never creates a second frame loop.
Promise.all([
  createScene($('#scene'), { pointer: cursor.pointer, reducedMotion, lowQuality, finish, immersive, onProgress: p=>updateLoader(p*.92) }),
  immersive?.prepare(),
  eraReveal.prepare().catch(error=>console.warn('Era font preparation:',error)),
]).then(([controller]) => {
  sceneController = controller;
  document.body.dataset.modelSource = controller.modelSource;
  document.body.dataset.bindings = JSON.stringify(controller.headset.report);
  document.body.dataset.opticalState = JSON.stringify(controller.opticalState);
  forceRenderFrames = 2;
  sceneController.setFinish(finish);
  updateLoader(1);
  document.body.classList.add('loaded');
  $('.loader').setAttribute('aria-hidden', 'true');
  timeline.refresh();
  if (!initialSeekDone && location.hash === '#footer') { seekFooter(true); initialSeekDone = true; }
  else if (!initialSeekDone && initialHash[location.hash] !== undefined) { timeline.seek(initialHash[location.hash], true); initialSeekDone = true; }
}).catch(error => {
  document.body.classList.add('loaded', 'no-webgl'); $('.webgl-fallback').hidden = false;
  $('.loader').setAttribute('aria-hidden','true');
  console.error('Aura WebGL initialization:', error);
});

let slowFrames = 0, lastProgress = -1, nextDiagnostic = 0, meanFrameMs = 16.67, stageVisible = true, journeyVisible = true, footerVisible = false;
const observer = new IntersectionObserver(entries => {
  for(const entry of entries){if(entry.target.classList.contains('footer'))footerVisible=entry.isIntersecting;else journeyVisible=entry.isIntersecting;}
  stageVisible = journeyVisible && !footerVisible;
  if (!stageVisible) immersive?.pause();
  else forceRenderFrames = 2;
}, { threshold: 0 });
observer.observe($('.journey'));
observer.observe($('.footer'));
function frame(time, deltaTime) {
  if (document.hidden) return;
  const dt = Math.min(.25, deltaTime / 1000 || 1 / 60);
  const rawDt = deltaTime;
  if (rawDt > 0 && rawDt < 250) meanFrameMs += (rawDt - meanFrameMs) * .04;
  lenis.raf(time * 1000);
  const progress = timeline.update(dt);
  document.body.classList.toggle('in-world', progress > .870 && progress < .934);
  if (stageVisible) immersive?.update(progress);
  if (sceneController) eraReveal.update(progress);
  cursor.update(dt);
  if (stageVisible) background.update(dt, progress);
  const sceneVisible = stageVisible;
  if (sceneVisible && (!reducedMotion.matches || progress !== lastProgress || forceRenderFrames > 0)) {
    sceneController?.update(dt, time, progress);
    if (sceneController) forceRenderFrames = Math.max(0, forceRenderFrames - 1);
  }
  lastProgress = progress;
  if (time >= nextDiagnostic) {
    nextDiagnostic = time + .1;
    document.body.dataset.progress = progress.toFixed(6);
    document.body.dataset.targetProgress = timeline.target.toFixed(6);
    document.body.dataset.productState = JSON.stringify(sceneController?.productState || {});
    document.body.dataset.fps = (1000 / meanFrameMs).toFixed(1);
    document.body.dataset.preparation = JSON.stringify({product:sceneController?.preparation,title:immersive?.state?.title?.prepared});
  }
  if (rawDt > (profile.responsive ? M.performance.slowFrameMs : CONFIG.performance.slowFrameMs) && rawDt < 150) slowFrames++; else slowFrames = Math.max(0, slowFrames - .35);
  if (!lowQuality && slowFrames > (profile.responsive ? M.performance.slowFrameThreshold : CONFIG.performance.slowFrameThreshold)) {
    lowQuality = true; background.reduceQuality(); cursor.reduceQuality(); sceneController?.reduceQuality();
    immersive?.reduceQuality?.();
    document.body.classList.toggle('low-power', profile.responsive);
  }
}
// GSAP owns the single application frame loop, including Lenis, text and both canvases.
gsap.ticker.lagSmoothing(0);
gsap.ticker.add(frame);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  gsap.ticker.remove(frame); timeline.trigger.kill(); mobileUI.dispose(); lenis.destroy(); sceneController?.dispose(); immersive?.dispose?.(); observer.disconnect();
});
let resizeTimer;
function refreshViewport() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = deviceProfile();
    if (next.responsive !== profile.responsive) {
      if (!availableFinishes().some(option => option.id === finish.id)) { finish = CONFIG.finishes[0]; sceneController?.setFinish(finish); }
      buildFinishes();
    }
    profile = next; document.body.dataset.device = profile.tier;
    lenis.options.lerp=profile.responsive?Math.log(100)/(60*M.scroll.wheelInertiaSeconds):scrollLerp;
    background.resize(); sceneController?.resize(); immersive?.resize?.(); eraReveal.resize(); timeline.refresh(); forceRenderFrames = 2;
  }, M.scroll.refreshDebounceMs);
}
window.addEventListener('resize', refreshViewport, { passive: true });
window.addEventListener('orientationchange', refreshViewport, { passive: true });
window.visualViewport?.addEventListener('resize', refreshViewport, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) immersive?.pause();
});
reducedMotion.addEventListener('change', () => { lenis.options.smoothWheel = !coarsePointer.matches && !reducedMotion.matches; lenis.options.syncTouch = false; background.resize(); forceRenderFrames=2; });

// Local diagnostics and a deterministic scene seek for QA; no analytics or network output.
window.aura = Object.freeze({
  get progress() { return timeline.progress; },
  get targetProgress() { return timeline.target; },
  get bindings() { return sceneController?.headset.report; },
  get opticalState() { return sceneController?.opticalState; },
  get productState() { return sceneController?.productState; },
  get modelSource() { return sceneController?.modelSource || 'loading'; },
  get finish() { return finish.id; },
  get renderInfo() { return sceneController?.renderer.info; },
  get device() { return deviceProfile(); },
  get quality() { return lowQuality ? 'low' : 'standard'; },
  get pixelRatio() { return sceneController?.renderer.getPixelRatio(); },
  get world() { return immersive?.state; },
  seek(value) { timeline.seek(value, true); },
});
