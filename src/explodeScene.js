import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EXPLODE_CONFIG as C, smoothRange, explodeStateAt } from './partsConfig.js';
import { createSpringCable } from './springCable.js';
import { MOBILE_CONFIG as M, deviceProfile } from './mobileConfig.js';

function chassisContour() {
  const shape = new THREE.Shape();
  shape.moveTo(-.245, 0);
  shape.bezierCurveTo(-.245, .075, -.17, .115, 0, .115);
  shape.bezierCurveTo(.17, .115, .245, .075, .245, 0);
  shape.bezierCurveTo(.245, -.075, .17, -.125, .07, -.12);
  shape.bezierCurveTo(.035, -.118, .04, -.075, 0, -.075);
  shape.bezierCurveTo(-.04, -.075, -.035, -.118, -.07, -.12);
  shape.bezierCurveTo(-.17, -.125, -.245, -.075, -.245, 0);
  const inner = shape.getPoints(16).reverse().map(point => new THREE.Vector2(point.x * .92, point.y * .84));
  shape.holes.push(new THREE.Path(inner));
  return shape;
}

function placeholder(spec, palette) {
  // TODO Blender: replace these normalized placeholder meshes with named GLB nodes.
  let mesh;
  const box = (x, y, z, material) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material);
  if (spec.type === 'board') {
    mesh = new THREE.Mesh(new RoundedBoxGeometry(.18, .074, .009, 2, .004), palette.board);
    const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), palette.chip, 5), dummy = new THREE.Object3D();
    for (let i = 0; i < 5; i++) {
      dummy.scale.set(i ? .018 : .044, i ? .011 : .033, i ? .006 : .008);
      dummy.position.set(i ? (i % 2 ? -.062 : .062) : 0, i ? (i < 3 ? .020 : -.020) : 0, .008);
      dummy.updateMatrix(); chips.setMatrixAt(i, dummy.matrix);
    }
    mesh.add(chips);
    const traces = [];
    for (let i = 0; i < 9; i++) { const y = (i - 4) * .006; traces.push(-.08, y, .005, -.03, y, .005, .03, y, .005, .08, y, .005); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(traces, 3));
    mesh.add(new THREE.LineSegments(geometry, palette.traces));
  } else if (spec.type === 'battery') {
    mesh = new THREE.Mesh(new RoundedBoxGeometry(.135, .055, .022, 2, .008), palette.battery);
    for (const x of [-.04, .04]) { const tab = box(.012, .008, .004, palette.metal); tab.position.set(x, .031, 0); mesh.add(tab); }
  } else if (spec.type === 'display') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.073, .073, .009, 40).rotateX(Math.PI / 2), palette.chip);
    const panel = new THREE.Mesh(new THREE.CircleGeometry(.067, 40), palette.display); panel.position.z = .005; mesh.add(panel);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(.071, .002, 5, 40), palette.metal); bezel.position.z = .005; mesh.add(bezel);
    mesh.userData.circularOpticalModule = true;
  } else if (spec.type === 'shield') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.071, .071, .004, 40).rotateX(Math.PI / 2).scale(1.06, .93, 1), palette.metal);
  } else if (spec.type === 'heatsink') {
    mesh = box(.14, .055, .008, palette.metal);
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(.004, .055, .012), palette.metal, 12), dummy = new THREE.Object3D();
    for (let i = 0; i < 12; i++) { dummy.position.set((i - 5.5) * .010, 0, .010); dummy.updateMatrix(); fins.setMatrixAt(i, dummy.matrix); }
    mesh.add(fins);
  } else if (spec.type === 'frame') {
    const geometry = new THREE.ExtrudeGeometry(chassisContour(), { depth: .008, bevelEnabled: true, bevelSegments: 1, bevelSize: .001, bevelThickness: .001, steps: 1, curveSegments: 20 });
    geometry.translate(0, 0, -.004);
    mesh = new THREE.Mesh(geometry, palette.frame); mesh.userData.contouredFrame = true;
  } else if (spec.type === 'lens') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(.093, .093, .012, 40), palette.lens); mesh.geometry.rotateX(Math.PI / 2);
  } else if (spec.type === 'fan') {
    mesh = new THREE.Mesh(new THREE.TorusGeometry(.038, .004, 6, 32), palette.metal);
    const blades = new THREE.InstancedMesh(new THREE.BoxGeometry(.024, .007, .003), palette.chip, 7);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 7; i++) { const angle = i / 7 * Math.PI * 2; dummy.position.set(Math.cos(angle) * .019, Math.sin(angle) * .019, 0); dummy.rotation.z = angle + .4; dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix); }
    mesh.add(blades);
  } else if (spec.type === 'cable') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.05, 0, 0), new THREE.Vector3(-.018, .026, .007), new THREE.Vector3(.028, -.01, .01), new THREE.Vector3(.05, .01, 0)]);
    mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .0025, 5, false), palette.metal);
  } else if (spec.type === 'screw') {
    // Named transforms allow individual Blender replacements; missing screws share one draw call.
    mesh = new THREE.Object3D();
  } else {
    mesh = box(.042, .038, .025, palette.chip);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(.012, 20), palette.lens); eye.position.z = .014; mesh.add(eye);
  }
  mesh.name = spec.name; mesh.userData.todo = `TODO: replace ${spec.name} with Blender mesh`;
  mesh.userData.proceduralPlaceholder = true;
  mesh.position.set(...spec.origin);
  if (spec.scale) mesh.scale.set(...spec.scale);
  return mesh;
}

