import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EXPLODE_CONFIG as C, explodeStateAt } from '../src/partsConfig.js';
import { createSpringCable } from '../src/springCable.js';
import { createExplodeScene } from '../src/explodeScene.js';
import { fitObjectScaleInViewport } from '../src/framing.js';
import { CONFIG } from '../src/config.js';
import { easeMotion } from '../src/motion.js';
import { MOBILE_CONFIG as M } from '../src/mobileConfig.js';
import { sceneProgressAtScroll, scrollProgressAtScene } from '../src/timeline.js';

// The aligned layers remain inside the product column and above mobile copy.
for (const aspect of [390 / 844, .85, 1.33, 1.6, 2.4]) {
  const mobile = aspect < .7, camera = new THREE.PerspectiveCamera(35, aspect, .015, 150);
  const height = 13 * Math.tan(35 * Math.PI / 360), width = height * aspect;
  const position = new THREE.Vector3(mobile ? 0 : width * C.camera.x, height * (mobile ? M.framing.panelY : C.camera.y), C.camera.z);
  const rotation = new THREE.Euler(C.camera.pitch, C.camera.yaw, 0);
  const bounds = mobile ? [.04, .96, .16, .56] : [.04, .595, .13, .90];
  const corners = [];
  const depth = C.framing.restDepth + C.split.distance / 2 + C.framing.margin;
  for (const x of [-C.framing.halfWidth, C.framing.halfWidth]) for (const y of [-C.framing.halfHeight, C.framing.halfHeight]) for (const z of [-depth, depth]) corners.push(new THREE.Vector3(x, y, z));
  for (const orbit of [0, .15, C.camera.orbitDegrees * Math.PI / 180]) {
    camera.position.set(position.x * (1 - Math.cos(orbit)) + Math.sin(orbit) * 6.5, 0, position.x * Math.sin(orbit) + Math.cos(orbit) * 6.5);
    camera.rotation.y = orbit; camera.updateMatrixWorld();
    const scale = fitObjectScaleInViewport(corners, position, rotation, camera, height * C.camera.scale, bounds);
    assert(scale > 0);
    for (const corner of corners) {
      const projected = corner.clone().applyEuler(rotation).multiplyScalar(scale).add(position).project(camera);
      const x = (projected.x + 1) / 2, y = (1 - projected.y) / 2;
      assert(x >= bounds[0] - 1e-8 && x <= bounds[1] + 1e-8 && y >= bounds[2] - 1e-8 && y <= bounds[3] + 1e-8, 'Exploded view cannot overlap the right-hand information or mobile copy');
    }
  }
}

const progress = local => C.chapter.start + local * (C.chapter.end - C.chapter.start);
assert.equal(explodeStateAt(progress(0)).separation, 0);
assert.equal(explodeStateAt(progress(1)).separation, C.split.distance);
assert.equal(explodeStateAt(C.chapter.exit).weight, 0);
assert.equal(explodeStateAt(C.chapter.exit).separation, 0);
let previous = 0;
for (let i = 0; i <= 1000; i++) {
  const value = explodeStateAt(progress(i / 1000)).separation;
  assert(value >= 0 && value <= C.split.distance, 'The stretch has no bounces or overshoot');
  if (i) assert(value > previous, 'Every scroll step must open the device: no closed wait or fully-open hold');
  const state = explodeStateAt(progress(i / 1000));
  assert.equal(state.weight, state.extension, 'Approach and opening use the same progress');
  previous = value;
}
previous = C.split.distance;
for (let i = 0; i <= 1000; i++) {
  const value = explodeStateAt(C.chapter.end + i / 1000 * (C.chapter.exit - C.chapter.end)).separation;
  assert(value <= previous + 1e-12 && value >= 0, 'Closing cannot rebound'); previous = value;
}

const returnStart = scrollProgressAtScene(C.chapter.end), returnEnd = scrollProgressAtScene(C.chapter.exit);
const returnVh = (returnEnd - returnStart) * (CONFIG.timeline.heightVh - 100);
const openingVh = (scrollProgressAtScene(C.chapter.end) - scrollProgressAtScene(C.chapter.start)) * (CONFIG.timeline.heightVh - 100);
assert(Math.abs(returnVh - openingVh) < 1e-6, 'Opening and reassembly must have exactly the same scroll duration');
for (let i = 0; i <= 100; i++) {
  const t = i / 100;
  const open = explodeStateAt(sceneProgressAtScroll(scrollProgressAtScene(C.chapter.start) + (returnEnd - returnStart) * t));
  const close = explodeStateAt(sceneProgressAtScroll(returnStart + (returnEnd - returnStart) * (1 - t)));
  assert(Math.abs(open.extension - easeMotion(t)) < 1e-8, 'Expansion follows the shared easing');
  assert(Math.abs(open.extension - close.extension) < 1e-8, 'Reassembly retraces expansion at exactly the same speed');
}
previous = C.split.distance;
for (let step = 1; step <= Math.ceil(returnVh); step++) {
  const scroll = returnStart + (returnEnd - returnStart) * Math.min(1, step / returnVh);
  const separation = explodeStateAt(sceneProgressAtScroll(scroll)).separation;
  assert(previous - separation < .025, 'A one-vh scroll step cannot abruptly close the headset');
  assert(separation <= previous + 1e-10); previous = separation;
}

