import assert from 'node:assert/strict';
import { createBackground, backgroundStateAt } from '../src/background.js';

assert.deepEqual(backgroundStateAt(1), backgroundStateAt(0), 'The final star field must restore its opening state');
for (const progress of [.915, .924, .94, .96, .98, 1]) {
  assert.equal(backgroundStateAt(progress).gather, 0, 'Stars must be spread out before the video fades away');
}
assert.equal(backgroundStateAt(.895).opacity, 0, 'The particle field stays hidden during full immersion');

const savedGlobals = { innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight, devicePixelRatio: globalThis.devicePixelRatio };
Object.assign(globalThis, { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1 });
try {
  // Exercise actual canvas positions through a dive and return. This catches
  // stale spring positions even if the opacity and gather helpers look correct.
  for (const reduced of [false, true]) {
    let points = [], clears = 0;
    const ctx = {
      setTransform() {}, clearRect() { clears++; }, beginPath() {},
      moveTo(x, y) { points.push([x, y]); }, lineTo() {}, stroke() {},
    };
    const canvas = { style: {}, getContext: () => ctx };
    const pointer = { x: 600, y: 400, active: false };
    const background = createBackground(canvas, { pointer, reducedMotion: { matches: reduced }, lowQuality: true });
    const frame = (progress, dt = 1 / 60) => { points = []; background.update(dt, progress); return points; };
    const opening = frame(0);
    assert(opening.length > 100);
    frame(.84);
    const beforeHidden = clears;
    assert.equal(frame(.90).length, 0);
    assert(clears > beforeHidden, 'Hidden canvas must discard the previous gathered image');
    frame(.916);
    assert.deepEqual(frame(1), opening, 'Exit must immediately show the complete field, without a central clump');
    for (const fps of [15, 60, 144]) {
      frame(.90, 1 / fps);
      assert.deepEqual(frame(.96, 1 / fps), opening, 'The restored layout cannot depend on FPS or hidden-frame history');
    }
    frame(.90); frame(.84);
    background.resize();
    assert.deepEqual(frame(0), opening, 'Reverse scroll and resize must restore the same particle layout');
  }
} finally {
  for (const [key, value] of Object.entries(savedGlobals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}
console.log('Passed: restored star field after immersion, cleared hidden frames, reverse scroll, resize and reduced motion.');