// Rest transforms are kept intact so returning to the original lens/video chapter is exact.
export function bindExplodeParts(root, palette) {
  const existingFront = root.getObjectByName('front_shell'), existingBack = root.getObjectByName('back_shell');
  const front = existingFront || new THREE.Group(), back = existingBack || new THREE.Group();
  front.name = 'front_shell'; back.name = 'back_shell';
  if (!front.parent) root.add(front); if (!back.parent) root.add(back);
  const parts = [];
  root.updateMatrixWorld(true);
  for (const spec of C.parts) {
    let object = root.getObjectByName(spec.name), generated = false;
    if (!object) { object = placeholder(spec, palette); root.add(object); generated = true; }
    const pivot = new THREE.Group(); pivot.name = `${spec.name}_pivot`; root.add(pivot);
    // Bounds are expressed in headset-local space, independent of the presentation transform.
    const inverse = root.matrixWorld.clone().invert();
    const center = generated && spec.type === 'screw' ? object.position.clone() : new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).applyMatrix4(inverse);
    pivot.position.copy(center); root.updateMatrixWorld(true); pivot.attach(object);
    // Keep the source lens carriers with their matching optical discs.
    const companions = spec.type === 'lens' ? [spec.name === 'lens_left' ? 'sensors_10' : 'sensors_9']
      : spec.name === 'sensors_11' ? ['sensors_3', 'sensors_5', 'sensors_7', 'sensors_13']
      : spec.name === 'sensors_12' ? ['sensors_4', 'sensors_6', 'sensors_8', 'sensors_14'] : [];
    for (const name of companions) { const mesh = root.getObjectByName(name); if (mesh) pivot.attach(mesh); }
    // Camera glass, barrels and sensor boards retain one rigid mount on the visor.
    if (spec.mount === 'front_shell') front.attach(pivot);
    if (spec.type === 'lens') {
      const screens = [];
      root.traverse(mesh => { if (mesh.name === 'optical_video_screen' && Math.sign(mesh.position.x) === Math.sign(center.x)) screens.push(mesh); });
      screens.forEach(screen => pivot.attach(screen));
    }
    const flightMaterial = [];
    // Separate material references so source visor/optical materials are never recolored.
    pivot.traverse(mesh => {
      if (!mesh.isMesh || mesh.name === 'optical_video_screen' || generated || spec.mount) return;
      const clone = material => {
        const copy = material.clone();
        if (copy.emissive) {
          flightMaterial.push({ material: copy, intensity: copy.emissiveIntensity, emissive: copy.emissive.clone() });
          copy.emissive.set(C.colors.internal); copy.emissiveIntensity = 0;
        }
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    parts.push({ spec, pivot, origin: pivot.position.clone(), generated, flightMaterial, arrival: 0 });
  }
  if (!existingFront || !existingBack) {
    // Source GLB has disconnected, baked meshes. Group them without cutting or replacing it.
    for (const child of [...root.children]) {
      if (child === front || child === back || parts.some(part => part.pivot === child)) continue;
      const rear = /^(strap|cushion)(_|$)|^body_[3-6]$/.test(child.name);
      (rear ? back : front).attach(child);
    }
  }
  return { front, back, parts, frontRest: front.position.clone(), backRest: back.position.clone() };
}

function palette() {
  const material = (color, metalness = .3, roughness = .35) => new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive: C.colors.internal, emissiveIntensity: C.glow.intensity });
  return {
    board: material(C.colors.board, .15, .60), chip: material('#111416', .12, .68), battery: material('#303437', .3, .62),
    metal: material(C.colors.metal, .78, .50), frame: material('#282d30', .4, .55),
    display: new THREE.MeshStandardMaterial({ color: '#10161a', metalness: .25, roughness: .32, emissive: '#203040', emissiveIntensity: .02 }),
    lens: new THREE.MeshPhysicalMaterial({ color: '#c6d3dd', metalness: .05, roughness: .07, clearcoat: 1, emissiveIntensity: 0, transparent: true, opacity: .9 }),
    traces: new THREE.LineBasicMaterial({ color: '#ab9870', transparent: true, opacity: .55 }),
  };
}

