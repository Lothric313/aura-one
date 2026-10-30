import * as THREE from 'three';
import { EXPLODE_CONFIG } from './partsConfig.js';

class HelixCurve extends THREE.Curve {
  constructor(config) { super(); this.config = config; }
  getPoint(t, target = new THREE.Vector3()) {
    const { radius, turns, closedLength } = this.config, angle = t * turns * Math.PI * 2;
    return target.set(radius * Math.cos(angle), radius * Math.sin(angle), t * closedLength);
  }
}

// One TubeGeometry allocation. Stretching changes pitch and keeps the wire's circular section.
export function createSpringCable({ lowQuality = false, material, ...overrides } = {}) {
  const config = { ...EXPLODE_CONFIG.spring, ...overrides };
  const segments = lowQuality ? EXPLODE_CONFIG.reduced.segments : config.segments;
  const geometry = new THREE.TubeGeometry(new HelixCurve(config), segments, config.tubeRadius, config.radialSegments, false);
  const ownMaterial = !material;
  material ||= new THREE.MeshStandardMaterial({ color: EXPLODE_CONFIG.colors.metal, metalness: .7, roughness: .32, emissive: EXPLODE_CONFIG.colors.internal, emissiveIntensity: .12 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'spring_cable'; mesh.frustumCulled = false;
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  positions.setUsage(THREE.DynamicDrawUsage); normals.setUsage(THREE.DynamicDrawUsage);
  const tau = config.turns * Math.PI * 2;
  const radialCos = [], radialSin = [], coilCos = [], coilSin = [];
  for (let j = 0; j <= config.radialSegments; j++) { const a = j / config.radialSegments * Math.PI * 2; radialCos.push(Math.cos(a)); radialSin.push(Math.sin(a)); }
  for (let i = 0; i <= segments; i++) { coilCos.push(Math.cos(i / segments * tau)); coilSin.push(Math.sin(i / segments * tau)); }
  let lastLength = NaN;
  function update(length) {
    length = Math.max(.004, length);
    if (Math.abs(length - lastLength) < 1e-7) return;
    lastLength = length;
    const tangentLength = Math.hypot(config.radius * tau, length);
    const axial = length / tangentLength, radial = config.radius * tau / tangentLength;
    for (let i = 0; i <= segments; i++) {
      const c = coilCos[i], s = coilSin[i], z = i / segments * length;
      for (let j = 0; j <= config.radialSegments; j++) {
        const k = i * (config.radialSegments + 1) + j;
        const nx = c * radialCos[j] - axial * s * radialSin[j];
        const ny = s * radialCos[j] + axial * c * radialSin[j];
        const nz = -radial * radialSin[j];
        positions.setXYZ(k, config.radius * c + config.tubeRadius * nx, config.radius * s + config.tubeRadius * ny, z + config.tubeRadius * nz);
        normals.setXYZ(k, nx, ny, nz);
      }
    }
    positions.needsUpdate = normals.needsUpdate = true;
  }
  update(config.closedLength);
  return { mesh, update, dispose() { geometry.dispose(); if (ownMaterial) material.dispose(); } };
}