const cable = createSpringCable();
const geometry = cable.mesh.geometry, positions = geometry.attributes.position, normals = geometry.attributes.normal;
cable.update(.8);
const stretched = positions.array.slice();
cable.update(.03); cable.update(.8);
assert.equal(cable.mesh.geometry, geometry); assert.equal(geometry.attributes.position, positions);
assert.deepEqual(positions.array, stretched, 'Stretching back and forth reuses identical vertex buffers');
for (let i = 0; i < positions.count; i++) {
  assert(Number.isFinite(positions.getZ(i)));
  assert(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < 1e-6, 'Cable normal remains unit length at any extension');
}
let disposed = 0; geometry.addEventListener('dispose', () => disposed++); cable.dispose(); assert.equal(disposed, 1);

// Headless Three.js fixture exercises real bindings, trajectories and teardown without WebGL.
globalThis.innerWidth = 1440; globalThis.innerHeight = 900;
const root = new THREE.Group(), scene = new THREE.Scene(); scene.add(root);
const sourceGeometries = [], sourceMaterials = [];
function source(name, xyz, size = [.1, .1, .02]) {
  const geometry = new THREE.BoxGeometry(...size), material = new THREE.MeshStandardMaterial();
  geometry.translate(...xyz); const mesh = new THREE.Mesh(geometry, material); mesh.name = name; root.add(mesh);
  sourceGeometries.push(geometry); sourceMaterials.push(material); return mesh;
}
const lens = source('lens_left', [-.14, -.074, .277]);
source('lens_right', [.14, -.074, .277]);
source('sensors_11', [.12, -.07, .477]); source('sensors_12', [-.12, -.07, .477]);
source('sensors_3', [.12, -.09, .491], [.047, .10, .007]);
source('sensors_4', [-.12, -.09, .491], [.047, .10, .007]);
const front = source('body_1', [0, 0, .44], [.6, .3, .10]);
const back = source('cushion_1', [0, -.04, .24], [.6, .3, .05]);
source('strap_1', [0, 0, -.3], [.6, .3, .1]);
root.updateMatrixWorld(true);
const beforeFront = front.matrixWorld.clone(), beforeLens = lens.matrixWorld.clone();
const controller = createExplodeScene({ headset: { headsetGroup: root }, scene, camera: new THREE.PerspectiveCamera(), renderer: {}, reducedMotion: { matches: false }, lowQuality: true });
assert.equal(root.getObjectByName('front_shell').getObjectByName('body_1'), front);
assert.equal(root.getObjectByName('back_shell').getObjectByName('cushion_1'), back);
assert.equal(root.getObjectByName('lens_left'), lens, 'The original GLB optics are reused');
root.updateMatrixWorld(true);
const frontShell = root.getObjectByName('front_shell'), inverseMount = new THREE.Matrix4(), mounted = new THREE.Matrix4();
const cameraMounts = ['sensors_11', 'sensors_12', 'sensors_3', 'sensors_4'].map(name => {
  const object = root.getObjectByName(name);
  assert(frontShell.getObjectByName(name) === object, 'Every camera barrel and glass cover belongs to the front shell');
  return { object, rest: frontShell.matrixWorld.clone().invert().multiply(object.matrixWorld) };
});
const snapshots = [];
controller.update(progress(0)); const rest = controller.state.parts;
for (let i = 0; i <= 100; i++) {
  controller.update(progress(i / 100)); const state = controller.state.parts;
  root.updateMatrixWorld(true); inverseMount.copy(frontShell.matrixWorld).invert();
  for (const camera of cameraMounts) {
    mounted.multiplyMatrices(inverseMount, camera.object.matrixWorld);
    mounted.elements.forEach((value, index) => assert(Math.abs(value - camera.rest.elements[index]) < 1e-12, 'Cameras must remain seated in the visor while the shells move'));
  }
  state.forEach((part, index) => {
    assert.equal(part.position[0], rest[index].position[0], 'No part may fly sideways');
    assert.equal(part.position[1], rest[index].position[1], 'No part may fly up or down');
    assert(part.rotation.every(value => value === 0), 'All optical and internal layers retain their orientation');
    const target = C.split.seamZ + C.parts[index].layer * C.split.distance;
    assert(part.position[2] >= Math.min(rest[index].position[2], target) - 1e-10 && part.position[2] <= Math.max(rest[index].position[2], target) + 1e-10, 'A part cannot bounce past its axial layer');
  });
  snapshots.push(state);
}
assert.equal(controller.state.bloom, false); assert.equal(controller.state.cableCount, C.reduced.cables);
assert.equal(controller.state.parts.filter(part => part.visible).length, C.reduced.maxParts + C.reduced.fasteners);
assert.equal(controller.state.fasteners, C.reduced.fasteners); assert.equal(controller.state.fastenerDrawCalls, 1, 'Reduced desktop fasteners share one draw call');
assert(controller.state.parts.some(part => part.name === 'pcb_main' && part.todo));
for (let i = 100; i >= 0; i--) { controller.update(progress(i / 100)); assert.deepEqual(controller.state.parts, snapshots[i], 'Reverse scroll retraces the same transforms and visibility'); }
controller.update(C.chapter.exit);
root.updateMatrixWorld(true);
assert(front.matrixWorld.equals(beforeFront), 'Front shell returns to its exact GLB rest transform');
assert(lens.matrixWorld.equals(beforeLens), 'Lens rest transform remains suitable for the later video scene');
assert(controller.state.parts.filter(part => part.todo).every(part => !part.visible));
assert.equal(controller.state.fasteners, 0, 'Extra fasteners are invisible outside the stretch interval');
controller.update(progress(.92)); controller.update(C.chapter.exit); controller.update(1);
assert(controller.state.parts.every(part => part.rotation.every(value => value === 0)), 'No spin leaks into controllers or the later optical chapter');
controller.dispose(); controller.dispose();
sourceGeometries.forEach(g => g.dispose()); sourceMaterials.forEach(m => m.dispose());
globalThis.innerWidth = 1440;
const desktopRoot = new THREE.Group(), desktopScene = new THREE.Scene(); desktopScene.add(desktopRoot);
const desktop = createExplodeScene({ headset: { headsetGroup: desktopRoot }, scene: desktopScene, camera: new THREE.PerspectiveCamera(), renderer: {}, reducedMotion: { matches: false }, lowQuality: false });
desktop.update(progress(.1));
assert(desktop.state.parts.every(part => !part.visible), 'Procedural internals stay hidden until the shells have enough clearance');
desktopRoot.updateMatrixWorld(true);
const vertex = new THREE.Vector3(), instance = new THREE.Matrix4(), matrix = new THREE.Matrix4();
let checkedVertices = 0;
for (const spec of C.parts) {
  const part = desktopRoot.getObjectByName(spec.name);
  part.traverse(object => {
    const positions = object.geometry?.attributes.position;
    if (!positions) return;
    const count = object.isInstancedMesh ? object.count : 1;
    for (let i = 0; i < count; i++) {
      if (object.isInstancedMesh) { object.getMatrixAt(i, instance); matrix.multiplyMatrices(object.matrixWorld, instance); }
      else matrix.copy(object.matrixWorld);
      for (let v = 0; v < positions.count; v++) {
        vertex.fromBufferAttribute(positions, v).applyMatrix4(matrix);
        const footprint = (vertex.x / C.internals.cavityRadiusX) ** 2 + ((vertex.y - C.internals.cavityCenterY) / C.internals.cavityRadiusY) ** 2;
        assert(footprint < 1, `${spec.name} must fit inside the shell contour instead of protruding around its edge`);
        checkedVertices++;
      }
    }
  });
}
assert(checkedVertices > 1000, 'Check actual curved geometry and instanced components, not just their pivots');
for (const name of ['display_left', 'display_right', 'shield_left', 'shield_right']) assert.equal(desktopRoot.getObjectByName(name).geometry.type, 'CylinderGeometry', 'Optical backing must not look like square lenses');
assert(desktopRoot.getObjectByName('frame_inner').userData.contouredFrame, 'The chassis follows the headset contour');
desktop.update(progress(1));
assert.equal(desktop.state.parts.filter(part => part.visible).length, 33);
assert.equal(desktop.state.fasteners, 16); assert.equal(desktop.state.fastenerDrawCalls, 1);
// Mobile framing reuses static mesh bounds while transforms change during scroll.
globalThis.innerWidth=390; globalThis.innerHeight=844;
const computeBounds=THREE.BufferGeometry.prototype.computeBoundingBox;
let boundScans=0;
THREE.BufferGeometry.prototype.computeBoundingBox=function(){boundScans++;return computeBounds.call(this);};
try {
  desktop.update(progress(.8)); desktop.frameCameraAndProduct(4,2);
  const initialScans=boundScans;
  for(const t of [.85,.9,.75,.6,.85]){desktop.update(progress(t));desktop.frameCameraAndProduct(4,2);}
  assert.equal(boundScans,initialScans,'Mobile scrolling must not rescan geometry vertices each frame');
  assert(desktop.framingCorners.every(p=>p.toArray().every(Number.isFinite)));
  desktop.update(C.chapter.exit);
  assert.equal(desktop.pixelRatioCap,C.render.maxPixelRatio,'Leaving details must retain drawing-buffer size');
} finally {THREE.BufferGeometry.prototype.computeBoundingBox=computeBounds;globalThis.innerWidth=1440;}

desktop.update(C.chapter.exit); assert(desktop.state.parts.every(part => !part.visible));
assert.equal(desktop.state.fasteners, 0); desktop.dispose();
console.log('Passed: continuous approach, gradual return to controllers, fixed visor cameras, compact round internals, reverse scrub, batching and disposal.');
