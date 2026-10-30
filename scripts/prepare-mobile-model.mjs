import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { MOBILE_CONFIG as M } from '../src/mobileConfig.js';

// No external upload: compress the supplied GLB locally, preserving node/material names.
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require(process.env.AURA_SHARP_PATH||'sharp'); } catch {
  throw new Error('Install sharp locally or set AURA_SHARP_PATH before rebuilding the mobile model.');
}
const input = await fs.readFile(new URL('../public/models/aura-one.glb', import.meta.url));
const doc = JSON.parse(input.toString('utf8',20,20+input.readUInt32LE(12)));
const bin = input.subarray(28+input.readUInt32LE(12));
const encoderSource = await fs.readFile(new URL('../public/draco/draco_encoder.js',import.meta.url),'utf8');
const context = { module: { exports: {} }, exports: {}, console, process, require, Buffer, setTimeout, clearTimeout,
  __dirname: new URL('../public/draco/',import.meta.url).pathname };
vm.createContext(context); vm.runInContext(encoderSource,context);
const { draco } = await new Promise(resolve=>context.module.exports({onModuleLoaded:module=>resolve({draco:module})}));
const segments=[], views=[]; let offset=0;
function view(data) {
  const buffer=Buffer.from(data.buffer??data,data.byteOffset??0,data.byteLength??data.length);
  const pad=(4-offset%4)%4; if(pad){segments.push(Buffer.alloc(pad));offset+=pad;}
  const i=views.length; views.push({buffer:0,byteOffset:offset,byteLength:buffer.length});segments.push(buffer);offset+=buffer.length;return i;
}
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array};
function read(index) {
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],T=types[a.componentType],n=components[a.type],array=new T(a.count*n);
  for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){
    const pos=(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*T.BYTES_PER_ELEMENT)+k*T.BYTES_PER_ELEMENT;
    array[i*n+k]=new T(bin.buffer,bin.byteOffset+pos,1)[0];
  }
  return array;
}
for(const mesh of doc.meshes)for(const p of mesh.primitives){
  const builder=new draco.MeshBuilder(),m=new draco.Mesh(),encoder=new draco.Encoder(),out=new draco.DracoInt8Array();
  const indices=new Uint32Array(read(p.indices)); builder.AddFacesToMesh(m,indices.length/3,indices);
  const attributes={};
  for(const [name,index] of Object.entries(p.attributes)){
    const a=doc.accessors[index],array=new Float32Array(read(index));
    const semantic={POSITION:draco.POSITION,NORMAL:draco.NORMAL,TEXCOORD_0:draco.TEX_COORD,COLOR_0:draco.COLOR}[name]??draco.GENERIC;
    attributes[name]=builder.AddFloatAttributeToMesh(m,semantic,a.count,components[a.type],array);
  }
  encoder.SetSpeedOptions(5,5); encoder.SetAttributeQuantization(draco.POSITION,M.model.quantization.position);
  encoder.SetAttributeQuantization(draco.NORMAL,M.model.quantization.normal); encoder.SetAttributeQuantization(draco.TEX_COORD,M.model.quantization.uv);
  encoder.SetEncodingMethod(draco.MESH_SEQUENTIAL_ENCODING);
  const length=encoder.EncodeMeshToDracoBuffer(m,out); if(length<=0)throw new Error('Draco encoding failed');
  const bytes=new Uint8Array(length);for(let i=0;i<length;i++)bytes[i]=out.GetValue(i);
  p.extensions={...p.extensions,KHR_draco_mesh_compression:{bufferView:view(bytes),attributes}};
  for(const index of [p.indices,...Object.values(p.attributes)]){delete doc.accessors[index].bufferView;delete doc.accessors[index].byteOffset;}
  [builder,m,encoder,out].forEach(x=>draco.destroy(x));
}
for(const image of doc.images??[]){
  const v=doc.bufferViews[image.bufferView];
  const webp=await sharp(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)).resize({width:M.performance.textureSize,height:M.performance.textureSize,fit:'inside',withoutEnlargement:true}).webp({quality:M.model.textureQuality}).toBuffer();
  image.bufferView=view(webp);image.mimeType='image/webp';
}
for(const texture of doc.textures??[]){
  if(texture.source!=null){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
}
doc.extensionsUsed=[...new Set([...(doc.extensionsUsed??[]),'KHR_draco_mesh_compression','EXT_texture_webp'])];
doc.extensionsRequired=[...new Set([...(doc.extensionsRequired??[]),'KHR_draco_mesh_compression','EXT_texture_webp'])];
doc.bufferViews=views; doc.buffers=[{byteLength:offset}];
doc.asset.extras={...doc.asset.extras,mobileOptimized:true,compression:'Draco 14/10/12 + WebP <=1024'};
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let binary=Buffer.concat(segments);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const chunk=Buffer.alloc(8);chunk.writeUInt32LE(binary.length,0);chunk.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,json,chunk,binary]);
await fs.writeFile(new URL('../public/models/aura-one-mobile.glb',import.meta.url),output);
console.log(JSON.stringify({sourceBytes:input.length,mobileBytes:output.length,reduction:1-output.length/input.length,meshes:doc.meshes.length,images:doc.images.length},null,2));
