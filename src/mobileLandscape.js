import * as THREE from 'three';
import { MOBILE_CONFIG as M } from './mobileConfig.js';

/** Lazy mobile world. Basic materials and one tiny sky shader; no postprocessing. */
export function createMobileLandscape({ reducedMotion, lowQuality }) {
  const canvas=document.createElement('canvas');canvas.className='inside-video mobile-landscape';canvas.ariaHidden='true';
  document.querySelector('.stage').appendChild(canvas);
  let low=lowQuality;
  const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=false;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(M.world.fov,1,.1,90);
  scene.fog=new THREE.Fog('#c1d9cd',9,38);
  camera.position.set(0,1.3,6);camera.lookAt(0,1,-10);
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 v;void main(){float h=clamp(normalize(v).y*.9+.15,0.,1.);gl_FragColor=vec4(mix(vec3(.79,.91,.98),vec3(.20,.57,.91),h),1.);}' });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(70,16,10),skyMaterial);scene.add(sky);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshBasicMaterial({color:'#668541'}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  const count=low?M.performance.lowGrass:M.performance.grass;
  const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.022,0,0,.022,0,0,.014,.34,0,-.022,0,0,.014,.34,0,.052,.64,0],3));
  const wind={value:0},grassMaterial=new THREE.MeshBasicMaterial({color:'#a5b865',side:THREE.DoubleSide});
  grassMaterial.onBeforeCompile=shader=>{shader.uniforms.uWind=wind;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uWind + instanceMatrix[3].x*.6 + instanceMatrix[3].z*.3)*position.y*position.y*.18;');};
  const grass=new THREE.InstancedMesh(bladeGeometry,grassMaterial,count);
  const dummy=new THREE.Object3D();let seed=73;const random=()=>((seed=seed*16807%2147483647)/2147483647);
  for(let i=0;i<count;i++){
    dummy.position.set((random()-.5)*26,0,-random()*42+4);dummy.rotation.set(.06,random()*Math.PI,(random()-.5)*.24);dummy.scale.setScalar(.55+random());dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
    grass.setColorAt(i,new THREE.Color().setHSL(.20+random()*.03,.30,.42+random()*.22));
  }
  scene.add(grass);
  const flowers=new THREE.InstancedMesh(new THREE.CircleGeometry(.075,5),new THREE.MeshBasicMaterial({color:'#e84c3e',side:THREE.DoubleSide}),M.performance.flowers);
  for(let i=0;i<M.performance.flowers;i++){dummy.position.set((random()-.5)*18,.35+random()*.2,-random()*26+2);dummy.rotation.set(-.7,random(),random()*3);dummy.scale.setScalar(.5+random());dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);}scene.add(flowers);
  const butterflies=[];
  for(let i=0;i<(low?M.performance.lowButterflies:M.performance.butterflies);i++){
    const butterfly=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:['#fbde8d','#f3ece2','#d9b2dd'][i%3],side:THREE.DoubleSide});
    const geometry=new THREE.CircleGeometry(.10,5),wings=[];
    for(const sign of[-1,1]){const wing=new THREE.Mesh(geometry,material);wing.position.x=sign*.075;butterfly.add(wing);wings.push(wing);}
    butterfly.position.set((random()-.5)*9,1+random()*2,-random()*8);scene.add(butterfly);
    butterflies.push({object:butterfly,wings,origin:butterfly.position.clone(),phase:random()*Math.PI*2});
  }
  function resize(){const height=canvas.parentElement.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,low?M.performance.lowPixelRatio:M.performance.maxPixelRatio));renderer.setSize(innerWidth,height,false);camera.aspect=innerWidth/height;camera.updateProjectionMatrix();}
  resize();
  let dirty=true,lastProgress=NaN;
  return {
    update(progress,time){
      if(reducedMotion.matches&&!dirty&&Math.abs(progress-lastProgress)<.0001)return;
      dirty=false;lastProgress=progress;
      const t=reducedMotion.matches?0:time*M.world.timeScale;
      wind.value=t;
      butterflies.forEach(({object,wings,origin,phase})=>{object.position.copy(origin);object.position.x+=Math.sin(t+phase)*.7;object.position.y+=Math.sin(t*1.7+phase)*.17;wings.forEach((wing,i)=>{wing.rotation.y=(i?1:-1)*Math.sin(t*16+phase)*.9;});});
      camera.position.x=reducedMotion.matches?0:Math.sin(t*.12)*.12;
      renderer.render(scene,camera);
    },
    setOpacity(value){canvas.style.opacity=String(value);},resize(){resize();dirty=true;},
    reduceQuality(){low=true;grass.count=Math.min(grass.count,M.performance.lowGrass);butterflies.forEach((b,i)=>{b.object.visible=i<M.performance.lowButterflies;});resize();},
    get state(){return{grass:grass.count,butterflies:butterflies.filter(b=>b.object.visible).length,shader:'basic-sky',drawCalls:renderer.info.render.calls};},
    dispose(){const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();},
  };
}
