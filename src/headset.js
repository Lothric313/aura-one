import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CONFIG } from './config.js';
import { MOTION, easeMotion } from './motion.js';
import { MOBILE_CONFIG, deviceProfile } from './mobileConfig.js';

function weaveTextures() {
  const size = 256;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const over = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
    const warp = .5 + .5 * Math.cos((over ? x : y) * Math.PI / 4);
    const thread = .5 + .5 * Math.cos((over ? y : x) * Math.PI / 2);
    const v = 100 + warp * 75 + thread * 25;
    const i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const bump = new THREE.CanvasTexture(canvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(3.5, 3.5); bump.anisotropy = 4;
  const normalCanvas = document.createElement('canvas'); normalCanvas.width = normalCanvas.height = size;
  const nc = normalCanvas.getContext('2d'); const normalImage = nc.createImageData(size, size);
  const height = (x, y) => image.data[(((y + size) % size) * size + (x + size) % size) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const normal = new THREE.Vector3((height(x - 1, y) - height(x + 1, y)) * .8, (height(x, y - 1) - height(x, y + 1)) * .8, 1).normalize();
    const i = (y * size + x) * 4;
    normalImage.data[i] = (normal.x + 1) * 127.5; normalImage.data[i + 1] = (normal.y + 1) * 127.5; normalImage.data[i + 2] = (normal.z + 1) * 127.5; normalImage.data[i + 3] = 255;
  }
  nc.putImageData(normalImage, 0, 0);
  const normal = new THREE.CanvasTexture(normalCanvas); normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.copy(bump.repeat); normal.anisotropy = 4;
  const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = size;
  const rc = roughCanvas.getContext('2d'); const roughData = rc.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 228 + image.data[i] * .1;
    roughData.data[i] = roughData.data[i + 1] = roughData.data[i + 2] = value; roughData.data[i + 3] = 255;
  }
  rc.putImageData(roughData, 0, 0);
  const roughness = new THREE.CanvasTexture(roughCanvas); roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping; roughness.repeat.copy(bump.repeat);
  const albedo = bump.clone(); albedo.colorSpace = THREE.SRGBColorSpace;
  return { bump, normal, roughness, albedo };
}

export function normalizeModel(model) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.length() < .00001) throw new Error('Empty headset geometry');
  const normalized = new THREE.Group(); normalized.name = 'HeadsetNormalized';
  model.position.sub(center); normalized.add(model);
  normalized.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
  const wrapper = new THREE.Group(); wrapper.name = 'HeadsetScrollTransform'; wrapper.add(normalized);
  wrapper.userData.normalizedBounds = size.divideScalar(Math.max(size.x, size.y, size.z)).toArray();
  return wrapper;
}

