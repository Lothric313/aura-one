import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Build the approved bevels and smooth normals once, rather than during scroll.
const font = new FontLoader().parse(JSON.parse(await readFile(new URL('../public/fonts/Inter-Black-title.typeface.json', import.meta.url), 'utf8')));
const source = new TextGeometry('Aura One', { font, size: 1, depth: .20, curveSegments: 12, steps: 1,
  bevelEnabled: true, bevelThickness: .065, bevelSize: .052, bevelSegments: 8 });
source.deleteAttribute('normal'); source.deleteAttribute('uv');
const geometry = mergeVertices(source, 1e-5); source.dispose(); geometry.computeVertexNormals();
geometry.rotateX(.035); geometry.rotateY(-.035); geometry.computeBoundingBox();
const size = geometry.boundingBox.getSize(new THREE.Vector3());
geometry.scale(5 / size.x, 1 / size.y, 1 / size.y); geometry.computeBoundingBox();
const bounds = geometry.boundingBox, center = bounds.getCenter(new THREE.Vector3());
geometry.translate(-center.x, -bounds.min.y, -center.z); geometry.computeBoundingBox();

const arrays = [geometry.attributes.position.array, geometry.attributes.normal.array, geometry.index.array];
const chunks = arrays.map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
let offset = 0;
const bufferViews = chunks.map((chunk, i) => {
  const view = { buffer: 0, byteOffset: offset, byteLength: chunk.length, target: i === 2 ? 34963 : 34962 };
  offset += chunk.length; return view;
});
const document = { asset: { version: '2.0', generator: 'Aura One offline glass title' }, scene: 0,
  scenes: [{ nodes: [0] }], nodes: [{ name: 'Aura One · glass text', mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
  buffers: [{ byteLength: offset }], bufferViews,
  accessors: [
    { bufferView: 0, componentType: 5126, count: geometry.attributes.position.count, type: 'VEC3',
      min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
    { bufferView: 1, componentType: 5126, count: geometry.attributes.normal.count, type: 'VEC3' },
    { bufferView: 2, componentType: geometry.index.array instanceof Uint16Array ? 5123 : 5125,
      count: geometry.index.count, type: 'SCALAR' },
  ] };
const json = Buffer.from(JSON.stringify(document)), binary = Buffer.concat(chunks);
const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const binaryChunk = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonChunk.length + binaryChunk.length, 8);
header.writeUInt32LE(jsonChunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
binaryHeader.writeUInt32LE(binaryChunk.length); binaryHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jsonChunk, binaryHeader, binaryChunk]);
await writeFile(new URL('../public/models/glass-title.glb', import.meta.url), output);
console.log(`Glass title: ${geometry.index.count / 3} triangles, ${output.length} bytes.`);
geometry.dispose();
