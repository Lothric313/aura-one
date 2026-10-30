import fs from 'node:fs';

// Change only the generated GLB's shell material; preserve geometry and source images.
const path = new URL('../public/models/aura-one.glb', import.meta.url);
const bytes = fs.readFileSync(path), jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const shellMaterials = new Set();
function visit(index) {
  const node = doc.nodes[index];
  if (node.mesh !== undefined) for (const primitive of doc.meshes[node.mesh].primitives) {
    if (doc.materials[primitive.material].name === 'body_mat') shellMaterials.add(primitive.material);
  }
  node.children?.forEach(visit);
}
visit(doc.nodes.findIndex(node => node.name === 'headsetGroup'));
for (const index of shellMaterials) {
  const material = doc.materials[index];
  delete material.pbrMetallicRoughness.baseColorTexture;
  material.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
  material.pbrMetallicRoughness.roughnessFactor = .3;
}
doc.asset.extras = { ...doc.asset.extras, auraShellCleaned: true };
let json = Buffer.from(JSON.stringify(doc));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const chunks = bytes.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + json.length + chunks.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
fs.writeFileSync(path, Buffer.concat([header, json, chunks]));
console.log('Generated headset shell is unbranded; controller textures and geometry preserved.');
