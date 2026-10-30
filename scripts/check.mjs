import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { samplePose, sampleKeyframes, dampProgress, sequenceState, sceneProgressAtScroll, scrollProgressAtScene, UI_TRANSITIONS } from '../src/timeline.js';
import { CONFIG } from '../src/config.js';
import { MOTION, easeMotion, responseSeconds, scrollProgressAtClock, clockProgressAtScroll } from '../src/motion.js';
import { cylinderLinePose, ERA_RANGE } from '../src/cylinder-reveal.js';
import * as THREE from 'three';
import { normalizeModel } from '../src/headset.js';
import { fitObjectScale } from '../src/framing.js';
for (const file of await readdir(new URL('../src/', import.meta.url))) {
  if (!file.endsWith('.js')) continue;
  const r = spawnSync(process.execPath, ['--check', 'src/' + file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
assert.deepEqual(samplePose(0).rotation, [0, 0, 0], 'Opening must face exactly forward');
assert.equal(samplePose(.835).rotation[1], Math.PI, 'Dive starts from the rear lenses after the front-facing entrance');
assert(samplePose(.875).position[2] > 6.5, 'The centered headset crosses the camera');
const end = samplePose(1), start = samplePose(0);
assert.equal(start.position[1], 0, 'Opening headset is vertically centered');
assert.deepEqual(end.position, [0, .2, 0], 'Preserve the approved final headset framing');
assert.equal(end.scale, start.scale, 'Finale restores the opening size');
assert(Math.abs(end.rotation[1] - Math.PI * 2) < 1e-10, 'Finale completes the turn to the front');
for (const name of ['controllerLeft', 'controllerRight']) {
  const first = sampleKeyframes(CONFIG.motion[name], 0), last = sampleKeyframes(CONFIG.motion[name], 1);
  assert.deepEqual(first.rotation, [Math.PI / 2, 0, Math.PI], 'Controllers face squarely forward');
  assert.deepEqual(last, first, 'Controllers restore their complete opening pose');
}
assert.equal(CONFIG.finishes.length, 2); assert(!CONFIG.finishes.some(f => f.id === 'black'));
assert.equal(sequenceState(.895).productOpacity, 0, 'The product must clear the original video');
assert.equal(sequenceState(.895).videoOpacity, 1);
assert.equal(sequenceState(.995).videoOpacity, 0);
assert.equal(sequenceState(.995).productOpacity, 1);
for (const p of [.08, .22, .4, .58, .74]) assert.deepEqual(sampleKeyframes(CONFIG.motion.camera, p).position, [0, 0, 6.5]);
for (const fps of [15, 30, 60, 144]) {
  let p = 0;
  for (let i = 0; i < fps * 2; i++) p = dampProgress(p, 1, 1 / fps);
  assert(Math.abs(p - (1 - Math.exp(-2 / responseSeconds))) < 1e-12, 'Damping must be frame-rate independent');
  let back = 1;
  for (let i = 0; i < fps * 2; i++) back = dampProgress(back, 0, 1 / fps);
  assert(Math.abs(back - Math.exp(-2 / responseSeconds)) < 1e-12, 'Reverse damping must be symmetric');
}
let previousScene = -1;
for (let i = 0; i <= 1000; i++) {
  const scroll = i / 1000, scene = sceneProgressAtScroll(scroll);
  assert(scene > previousScene, 'Every scroll increment must advance the scene, without holds');
  assert(Math.abs(scrollProgressAtScene(scene) - scroll) < 1e-8, 'Navigation must invert the scroll mapping');
  previousScene = scene;
}
const journeyVh = CONFIG.timeline.heightVh - 100;
const originalJourneyVh = (MOTION.baseJourneyHeightVh - 100) / MOTION.scrollSpeed;
for (let i = 0; i <= 1000; i++) {
  const progress = i / 1000;
  assert(Math.abs(clockProgressAtScroll(scrollProgressAtClock(progress)) - progress) < 1e-9, 'The shortened field mapping must remain invertible');
}
const fieldStart = MOTION.field.start, fieldEnd = MOTION.field.end;
const startClock = clockProgressAtScroll(scrollProgressAtScene(fieldStart));
const endClock = clockProgressAtScroll(scrollProgressAtScene(fieldEnd));
const oldFieldVh = (endClock - startClock) * originalJourneyVh;
const newFieldVh = (scrollProgressAtScene(fieldEnd) - scrollProgressAtScene(fieldStart)) * journeyVh;
assert(Math.abs(newFieldVh - oldFieldVh / 2) < 1e-7, 'The entire field chapter must need exactly half as much scrolling');
assert(Math.abs(CONFIG.timeline.heightVh - (100 + originalJourneyVh - oldFieldVh / 2)) < 1e-7, 'Remove the saved scroll distance from the page height');
for (const [a,b] of [[0,.08],[.22,.40],[.59,.715],[.93,.957],[.957,1]]) {
  const oldDistance = (clockProgressAtScroll(scrollProgressAtScene(b)) - clockProgressAtScroll(scrollProgressAtScene(a))) * originalJourneyVh;
  const newDistance = (scrollProgressAtScene(b) - scrollProgressAtScene(a)) * journeyVh;
  assert(Math.abs(newDistance - oldDistance) < 1e-7, 'Other scenes must keep their original scroll distances');
}
for (const clock of [startClock,endClock]) {
  const h = 1e-6;
  const leftRate = (scrollProgressAtClock(clock) - scrollProgressAtClock(clock-h))/h;
  const rightRate = (scrollProgressAtClock(clock+h) - scrollProgressAtClock(clock))/h;
  assert(Math.abs(leftRate-rightRate)<1e-6, 'Field boundaries must preserve scroll velocity');
}
assert.equal(CONFIG.timeline.mobileHeightVh, CONFIG.timeline.heightVh, 'Mobile uses the same shortened field');
for (let i = 0; i < UI_TRANSITIONS.length; i++) {
  const timing = UI_TRANSITIONS[i];
  assert.equal(timing.duration, MOTION.revealSpan, 'Heading fades share the model clock');
  const physicalSpan = (scrollProgressAtClock(timing.enter + timing.duration) - scrollProgressAtClock(timing.enter)) * journeyVh;
  if (i < 4) assert(Math.abs(physicalSpan - MOTION.revealSpan * originalJourneyVh) < 1e-8, 'Product heading fades must retain their original scroll distance');
  assert(timing.enter + timing.duration <= timing.exit, 'The heading must finish entering before it exits');
  if (i && i < 4) assert(UI_TRANSITIONS[i - 1].exit + timing.duration <= timing.enter, 'Adjacent information panels cannot overlap');
}
for (let i = 0; i <= 100; i++) {
  const t = i / 100;
  assert(Math.abs(easeMotion(t) + easeMotion(1 - t) - 1) < 1e-12, 'Transitions have symmetric acceleration and deceleration');
  const state = sequenceState(sceneProgressAtScroll(t));
  assert(Math.abs(state.productOpacity + state.videoOpacity - 1) < 1e-10, 'Video and product crossfade together without a black flash');
}
for (const frames of [...Object.values(CONFIG.motion), CONFIG.timeline.scrollStops]) {
  assert(frames.every((f, i) => !i || f.progress > frames[i - 1].progress));
  if (frames[0].rotation) {
    for (let i = 1; i < frames.length; i++) {
      const { progress: before, ...poseBefore } = frames[i - 1];
      const { progress: after, ...poseAfter } = frames[i];
      assert.notDeepEqual(poseBefore, poseAfter, 'Product animation must not contain stationary intervals');
    }
  }
  for (let i = 0; i <= 3000; i++) {
    const p = i / 3000, a = sampleKeyframes(frames, p), b = sampleKeyframes(frames, Math.min(1, p + 1e-6));
    for (const key of ['position', 'rotation']) if (a[key]) a[key].forEach((v, k) => {
      assert(Number.isFinite(v)); assert(Math.abs(v - b[key][k]) < .003, 'Discontinuous ' + key);
    });
  }
  // Tangent continuity catches visible joins even when the positions themselves are continuous.
  for (const frame of frames.slice(1, -1)) {
    const h = 1e-7, a = sampleKeyframes(frames, frame.progress - h), b = sampleKeyframes(frames, frame.progress), c = sampleKeyframes(frames, frame.progress + h);
    for (const key of ['position', 'rotation']) if (a[key]) a[key].forEach((v, k) => {
      const before = (b[key][k] - v) / h, after = (c[key][k] - b[key][k]) / h;
      assert(Math.abs(before - after) < .02, 'Velocity jump in ' + key);
    });
  }
}
const fixture = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), new THREE.MeshBasicMaterial());
// A deep headset-shaped volume must fit during every information-scene frame,
// including tall tablets and pointer tilt, in either scroll direction.
const framingCorners=[];
for(const x of[-.5,.5])for(const y of[-.4,.4])for(const z of[-.6,.6])framingCorners.push(new THREE.Vector3(x,y,z));
for(const aspect of[.46,.85,1,1.33,1.5,1.78,2.4]){
  const camera=new THREE.PerspectiveCamera(35,aspect,.015,150);camera.position.z=6.5;camera.updateMatrixWorld();
  const height=13*Math.tan(35*Math.PI/360),width=height*aspect;
  for(let i=215;i<=605;i++){
    const pose=samplePose(i/1000,aspect<.8);
    const position=new THREE.Vector3(pose.position[0]*width,pose.position[1]*height,pose.position[2]);
    const rotation=new THREE.Euler(pose.rotation[0]+.015,pose.rotation[1]+.025,pose.rotation[2]);
    const scale=fitObjectScale(framingCorners,position,rotation,camera,height*pose.scale);
    for(const corner of framingCorners){
      const projected=corner.clone().applyEuler(rotation).multiplyScalar(scale).add(position).project(camera);
      assert(Math.abs(projected.x)<=.930001 && Math.abs(projected.y)<=.930001,'Information headset must stay inside the frame with a 3.5% margin');
    }
  }
}
fixture.position.set(10, -8, 5);
const normalized = normalizeModel(fixture); normalized.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(normalized);
assert(Math.abs(Math.max(...bounds.getSize(new THREE.Vector3()).toArray()) - 1) < 1e-6);
assert(bounds.getCenter(new THREE.Vector3()).length() < 1e-6);
const bytes = await readFile(new URL('../public/models/aura-one.glb', import.meta.url));
assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(8), bytes.length);
const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
assert.equal(doc.scenes[0].nodes.length, 3);
for (const name of ['headsetGroup', 'controller_left', 'controller_right']) assert(doc.nodes.some(n => n.name === name));
for (const name of ['body', 'lens', 'cushion', 'strap', 'sensors']) assert(doc.nodes.some(n => n.name.startsWith(name + '_')));
const lens = doc.materials.find(m => m.name === 'lens_mat');
assert(lens.extensions.KHR_materials_transmission.transmissionFactor > .9);
assert.equal(lens.pbrMetallicRoughness.roughnessFactor, .03);
assert(!lens.pbrMetallicRoughness.baseColorTexture, 'Baked lens reflection must be removed');
assert(doc.asset.extras.auraShellCleaned, 'The generated shell must have its branding removed');
const shell = doc.materials.find(m => m.name === 'body_mat');
assert(!shell.pbrMetallicRoughness.baseColorTexture, 'The front shell must be plain, without the logo texture');
for (const progress of [.925, .933, .945, .955]) {
  assert.equal(samplePose(progress).rotation[1], Math.PI, 'Exit stays straight until the camera clears the bridge');
  if (progress < .952) assert.equal(sequenceState(progress).centerApproach, 1, 'Exit must stay centered on the bridge');
}
assert(samplePose(.933).position[2] > 6.5, 'Exit starts at the near optical bridge');
assert(samplePose(.948).position[2] < 6.5, 'The bridge passes in front of the camera before the turn');
const immersionSource = await readFile(new URL('../src/immersive.js', import.meta.url), 'utf8');
assert(CONFIG.video.enabled && CONFIG.video.url === '/media/inside.mp4' && CONFIG.video.useAsFinalView, 'Restore the original video');
assert(immersionSource.includes('VideoTexture'), 'One video supplies the lens screens and the immersive scene');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert(html.includes('controllers-panel'));
assert(!html.includes('finale-title')); assert(!html.includes('header-cta'));
assert(html.indexOf('id="footer-wordmark"') > html.indexOf('<footer'), 'The final wordmark belongs to the footer');
assert(samplePose(.75, false).position[0] < -.9, 'Desktop headset leaves the era scene to the left');
assert(samplePose(.75, true).position[1] > .5, 'Responsive headset leaves the era scene vertically');
for (const name of ['controllerLeft', 'controllerRight']) assert(sampleKeyframes(CONFIG.motion[name], .75).position[0] > .9, 'Both controllers leave to the right');
const reentry = samplePose(.792);
assert(reentry.position[0] > .7 && reentry.position[1] < -.5, 'Reentry starts in the lower-right corner');
assert.equal(reentry.rotation[1], 0, 'Reentry first shows the front of the headset');
assert(html.includes('НОВАЯ ЭРА ВИРТУАЛЬНОЙ РЕАЛЬНОСТИ'));
for (const [width, height] of [[1200, 800], [390, 844]]) {
  for (let line = 0; line < 4; line++) {
    const entry = cylinderLinePose(ERA_RANGE.start, line, 4, width, height);
    const exit = cylinderLinePose(ERA_RANGE.end, line, 4, width, height);
    assert(Math.abs(exit.angle - entry.angle - 360) < 1e-8, 'Every line completes one full revolution');
    assert(Math.cos(entry.angle * Math.PI / 180) < 0 && Math.cos(exit.angle * Math.PI / 180) < 0, 'Text starts and ends on the hidden rear of the cylinder');
    let previous = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const eraBeat = scrollProgressAtScene(ERA_RANGE.end) - scrollProgressAtScene(ERA_RANGE.start);
      const scroll = scrollProgressAtScene(ERA_RANGE.start) + eraBeat * i / 100;
      const { angle, radius, y } = cylinderLinePose(sceneProgressAtScroll(scroll), line, 4, width, height);
      assert(Math.abs(angle - entry.angle - easeMotion(i / 100) * 360) < 1e-5, 'The text rotation follows the common transition clock');
      assert(angle > previous, 'The cylinder rotates continuously without a pause'); previous = angle;
      if (Math.cos(angle * Math.PI / 180) >= 0) assert(Math.abs(y) <= radius + 1e-8, 'Visible lines remain on the cylinder, not a linear scrolling plane');
    }
  }
}
const sceneSource = await readFile(new URL('../src/scene.js', import.meta.url), 'utf8');
assert(!sceneSource.includes('landscape.js'));
assert(sceneSource.includes('anchor.copy(bridge)'), 'Entrance aims at the midpoint between both eyes');
assert(CONFIG.timeline.heightVh > 100 && CONFIG.timeline.mobileHeightVh > 100, 'The journey must provide a scrollable timeline');
console.log('Passed: exact front/end poses, centered entrance, original video immersion, desktop finishes, C1 motion, frame-rate-independent damping, GLB and header.');
await import('./check-explode.mjs');
await import('./check-background.mjs');

