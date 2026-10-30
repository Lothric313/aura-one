import fs from 'node:fs';
const bytes = fs.readFileSync(process.argv[2]);
const doc = JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
const binStart = 28 + bytes.readUInt32LE(12);
const bin = bytes.subarray(binStart);
export function readAccessor(index) {
  const a=doc.accessors[index], v=doc.bufferViews[a.bufferView];
  const C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType];
  const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type], size=C.BYTES_PER_ELEMENT;
  const out=new C(a.count*n);
  for(let i=0;i<a.count;i++) for(let k=0;k<n;k++) {
    const off=(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*size)+k*size;
    out[i*n+k]=new C(bin.buffer,bin.byteOffset+off,1)[0];
  }
  return out;
}
export const parts=[];
for(const [mi,m] of doc.meshes.entries()) for(const p of m.primitives) {
  const pos=readAccessor(p.attributes.POSITION), idx=readAccessor(p.indices);
  const parent=Array.from({length:pos.length/3},(_,i)=>i), map=new Map();
  const root=i=>parent[i]===i?i:parent[i]=root(parent[i]);
  const join=(a,b)=>{parent[root(a)]=root(b);};
  for(let i=0;i<parent.length;i++) {
    const key=[0,1,2].map(k=>Math.round(pos[i*3+k]*1000)).join(',');
    if(map.has(key))join(i,map.get(key));else map.set(key,i);
  }
  for(let i=0;i<idx.length;i+=3){join(idx[i],idx[i+1]);join(idx[i],idx[i+2]);}
  const groups=new Map();
  for(let i=0;i<idx.length;i+=3){const r=root(idx[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(idx[i],idx[i+1],idx[i+2]);}
  const components=[...groups.values()].map(indices=>{
    const vertices=[...new Set(indices)], min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const i of vertices)for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i*3+k]);max[k]=Math.max(max[k],pos[i*3+k]);}
    return {mi,p,indices,vertices,min,max,center:min.map((v,k)=>(v+max[k])/2)};
  }).sort((a,b)=>b.indices.length-a.indices.length);
  parts.push(...components);
  if (!process.env.AURA_PREPARE) console.log(JSON.stringify({mesh:mi,material:p.material,components:components.map((c,i)=>({i,tri:c.indices.length/3,min:c.min.map(Math.round),max:c.max.map(Math.round),center:c.center.map(Math.round)}))}));
}
export {doc,bin,bytes};
