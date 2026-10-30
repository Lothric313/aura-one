import fs from 'node:fs';
process.env.AURA_PREPARE='1';
const {doc,bin,parts,readAccessor}=await import('./inspect-model.mjs');
const segments=[], views=[], accessors=[], meshes=[], nodes=[];
let offset=0;
function view(data,target) {
  const b=Buffer.from(data.buffer??data,data.byteOffset??0,data.byteLength??data.length);
  const pad=(4-offset%4)%4;if(pad){segments.push(Buffer.alloc(pad));offset+=pad;}
  const index=views.length;views.push({buffer:0,byteOffset:offset,byteLength:b.length,...(target?{target}:{})});segments.push(b);offset+=b.length;return index;
}
function accessor(data,type) {
  const n={SCALAR:1,VEC2:2,VEC3:3}[type], a={bufferView:view(data,type==='SCALAR'?34963:34962),componentType:data instanceof Float32Array?5126:5125,count:data.length/n,type};
  if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++) {const k=i%3;a.min[k]=Math.min(a.min[k],data[i]);a.max[k]=Math.max(a.max[k],data[i]);}}
  return accessors.push(a)-1;
}
const images=doc.images.map(im=>{const v=doc.bufferViews[im.bufferView];return{mimeType:im.mimeType,bufferView:view(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))};});
const materials=structuredClone(doc.materials);
materials[0].name='body_mat';materials[2].name='body_mat';
materials[1]={name:'lens_backing_mat',pbrMetallicRoughness:{baseColorFactor:[.006,.009,.016,1],roughnessFactor:.55,metallicFactor:0}};
materials[3].name='glass_mat';materials[3].alphaMode='OPAQUE';materials[3].pbrMetallicRoughness.baseColorFactor=[.012,.014,.02,1];
materials[4].name='strap_mat';materials[5].name='cushion_mat';
materials.push({name:'lens_mat',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.03},extensions:{KHR_materials_transmission:{transmissionFactor:.97},KHR_materials_ior:{ior:1.5},KHR_materials_volume:{thicknessFactor:.012},KHR_materials_clearcoat:{clearcoatFactor:1,clearcoatRoughnessFactor:.03}}});
materials.push({...structuredClone(materials[4]),name:'sensors_mat'});
const headsetParts=parts.filter(c=>c.mi!==2);
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
headsetParts.forEach(c=>c.min.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],c.max[k]);}));
const center=min.map((v,k)=>(v+max[k])/2),unit=1/Math.max(...min.map((v,k)=>max[k]-v));
function root(name){nodes.push({name,children:[]});return nodes.length-1;}
const roots={headset:root('headsetGroup'),left:root('controller_left'),right:root('controller_right')};
const pivots={headset:center};
for(const side of ['left','right']){const cp=parts.filter(c=>c.mi===2&&(side==='left'?c.center[0]<0:c.center[0]>0));pivots[side]=[0,1,2].map(k=>(Math.min(...cp.map(c=>c.min[k]))+Math.max(...cp.map(c=>c.max[k])))/2);}
function transformed(x,y,z,pivot){return[(x-pivot[0])*unit,(z-pivot[2])*unit,-(y-pivot[1])*unit];}
function mesh(name,attributes,indices,material,parent){const m=meshes.push({name,primitives:[{attributes,indices,material}]})-1;const n=nodes.push({name,mesh:m})-1;nodes[parent].children.push(n);}
const counts={};
for(const c of parts){
  // Remove both the baked lens discs and their old glass surface. Keep the original housings.
  if(c.mi===0||(c.mi===3&&c.center[1]>-90))continue;
  const side=c.mi===2?(c.center[0]<0?'left':'right'):'headset',pivot=pivots[side];
  let role=c.mi===2?'body':c.mi===1?'body':c.mi===6?'strap':c.mi===4||c.mi===5?'cushion':'sensors';
  const material=c.mi===7?7:c.p.material;
  const sourcePos=readAccessor(c.p.attributes.POSITION),sourceNormal=readAccessor(c.p.attributes.NORMAL),sourceUV=readAccessor(c.p.attributes.TEXCOORD_0);
  const remap=new Map(c.vertices.map((v,i)=>[v,i])),pos=[],normal=[],uv=[];
  for(const v of c.vertices){pos.push(...transformed(...sourcePos.subarray(v*3,v*3+3),pivot));normal.push(sourceNormal[v*3],sourceNormal[v*3+2],-sourceNormal[v*3+1]);uv.push(...sourceUV.subarray(v*2,v*2+2));}
  const attrs={POSITION:accessor(new Float32Array(pos),'VEC3'),NORMAL:accessor(new Float32Array(normal),'VEC3'),TEXCOORD_0:accessor(new Float32Array(uv),'VEC2')};
  const prefix=side==='headset'?role:`controller_${side}_${role}`;counts[prefix]=(counts[prefix]||0)+1;
  mesh(`${prefix}_${counts[prefix]}`,attrs,accessor(new Uint32Array(c.indices.map(v=>remap.get(v))),'SCALAR'),material,roots[side]);
}
// A physical Fresnel surface: each annulus has its own bevel normal. Reflections come from the environment.
for(const c of parts.filter(c=>c.mi===3&&c.center[1]>-90)){
  const rings=48,steps=96,pos=[],normal=[],uv=[],indices=[];
  const cx=c.center[0],cy=c.center[2],rx=(c.max[0]-c.min[0])*.493,ry=(c.max[2]-c.min[2])*.493;
  for(let ring=0;ring<rings;ring++)for(let edge=0;edge<2;edge++)for(let s=0;s<=steps;s++){
    const r=Math.max(.0001,(ring+edge)/rings),a=s/steps*Math.PI*2;
    const depth=-61.0-2.8*(1-r*r)+(edge?.10:0);
    pos.push(...transformed(cx+Math.cos(a)*rx*r,depth,cy+Math.sin(a)*ry*r,center));
    const slope=.10*r+(edge?.34:-.08),nx=Math.cos(a)*slope,ny=Math.sin(a)*slope,nz=-1,l=Math.hypot(nx,ny,nz);normal.push(nx/l,ny/l,nz/l);uv.push(.5+.5*r*Math.cos(a),.5+.5*r*Math.sin(a));
  }
  for(let ring=0;ring<rings;ring++)for(let s=0;s<steps;s++){const a=ring*2*(steps+1)+s,b=a+steps+1;indices.push(a,a+1,b,b,a+1,b+1);}
  mesh(`lens_${cx<center[0]?'left':'right'}`,{POSITION:accessor(new Float32Array(pos),'VEC3'),NORMAL:accessor(new Float32Array(normal),'VEC3'),TEXCOORD_0:accessor(new Float32Array(uv),'VEC2')},accessor(new Uint32Array(indices),'SCALAR'),6,roots.headset);
}
const gltf={asset:{...doc.asset,generator:'Aura One geometry preparation (Node.js; no Blender)'},scene:0,scenes:[{name:'AuraOne',nodes:Object.values(roots)}],nodes,meshes,materials,images,textures:doc.textures,samplers:doc.samplers,accessors,bufferViews:views,buffers:[{byteLength:offset}],extensionsUsed:[...new Set([...doc.extensionsUsed,'KHR_materials_transmission','KHR_materials_ior','KHR_materials_volume'])]};
function write(path,document,data){let j=Buffer.from(JSON.stringify(document));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);let b=data;b=Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+b.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(path,Buffer.concat([h,j,bh,b]));}
// Compact each deliverable: no hidden controllers in the headset file and no unused baked lens image.
function subset(rootIndices){
  const source=Buffer.concat(segments),out={asset:gltf.asset,scene:0,scenes:[{name:'AuraOne',nodes:[]}],nodes:[],meshes:[],materials:[],textures:[],images:[],samplers:gltf.samplers,accessors:[],bufferViews:[],buffers:[{byteLength:0}],extensionsUsed:gltf.extensionsUsed};
  const chunks=[],cache={view:new Map(),accessor:new Map(),material:new Map(),texture:new Map(),image:new Map()};let cursor=0;
  function useView(index){if(cache.view.has(index))return cache.view.get(index);const v=gltf.bufferViews[index],pad=(4-cursor%4)%4;if(pad){chunks.push(Buffer.alloc(pad));cursor+=pad;}const result=out.bufferViews.push({...v,byteOffset:cursor})-1;chunks.push(source.subarray(v.byteOffset,v.byteOffset+v.byteLength));cursor+=v.byteLength;cache.view.set(index,result);return result;}
  function useAccessor(index){if(cache.accessor.has(index))return cache.accessor.get(index);const a=gltf.accessors[index],result=out.accessors.push({...a,bufferView:useView(a.bufferView)})-1;cache.accessor.set(index,result);return result;}
  function useTexture(index){if(cache.texture.has(index))return cache.texture.get(index);const t={...gltf.textures[index]},im=gltf.images[t.source];if(!cache.image.has(t.source)){cache.image.set(t.source,out.images.push({...im,bufferView:useView(im.bufferView)})-1);}t.source=cache.image.get(t.source);const result=out.textures.push(t)-1;cache.texture.set(index,result);return result;}
  function useMaterial(index){if(cache.material.has(index))return cache.material.get(index);const m=structuredClone(gltf.materials[index]);function visit(o){for(const[k,v]of Object.entries(o)){if(k.endsWith('Texture')&&v?.index!==undefined)v.index=useTexture(v.index);else if(v&&typeof v==='object')visit(v);}}visit(m);const result=out.materials.push(m)-1;cache.material.set(index,result);return result;}
  function useNode(index){const n={...gltf.nodes[index]},result=out.nodes.push(n)-1;if(n.children)n.children=n.children.map(useNode);if(n.mesh!==undefined){const m=gltf.meshes[n.mesh];n.mesh=out.meshes.push({...m,primitives:m.primitives.map(p=>({...p,material:useMaterial(p.material),indices:useAccessor(p.indices),attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,useAccessor(v)]))}))})-1;}return result;}
  out.scenes[0].nodes=rootIndices.map(useNode);out.buffers[0].byteLength=cursor;return{document:out,data:Buffer.concat(chunks)};
}
fs.mkdirSync('public/models',{recursive:true});const complete=subset(Object.values(roots));write('public/models/aura-one.glb',complete.document,complete.data);
for(const [key,index]of Object.entries(roots)){const one=subset([index]);write(`artifacts/${key==='headset'?'headset':`controller-${key}`}.glb`,one.document,one.data);}
fs.writeFileSync('artifacts/model-preparation.json',JSON.stringify({source:process.argv[2],unit,center,pivots,roots,meshes:meshes.length,originalTriangles:parts.reduce((n,c)=>n+c.indices.length/3,0),removed:['lens baked base-color texture wire_085028177','original transparent glass optical surfaces'],attribution:doc.asset.extras},null,2));
console.log(`Prepared ${meshes.length} meshes; headset and two controller pivots. Output: public/models/aura-one.glb`);
