import { Vector3 } from 'three';

// The presentation camera stays on its forward axis. Solve its four inset
// frustum planes for scale, including the depth of the rotated headset.
export function fitObjectScale(corners, position, rotation, camera, desiredScale, padding = .035) {
  const tanY = Math.tan(camera.fov * Math.PI / 360);
  const limits = [tanY * camera.aspect * (1 - 2 * padding), tanY * (1 - 2 * padding)];
  const center = [position.x - camera.position.x, position.y - camera.position.y];
  const distance = camera.position.z - position.z;
  const offset = new Vector3();
  let scale = desiredScale;
  for (const corner of corners) {
    offset.copy(corner).applyEuler(rotation);
    for (let axis = 0; axis < 2; axis++) for (const sign of [-1, 1]) {
      const coefficient = sign * offset.getComponent(axis) + limits[axis] * offset.z;
      if (coefficient > 0) scale = Math.min(scale, (limits[axis] * distance - sign * center[axis]) / coefficient);
    }
  }
  return Math.max(0, scale);
}

// Fit a product into one editorial column, including the actual orbiting camera.
// bounds = left, right, top, bottom, expressed as fractions of the viewport.
export function fitObjectScaleInViewport(corners, position, rotation, camera, desiredScale, bounds) {
  const [left, right, top, bottom] = bounds;
  const tanY = Math.tan(camera.fov * Math.PI / 360), tanX = tanY * camera.aspect;
  const inverse = camera.quaternion.clone().invert();
  const center = position.clone().sub(camera.position).applyQuaternion(inverse);
  const offset = new Vector3();
  const planes = [[0, -1, (1 - 2 * left) * tanX], [0, 1, (2 * right - 1) * tanX], [1, 1, (1 - 2 * top) * tanY], [1, -1, (2 * bottom - 1) * tanY]];
  let scale = desiredScale;
  for (const corner of corners) {
    offset.copy(corner).applyEuler(rotation).applyQuaternion(inverse);
    for (const [axis, sign, limit] of planes) {
      const coefficient = sign * offset.getComponent(axis) + limit * offset.z;
      if (coefficient > 0) scale = Math.min(scale, (-limit * center.z - sign * center.getComponent(axis)) / coefficient);
    }
  }
  return Math.max(0, scale);
}