function textileUV(geometry, density = 25) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  // Project each triangle onto its dominant plane. Physical thread spacing stays isotropic on every band.
  for (let i = 0; i < p.count; i += 3) {
    const normal = new THREE.Vector3(n.getX(i) + n.getX(i + 1) + n.getX(i + 2), n.getY(i) + n.getY(i + 1) + n.getY(i + 2), n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2));
    const axes = Math.abs(normal.x) > Math.max(Math.abs(normal.y), Math.abs(normal.z)) ? [1, 2] : Math.abs(normal.y) > Math.abs(normal.z) ? [0, 2] : [0, 1];
    for (let v = i; v < i + 3; v++) { uv[v * 2] = p.array[v * 3 + axes[0]] * density; uv[v * 2 + 1] = p.array[v * 3 + axes[1]] * density; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function cameraCover(geometry) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox, center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const radius = size.x / 2, halfStraight = size.y / 2 - radius, positions = [], indices = [];
  const columns = 28, rows = 64;
  for (let row = 0; row <= rows; row++) {
    const y = (row / rows - .5) * size.y;
    const cap = Math.max(0, Math.abs(y) - halfStraight);
    const halfWidth = Math.sqrt(Math.max(0, radius * radius - cap * cap));
    for (let col = 0; col <= columns; col++) {
      const x = col / columns * 2 - 1;
      const dome = Math.sqrt(Math.max(0, 1 - x * x)) * Math.sqrt(Math.max(0, 1 - (y / (size.y / 2)) ** 6));
      positions.push(center.x + x * halfWidth, center.y + y, bounds.max.z + .0004 + dome * .004);
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const cover = new THREE.BufferGeometry();
  cover.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  cover.setIndex(indices); cover.computeVertexNormals();
  return cover;
}

export async function createHeadset({ finish, onProgress, videoTexture = null, reducedMotion, lowQuality = false }) {
  let model, source = 'glb', materials = {}, controllerLeft, controllerRight, headsetGroup;
  const bodyMaterials = new Set(), lensMaterials = new Set();
  const sourceMaterials = new Set(), sourceTextures = new Set();
  onProgress(.12);
  try {
    const manifest = await fetch(`${import.meta.env.BASE_URL}models/manifest.json`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { available: false });
    if (!manifest.available) throw new Error('Модель шлема не найдена');
    if (manifest.available) {
      const loader = new GLTFLoader(); const draco = new DRACOLoader(); draco.setDecoderPath(CONFIG.decoderPath); loader.setDRACOLoader(draco);
      try {
        const responsive = deviceProfile().responsive;
        const progress = event => { if (event.total) onProgress(.15 + event.loaded / event.total * .65); };
        let gltf;
        try { gltf = await loader.loadAsync(responsive ? MOBILE_CONFIG.model.url : CONFIG.modelUrl, progress); source = responsive ? 'glb-mobile-draco' : 'glb'; }
        catch(error) { if (!responsive) throw error; console.warn('Mobile GLB unavailable; using the source model.', error); gltf = await loader.loadAsync(CONFIG.modelUrl, progress); source = 'glb-fallback'; }
        model = gltf.scene;
        headsetGroup = model.getObjectByName('headsetGroup');
        controllerLeft = model.getObjectByName('controller_left');
        controllerRight = model.getObjectByName('controller_right');
        if (!headsetGroup || !controllerLeft || !controllerRight) throw new Error('GLB is missing independent product groups');
        // Bake source transforms once. Every timeline then uses centered unit-space pivots.
        model.updateMatrixWorld(true);
        const originalMeshes = [];
        model.traverse(mesh => { if (mesh.isMesh) originalMeshes.push(mesh); });
        originalMeshes.forEach(mesh => (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>{
          sourceMaterials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)sourceTextures.add(value);});
        }));
        originalMeshes.forEach(mesh => { mesh.geometry.applyMatrix4(mesh.matrixWorld); mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.setScalar(1); });
        model.traverse(object => { if (!object.isMesh) { object.position.set(0, 0, 0); object.quaternion.identity(); object.scale.setScalar(1); } });
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(headsetGroup);
        const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        const unit = 1 / Math.max(size.x, size.y, size.z);
        headsetGroup.traverse(mesh => { if (mesh.isMesh) mesh.geometry.translate(-center.x, -center.y, -center.z).scale(unit, unit, unit); });
        for (const controller of [controllerLeft, controllerRight]) {
          const pivot = new THREE.Box3().setFromObject(controller).getCenter(new THREE.Vector3());
          controller.traverse(mesh => { if (mesh.isMesh) mesh.geometry.translate(-pivot.x, -pivot.y, -pivot.z).scale(unit, unit, unit); });
        }
        let textile = null;
        model.traverse(mesh => {
          if (!mesh.isMesh) return;
          if (/^sensors_(1|3|4)$/.test(mesh.name)) { const original = mesh.geometry; mesh.geometry = cameraCover(original); original.dispose(); }
          if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
          if (mesh.material.name === 'strap_mat') {
            if (!textile) {
              const weave = weaveTextures();
              Object.values(weave).forEach(texture => { texture.repeat.set(1, 1); texture.anisotropy = 8; });
              textile = new THREE.MeshPhysicalMaterial({ name: 'strap_mat', color: '#ced0d3', map: weave.albedo, normalMap: weave.normal, normalScale: new THREE.Vector2(.22, .22), roughnessMap: weave.roughness, roughness: .95, metalness: 0, sheen: .8, sheenColor: new THREE.Color('#e4e5e7'), sheenRoughness: .9, side: THREE.DoubleSide, envMapIntensity: .45 });
            }
            const oldGeometry = mesh.geometry; mesh.geometry = textileUV(oldGeometry); if (oldGeometry !== mesh.geometry) oldGeometry.dispose(); mesh.material = textile;
          }
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(material => {
            if (material.name === 'body_mat') { material.envMapIntensity = .6; material.color.set(finish.color); bodyMaterials.add(material); }
            if (material.name === 'glass_mat') {
              material.color.set('#080d14');
              material.map = material.roughnessMap = material.metalnessMap = null;
              Object.assign(material, { roughness: .065, metalness: 0, clearcoat: 1, clearcoatRoughness: .035, ior: 1.52, specularIntensity: .85, envMapIntensity: 1.0, side: THREE.FrontSide });
              material.needsUpdate = true; materials.cameras = material;
            }
            if (material.name === 'lens_mat') {
              if (!material.isMeshPhysicalMaterial) throw new Error('Optical material must be physical');
              material.map = material.emissiveMap = material.envMap = null;
              material.emissive.set(0); material.emissiveIntensity = 0;
              Object.assign(material, { transmission: .97, ior: 1.5, roughness: .03, clearcoat: 1, clearcoatRoughness: .03, thickness: .012, dispersion: .08, envMapIntensity: 1.2, side: THREE.DoubleSide });
              material.needsUpdate = true; lensMaterials.add(material);
            }
          });
          mesh.castShadow = mesh.receiveShadow = false;
        });
      } finally { draco.dispose(); }
    }
  } catch (error) { throw new Error('Не удалось загрузить GLB: ' + error.message); }
  const group = model;
  // The source glass mesh also contained four small decorative patches. They
  // are not optical lenses and must not become Fresnel discs or video screens.
  const candidates = [], eyes = new Map();
  headsetGroup.traverse(mesh => {
    if (!mesh.isMesh || !lensMaterials.has(mesh.material)) return;
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3()), area = size.x * size.y;
    candidates.push(mesh);
    if (!eyes.has(mesh.name) || area > eyes.get(mesh.name).area) eyes.set(mesh.name, { mesh, area });
  });
  candidates.forEach(mesh => { if (eyes.get(mesh.name).mesh !== mesh) { mesh.removeFromParent(); mesh.geometry.dispose(); } });
  let videoMaterial = null;
  if (videoTexture) {
    videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, color: '#ffffff', toneMapped: false });
    const opticalMeshes = [];
    headsetGroup.traverse(mesh => { if (mesh.isMesh && lensMaterials.has(mesh.material) && /^lens_(left|right)$/.test(mesh.name)) opticalMeshes.push(mesh); });
    opticalMeshes.forEach(lensMesh => {
      lensMesh.geometry.computeBoundingBox();
      const bounds = lensMesh.geometry.boundingBox, center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      const screen = new THREE.Mesh(new THREE.CircleGeometry(1, 64), videoMaterial);
      screen.name = 'optical_video_screen'; screen.rotation.y = Math.PI;
      screen.position.set(center.x, center.y, bounds.max.z + .003);
      screen.scale.set(size.x * .485, size.y * .485, 1); headsetGroup.add(screen);
    });
  }
  const expectedObjects = ['body', 'lens', 'cushion', 'strap', 'sensors', 'controller_left', 'controller_right'];
  const objectNames = [], materialNames = new Set();
  group.traverse(object => { objectNames.push(object.name); if (object.isMesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materialNames.add(m.name)); });
  const report = {
    objects: expectedObjects.map(name => ({ name, found: objectNames.some(value => value === name || value.startsWith(name + '_')) })),
    materials: ['body_mat', 'lens_mat', 'cushion_mat', 'strap_mat', 'glass_mat'].map(name => ({ name, found: materialNames.has(name) })),
  };
  console.info('Aura object bindings'); console.table(report.objects);
  console.info('Aura material bindings'); console.table(report.materials);
  onProgress(.88);
  const body = [...bodyMaterials][0], lens = [...lensMaterials][0];
  materials = { ...materials, body, lens };
  const fromColor = body.color.clone(), toColor = body.color.clone();
  // Controllers fade independently of the shell, even when the GLB shares materials.
  const controllerMaterials = new Map();
  for (const controller of [controllerLeft, controllerRight]) controller.traverse(mesh => {
    if (!mesh.isMesh) return;
    const clone = original => {
      if (!controllerMaterials.has(original)) {
        const material = original.clone();
        controllerMaterials.set(original, { material, opacity: original.opacity, transparent: original.transparent, depthWrite: original.depthWrite });
        if (bodyMaterials.has(original)) bodyMaterials.add(material);
      }
      return controllerMaterials.get(original).material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  let colorTime = MOTION.duration;
  function simplifyMaterials() {
    if (!deviceProfile().responsive) return;
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material.isMeshPhysicalMaterial) {
          material.transmission = 0; material.dispersion = 0; material.clearcoat = 0; material.sheen = 0; material.iridescence = 0;
          material.needsUpdate = true;
        }
        for (const value of Object.values(material)) if (value?.isTexture) value.anisotropy = 1;
      }
    });
  }
  // Mobile optical glass avoids the transmission render pass on all responsive devices.
  if (deviceProfile().responsive) { lensMaterials.forEach(m => { m.transmission=0; m.dispersion=0; m.needsUpdate=true; }); }
  if (lowQuality) simplifyMaterials();
  return {
    group, headsetGroup, controllerLeft, controllerRight, materials, source, report,
    setInteriorOpacity(value) { if (videoMaterial) videoMaterial.color.setScalar(value); },
    setControllerOpacity(value) {
      controllerLeft.visible = controllerRight.visible = value > .001;
      for (const saved of controllerMaterials.values()) {
        const { material } = saved, transparent = saved.transparent || value < 1;
        material.opacity = saved.opacity * value;
        material.depthWrite = saved.depthWrite && value >= 1;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      }
    },
    setFinish(next) { fromColor.copy(body.color); toColor.set(next.color); colorTime = 0; },
    update(dt) {
      if (colorTime >= MOTION.duration) return;
      colorTime = reducedMotion?.matches ? MOTION.duration : Math.min(MOTION.duration, colorTime + dt);
      const eased = easeMotion(colorTime / MOTION.duration);
      bodyMaterials.forEach(material => material.color.lerpColors(fromColor, toColor, eased));
    },
    reduceQuality: simplifyMaterials,
    dispose() {
      const geometries = new Set(), mats = new Set(sourceMaterials), textures = new Set(sourceTextures);
      group.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => mats.add(material));
      });
      // Include source materials replaced by exploded-view clones.
      [...bodyMaterials, ...lensMaterials, ...Object.values(materials)].forEach(material => mats.add(material));
      mats.forEach(material => Object.values(material).forEach(value => { if (value?.isTexture && value !== videoTexture) textures.add(value); }));
      textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose()); mats.forEach(material => material.dispose());
      group.removeFromParent();
    },
  };
}