// Uses the existing scrubbed scene progress. There is no second timeline, trigger or RAF.
export function createExplodeScene({ headset, scene, camera, renderer, reducedMotion, lowQuality }) {
  const root = headset.headsetGroup, materials = palette();
  const originalObjects=[];
  root.traverse(object=>{if(object!==root)originalObjects.push({object,parent:object.parent,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone(),visible:object.visible,material:object.material});});
  const binding = bindExplodeParts(root, materials), { front, back, parts, frontRest, backRest } = binding;
  const extras = new THREE.Group(); extras.name = 'explode_effects'; root.add(extras);
  const fastenerParts = parts.filter(part => part.generated && part.spec.type === 'screw');
  let fastenerBatch = null;
  if (fastenerParts.length) {
    const shaft = new THREE.CylinderGeometry(.0035, .0035, .018, 8).rotateX(Math.PI / 2);
    const head = new THREE.CylinderGeometry(.0065, .0065, .004, 10).rotateX(Math.PI / 2).translate(0, 0, .011);
    fastenerBatch = new THREE.InstancedMesh(mergeGeometries([shaft, head]), materials.metal, fastenerParts.length);
    shaft.dispose(); head.dispose();
    fastenerBatch.name = 'screws_internal'; fastenerBatch.userData.todo = 'TODO Blender: replace named screws_1 … screws_16';
    fastenerBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fastenerBatch.frustumCulled = false; fastenerBatch.count = 0;
    extras.add(fastenerBatch);
  }
  const fastenerTransform = new THREE.Object3D();
  let lastExtension = NaN, lastSimple = null;
  const cables = C.spring.anchors.map(([x, y], i) => {
    const cable = createSpringCable({ lowQuality, material: materials.metal });
    cable.mesh.name = `spring_cable_${i + 1}`; cable.mesh.position.set(x - C.spring.radius, y, C.split.seamZ); extras.add(cable.mesh); return cable;
  });
  const seamPoints = [];
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; seamPoints.push(new THREE.Vector3(.316 * Math.cos(a), -.035 + .17 * Math.sin(a), C.split.seamZ)); }
  const seamMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(C.colors.seam).multiplyScalar(C.glow.seamIntensity), transparent: true, opacity: 0, depthWrite: false });
  const seam = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(seamPoints), seamMaterial); extras.add(seam);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .45), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color(C.colors.internal) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float opacity; uniform vec3 tint; void main(){float a=exp(-dot((vUv-.5)*5.,(vUv-.5)*5.));gl_FragColor=vec4(tint,a*opacity);}',
  }));
  contact.position.set(0, -.74, -.36); extras.add(contact);
  const rim = new THREE.DirectionalLight(C.colors.white, 0); rim.position.set(-2, 3, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(C.colors.internal, 0); fill.position.set(3, 1, 3); scene.add(fill);
  const target = new THREE.Vector3();
  const framingBox = new THREE.Box3(), framingPoint = new THREE.Vector3();
  const framingMatrix = new THREE.Matrix4(), framingInverse = new THREE.Matrix4();
  const framingCorners = [];
  const depth = C.framing.restDepth + C.framing.margin;
  for (const x of [-C.framing.halfWidth, C.framing.halfWidth]) for (const y of [-C.framing.halfHeight, C.framing.halfHeight]) for (const z of [-depth, depth]) framingCorners.push(new THREE.Vector3(x, y, z));
  const viewportBounds = [.04, .96, .13, .90];
  let low = lowQuality, state = explodeStateAt(0), disposed = false, wasActive = true;
  function resize() { /* Shared renderer handles viewport changes; no extra render targets. */ }
  function update(progress) {
    state = explodeStateAt(progress);
    const { local, weight, extension, separation, active } = state;
    if (!active && !wasActive) return state;
    wasActive = active;
    // Fit the current extension, not the obsolete radial-flight envelope. Reuse all eight corners.
    const currentDepth = C.framing.restDepth + separation / 2 + C.framing.margin;
    for (const corner of framingCorners) corner.z = Math.sign(corner.z) * currentDepth;
    const mobile = deviceProfile().responsive, simple = low || mobile;
    extras.visible = active;
    rim.intensity = weight * 2.8; fill.intensity = weight * 1.2;
    front.position.copy(frontRest); back.position.copy(backRest);
    front.position.z += separation / 2 * (mobile?M.explode.depthFactor:1); back.position.z -= separation / 2 * (mobile?M.explode.depthFactor:1);
    if(mobile){
      const amplitude=reducedMotion.matches?.4:1;
      front.position.y+=extension*M.explode.shellY*amplitude;back.position.y-=extension*M.explode.shellY*amplitude;
      front.position.x+=extension*M.explode.shellX*amplitude;back.position.x-=extension*M.explode.shellX*amplitude;
    }
    seamMaterial.opacity = weight * (.10 + .65 * smoothRange(0, .16, local)) * (1 - smoothRange(.2, .7, local));
    seam.position.z = separation / 2;
    contact.material.uniforms.opacity.value = weight * .085;
    for (let i = 0; i < cables.length; i++) {
      const cable = cables[i]; cable.mesh.visible = active && (!simple || i < (mobile?M.explode.cables:C.reduced.cables)) && extension > .025;
      if (cable.mesh.visible) { cable.mesh.position.z = C.split.seamZ - separation / 2 - C.spring.closedLength / 2; cable.update(C.spring.closedLength + separation); }
    }
    let mobileCount = 0;
    for (const part of parts) {
      const { spec, pivot, origin, generated } = part;
      const allowed = mobile ? M.explode.parts.includes(spec.name) : !simple || Boolean(spec.mobile && (spec.type === 'screw' ? spec.index < C.reduced.fasteners : mobileCount++ < C.reduced.maxParts));
      part.arrival = smoothRange(.5, .9, extension) * weight;
      pivot.position.copy(origin);
      if (allowed && !spec.mount) {
        const openZ = C.split.seamZ + spec.layer * C.split.distance;
        pivot.position.z = THREE.MathUtils.lerp(origin.z, openZ, extension);
        if(mobile){
          pivot.position.z=THREE.MathUtils.lerp(origin.z,openZ,extension*M.explode.depthFactor);
          pivot.position.y+=spec.layer*extension*M.explode.partY*(reducedMotion.matches?.4:1);
        }
      }
      pivot.rotation.set(0, 0, 0);
      // Existing parts remain assembled on mobile; generated internals are hidden outside the shot.
      pivot.visible = mobile ? (spec.mount || (active?allowed:!generated)) && (!generated || extension>C.internals.revealAt) : !generated || (active && allowed && extension > C.internals.revealAt);
      for (const saved of part.flightMaterial) {
        saved.material.emissive.copy(saved.emissive).lerp(glowColor, weight);
        saved.material.emissiveIntensity = THREE.MathUtils.lerp(saved.intensity, C.glow.intensity, weight);
      }
    }
    if (fastenerBatch && (extension !== lastExtension || simple !== lastSimple)) {
      let count = 0;
      for (const part of fastenerParts) {
        if (!part.pivot.visible) continue;
        fastenerTransform.position.copy(part.pivot.position); fastenerTransform.updateMatrix();
        fastenerBatch.setMatrixAt(count++, fastenerTransform.matrix);
      }
      fastenerBatch.count = count; fastenerBatch.instanceMatrix.needsUpdate = true;
      lastExtension = extension; lastSimple = simple;
    }
    return state;
  }
  const glowColor = new THREE.Color(C.colors.internal);
  function frameCameraAndProduct(visibleHeight, visibleWidth) {
    const { weight } = state;
    if (!state.active) return;
    const mobile = deviceProfile().responsive;
    root.position.lerp(target.set(mobile ? 0 : visibleWidth * C.camera.x, visibleHeight * (mobile ? M.framing.panelY : C.camera.y), C.camera.z), weight);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, mobile?M.explode.pitch:C.camera.pitch, weight);
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, mobile?M.explode.yaw:C.camera.yaw, weight);
    root.rotation.z *= 1 - weight;
    const scale = (mobile ? Math.min(visibleHeight, visibleWidth) * M.explode.scale : visibleHeight * C.camera.scale);
    root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x, scale, weight));
    camera.position.set(0, 0, 6.5); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
    if(mobile){
      const box=framingBox.makeEmpty(),point=framingPoint,matrix=framingMatrix;root.updateMatrixWorld(true);
      const inverse=framingInverse.copy(root.matrixWorld).invert();
      root.traverseVisible(object=>{
        if(!object.isMesh||object===contact||object.name==='optical_video_screen')return;
        // Geometry is static; only transforms change as the headset opens.
        if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
        const b=object.geometry.boundingBox;matrix.multiplyMatrices(inverse,object.matrixWorld);
        for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])box.expandByPoint(point.set(x,y,z).applyMatrix4(matrix));
      });
      let i=0;for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])framingCorners[i++].set(x,y,z);
    }
  }
  return {
    update, frameCameraAndProduct, resize, framingCorners,
    get viewportBounds() {
      const profile=deviceProfile(),mobile=profile.responsive;
      // Narrow the crop as the model crosses the frame, without shrinking it into an empty column.
      viewportBounds[1] = mobile ? .96 : THREE.MathUtils.lerp(.96, .595, state.weight);
      viewportBounds[2] = mobile ? profile.landscape?M.framing.landscapeTop:M.framing.top : .13;
      viewportBounds[3] = mobile ? profile.landscape?M.framing.landscapeBottom:M.framing.modelBottom : .90;
      return viewportBounds;
    },
    // A stable drawing-buffer size avoids reallocating transmission targets at scroll boundaries.
    get pixelRatioCap() { return C.render.maxPixelRatio; },
    get active() { return state.active; }, get weight() { return state.weight; },
    get state() { return { ...state, parts: parts.map(p => ({ name: p.spec.name, todo: p.generated, position: p.pivot.position.toArray(), rotation: p.pivot.rotation.toArray().slice(0, 3), visible: p.pivot.visible, arrival: p.arrival })), bloom: false, fasteners: fastenerBatch?.count || 0, fastenerDrawCalls: fastenerBatch?.count ? 1 : 0, cableCount: cables.filter(c => c.mesh.visible).length }; },
    render() { renderer.render(scene, camera); },
    reduceQuality() { low = true; },
    dispose() {
      if (disposed) return; disposed = true;
      front.position.copy(frontRest); back.position.copy(backRest);
      cables.forEach(cable => { cable.mesh.removeFromParent(); cable.dispose(); });
      extras.traverse(object => { if (object.isInstancedMesh) object.dispose(); object.geometry?.dispose(); if (object.material && !Object.values(materials).includes(object.material)) object.material.dispose(); }); extras.removeFromParent();
      // Source resources are owned by headset.dispose(); only generated resources live here.
      const geometries = new Set();
      parts.forEach(part => {
        part.pivot.position.copy(part.origin); part.pivot.rotation.set(0, 0, 0);
        if (part.generated) { part.pivot.traverse(object => { if (object.isInstancedMesh) object.dispose(); if (object.geometry) geometries.add(object.geometry); }); part.pivot.removeFromParent(); }
      });
      geometries.forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose());
      const clonedMaterials=new Set();
      for(const saved of originalObjects){
        const {object,parent,position,quaternion,scale,visible,material}=saved;
        if(object.material&&object.material!==material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>clonedMaterials.add(m));
        parent.add(object);object.position.copy(position);object.quaternion.copy(quaternion);object.scale.copy(scale);object.visible=visible;
        if(material)object.material=material;
      }
      clonedMaterials.forEach(material=>material.dispose());
      parts.forEach(part=>part.pivot.removeFromParent());
      if(!originalObjects.some(saved=>saved.object===front))front.removeFromParent();
      if(!originalObjects.some(saved=>saved.object===back))back.removeFromParent();
      rim.removeFromParent(); fill.removeFromParent();
    },
  };
}
