import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { HORIZON_Y, titleLayout, videoCover } from '../src/glass-title.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Verify the shipped asset independently of its offline generator.
const titleBytes=await readFile(new URL('../public/models/glass-title.glb',import.meta.url));
const model=await new GLTFLoader().parseAsync(titleBytes.buffer.slice(titleBytes.byteOffset,titleBytes.byteOffset+titleBytes.byteLength),'');
const geometry=model.scene.children[0].geometry;
geometry.computeBoundingBox();
const box=geometry.boundingBox;
assert(Math.abs(box.max.x-box.min.x-5)<1e-5,'Preserve approved title aspect');
assert(Math.abs(box.max.y-box.min.y-1)<1e-5,'Preserve normalized title height');
assert(Math.abs(box.min.y)<1e-5&&Math.abs(box.min.x+box.max.x)<1e-5,'Keep centered baseline');
assert.equal(geometry.index.count/3,40848,'Preserve the original rounded geometry');
for(const index of geometry.index.array)assert(index<geometry.attributes.position.count);
const normals=geometry.attributes.normal.array;
for(let i=0;i<normals.length;i+=3)assert(Math.abs(Math.hypot(normals[i],normals[i+1],normals[i+2])-1)<1e-5,'Valid smooth glass normals');
geometry.dispose();model.scene.children[0].material.dispose();

// Check the framing contract against the independently calculated CSS cover crop.
for (const [w, h, header] of [[1920,1080,72],[1366,768,72],[3440,1440,72],
  [2560,720,72],[768,1024,66],[390,844,66],[844,390,58],[320,568,66]]) {
  const coverScale = Math.max(w / 1920, h / 1080);
  const videoTop = (h - 1080 * coverScale) / 2;
  const horizon = videoTop + 1080 * HORIZON_Y * coverScale;
  const layout = titleLayout(w, h, header);
  assert(Math.abs(layout.baseline - horizon) < 1e-7, 'Baseline follows the visible video horizon');
  assert(Math.abs(layout.top + layout.height - horizon) < 1e-7);
  assert(Math.abs(layout.left + layout.width / 2 - w / 2) < 1e-7, 'Exact horizontal center');
  assert(layout.width <= .88 * w + 1e-7 && layout.left >= 0, 'Keep both side margins');
  assert(layout.top >= header + 20 - 1e-7, 'Leave room for the existing header');
  const crop = videoCover(w,h,1920,1080);
  for (const [axis, dimension, sourceDimension] of [[0,w,1920],[1,h,1080]]) {
    assert(Math.abs(crop.repeat[axis] - dimension / (sourceDimension * coverScale)) < 1e-10);
    assert(Math.abs(crop.offset[axis] - (1 - crop.repeat[axis]) / 2) < 1e-10);
  }
}
const fullHD = titleLayout(1920,1080);
assert(Math.abs(fullHD.width / 1920 - .88) < 1e-10);
assert(fullHD.height / fullHD.baseline > .66, 'Fill about two thirds of the sky at Full HD');
const bytes = await readFile(new URL('../public/media/inside.mp4', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
  '4d190dca310c6ee75a5366c8614148f82a135b8ad2cb1cfa8c538d208a227e4a', 'Original video is unchanged');
const mask = JSON.parse(await readFile(new URL('../public/media/butterfly-occlusion.json', import.meta.url), 'utf8'));
assert.equal(mask.sourceSha256, createHash('sha256').update(bytes).digest('hex'), 'Foreground belongs to this exact video');
assert.equal(mask.frames.length, mask.frameCount);
assert.equal(mask.fps, 24);
assert.equal(mask.frameCount, 240);
for (const frame of mask.frames) {
  assert.equal(frame.length % 3, 0);
  for (let i = 0; i < frame.length; i += 3) {
    assert(Number.isInteger(frame[i]) && frame[i] >= 0);
    assert(frame[i + 1] > 0 && frame[i] + frame[i + 1] <= mask.width * mask.height);
    assert(frame[i + 2] > 0 && frame[i + 2] <= 255);
  }
}
console.log('Passed: horizon/cover alignment, centered responsive title, header clearance and original video SHA-256.');
