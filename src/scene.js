import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createHeadset } from './headset.js';
import { fitObjectScale, fitObjectScaleInViewport } from './framing.js';
import { samplePose, sampleKeyframes, smooth, sequenceState } from './timeline.js';
import { followMotion } from './motion.js';
import { MOBILE_CONFIG as M, MOBILE_CONTROLLER_LEFT, MOBILE_CONTROLLER_RIGHT, deviceProfile } from './mobileConfig.js';

function studioEnvironment(renderer, glassOnly = false) {
  const studio = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20,14,20), new THREE.MeshBasicMaterial({ color:new THREE.Color(.065,.065,.07), side:THREE.BackSide }));
  studio.add(room);
  function softbox(position,size,intensity) {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({ color:new THREE.Color().setScalar(intensity),side:THREE.DoubleSide }));
    box.position.set(...position); box.lookAt(0,0,0); studio.add(box);
  }
  if (glassOnly) {
    softbox([-2,3,5],[.10,2.8],4);
    softbox([3,-1,4],[.06,2.0],2.5);
  } else {
    softbox([-3,4,5],[3.5,4.5],3.5);
    softbox([3.5,-2.5,5],[3,4],1.8);
    softbox([0,4,-4],[4,.65],3.5);
  }
  const pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromScene(studio,.025,.1,50);
  pmrem.dispose();
  studio.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
  return target;
}

export async function createScene(canvas,{pointer,reducedMotion,lowQuality,finish,immersive,onProgress}) {
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:deviceProfile().responsive?M.performance.antialias:true,powerPreference:'high-performance'});
  renderer.shadowMap.enabled=false;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.setClearColor(CONFIG.colors.background,0);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.015,150);
  camera.position.z=6.5;
  const environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=1;
  let low=lowQuality,tiltX=0,tiltY=0,currentProgress=0,explode;
  const pose={},cameraPose={},leftPose={},rightPose={},bridge=new THREE.Vector3(),anchor=new THREE.Vector3();
  function resize(){
    const responsive=deviceProfile().responsive, height=responsive?canvas.parentElement.clientHeight:innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio,responsive?(low?M.performance.lowPixelRatio:M.performance.maxPixelRatio):(low?1:CONFIG.performance.desktopPixelRatio),explode?.pixelRatioCap??Infinity));
    renderer.setSize(innerWidth,height,false);camera.aspect=innerWidth/height;camera.updateProjectionMatrix();
    explode?.resize();
  }
  resize();
  const headset=await createHeadset({finish,onProgress,videoTexture:immersive?.texture,reducedMotion,lowQuality});
  const glassEnvironment=studioEnvironment(renderer,true);
  headset.materials.cameras.envMap=glassEnvironment.texture;
  headset.materials.cameras.needsUpdate=true;
  scene.add(headset.group);
  const localBounds=new THREE.Box3().setFromObject(headset.headsetGroup);
  const productWidth=localBounds.getSize(new THREE.Vector3()).x;
  const framingCorners=[];
  for(const x of[localBounds.min.x,localBounds.max.x])for(const y of[localBounds.min.y,localBounds.max.y])for(const z of[localBounds.min.z,localBounds.max.z])framingCorners.push(new THREE.Vector3(x,y,z));
  const opticalEyes = new Map();
  headset.headsetGroup.traverse(mesh=>{
    if(mesh.isMesh&&/^lens_(left|right)$/.test(mesh.name)){
      mesh.geometry.computeBoundingBox();
      const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3()), area=size.x*size.y;
      if(!opticalEyes.has(mesh.name)||area>opticalEyes.get(mesh.name).area) opticalEyes.set(mesh.name,{area,mesh});
    }
  });
  opticalEyes.forEach(({mesh})=>bridge.add(mesh.geometry.boundingBox.getCenter(new THREE.Vector3())));
  if(opticalEyes.size)bridge.divideScalar(opticalEyes.size);
  let explodeModule, loadingExplode=false, disposed=false;
  async function ensureExplode() {
    if (explode || loadingExplode || disposed) return;
    loadingExplode=true;
    try {
      explodeModule ||= await import('./explodeScene.js');
      if (!disposed) explode=explodeModule.createExplodeScene({headset,scene,camera,renderer,reducedMotion,lowQuality:low});
    } catch(error) { console.error('Exploded scene loading:',error); }
    finally { loadingExplode=false; }
  }
  // Retain the small internal assembly so reverse scroll never rebuilds it.
  await ensureExplode();
  resize();
  const controllerCorners = new Map();
  for (const group of [headset.controllerLeft,headset.controllerRight]) {
    const box=new THREE.Box3().setFromObject(group), corners=[];
    for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z));
    controllerCorners.set(group,corners);
  }
  const responsiveBounds=[M.framing.margin,1-M.framing.margin,M.framing.top,1-M.framing.margin];
  function boundsForProgress(progress) {
    const info=progress>.22&&progress<.72, landscape=deviceProfile().landscape;
    const header=document.querySelector('.header');
    responsiveBounds[2]=Math.max(M.framing.top,(header?.offsetHeight??64)/canvas.parentElement.clientHeight+.02);
    responsiveBounds[3]=info?(landscape?M.framing.landscapeBottom:M.framing.modelBottom):1-M.framing.margin;
    return responsiveBounds;
  }
  function update(dt,time,progress){
    const profile=deviceProfile(), mobile=profile.responsive;
    currentProgress=progress;headset.update(dt);explode?.update(progress);
    headset.setInteriorOpacity(immersive?.ready?smooth(.76,.805,progress):0);
    const sequence=sequenceState(progress);
    samplePose(progress,mobile,pose);
    sampleKeyframes(CONFIG.motion.camera,progress,cameraPose);
    sampleKeyframes(mobile?MOBILE_CONTROLLER_LEFT:CONFIG.motion.controllerLeft,progress,leftPose);
    sampleKeyframes(mobile?MOBILE_CONTROLLER_RIGHT:CONFIG.motion.controllerRight,progress,rightPose);
    if (mobile && reducedMotion.matches) {
      pose.rotation[0]=pose.rotation[2]=0;
      pose.rotation[1]=progress>.80&&progress<.97?Math.PI:0;
      if(progress>.80&&progress<.97) {pose.position[2]=0;pose.position[0]=0;pose.position[1]=.08;pose.scale=M.framing.initialScale;}
    }
    camera.position.set(...cameraPose.position);
    camera.quaternion.identity();camera.updateMatrixWorld();
    const visibleHeight=2*6.5*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),visibleWidth=visibleHeight*camera.aspect;
    const unitScale=(mobile?Math.min(visibleHeight,visibleWidth*M.framing.widthFactor):visibleHeight)/productWidth;
    const breathing=!reducedMotion.matches&&progress<.08?1+Math.sin(time*.75)*.0025:1;
    const pointerWeight=smooth(.08,.14,progress)*(1-smooth(.735,.805,progress));
    const pointerAllowed=pointer.active&&!reducedMotion.matches;
    tiltX=followMotion(tiltX,pointerAllowed?pointer.ny*.015*pointerWeight:0,dt);
    tiltY=followMotion(tiltY,pointerAllowed?pointer.nx*.025*pointerWeight:0,dt);
    function place(group,p,type){
      let[x,y,z]=p.position,scale=p.scale;const r=p.rotation;
      group.position.set(x*visibleWidth,y*visibleHeight,z);
      group.scale.setScalar(unitScale*scale*(type==='headset'?breathing:1));
      const motion=reducedMotion.matches?.35:1;
      const yawWeight=motion+(1-motion)*smooth(.735,.805,progress);
      const rx=type==='headset'?r[0]*motion:Math.PI/2+(r[0]-Math.PI/2)*motion;
      const rz=type==='headset'?r[2]*motion:Math.PI+(r[2]-Math.PI)*motion;
      group.rotation.set(rx+tiltX*pointerWeight,r[1]*(type==='headset'?yawWeight:motion)+tiltY*pointerWeight,rz,type==='headset'?'XYZ':'ZXY');
    }
    place(headset.headsetGroup,pose,'headset');place(headset.controllerLeft,leftPose,'left');place(headset.controllerRight,rightPose,'right');
    explode?.frameCameraAndProduct(visibleHeight,visibleWidth);
    const framingWeight=smooth(.195,.215,progress)*(1-smooth(.605,.635,progress))*(1-(explode?.weight??0));
    if(framingWeight>0){
      const group=headset.headsetGroup,desired=group.scale.x;
      const fitted=fitObjectScale(framingCorners,group.position,group.rotation,camera,desired);
      group.scale.setScalar(THREE.MathUtils.lerp(desired,fitted,framingWeight));
    }
    if(explode?.active){
      // Keep the complete expanded envelope left of the existing specifications panel.
      const group=headset.headsetGroup;
      const fit=fitObjectScaleInViewport(explode.framingCorners,group.position,group.rotation,camera,group.scale.x,explode.viewportBounds);
      group.scale.setScalar(mobile?fit:THREE.MathUtils.lerp(group.scale.x,fit,explode.weight));
    }
    if(mobile && (progress<M.framing.diveStart||progress>M.framing.diveEnd)) {
      const bounds=boundsForProgress(progress), group=headset.headsetGroup;
      if (!explode?.active) group.scale.setScalar(fitObjectScaleInViewport(framingCorners,group.position,group.rotation,camera,group.scale.x,bounds));
      for(const controller of[headset.controllerLeft,headset.controllerRight]) {
        controller.scale.setScalar(fitObjectScaleInViewport(controllerCorners.get(controller),controller.position,controller.rotation,camera,controller.scale.x,bounds));
      }
    }
    // Aim at the midpoint of both optical centers, never at an individual eye.
    anchor.copy(bridge).multiplyScalar(headset.headsetGroup.scale.x).applyEuler(headset.headsetGroup.rotation).add(headset.headsetGroup.position);
    headset.headsetGroup.position.x+=(camera.position.x-anchor.x)*sequence.centerApproach;
    headset.headsetGroup.position.y+=(camera.position.y-anchor.y)*sequence.centerApproach;
    headset.setControllerOpacity(sequence.controllersOpacity);
    const productOpacity=mobile&&!immersive?.ready?1:sequence.productOpacity;
    canvas.style.opacity=String(productOpacity);
    if(mobile){ document.body.classList.toggle('exploding',Boolean(explode?.active)); document.documentElement.style.setProperty('--explode-weight',explode?.weight??0); }
    if(productOpacity>.001)renderer.render(scene,camera);
  }
  function screenBounds(group,corners=framingCorners){
    group.updateMatrixWorld(true);
    const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
    for(const corner of corners){
      const p=corner.clone().applyMatrix4(group.matrixWorld).project(camera),v=[(p.x+1)/2,(1-p.y)/2];
      v.forEach((n,i)=>{min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n);});
    }
    return{min,max};
  }
  // Compile opaque and fading variants, and upload hidden internal buffers before
  // releasing the loader. Use the actual framebuffer/color space, without a second loop.
  const previousVisibility=canvas.style.visibility;
  canvas.style.visibility='hidden';
  try {
    explode?.update(.53);
    await renderer.compileAsync(scene,camera);
    renderer.render(scene,camera);
    headset.setControllerOpacity(.5);
    await renderer.compileAsync(scene,camera);
    renderer.render(scene,camera);
    headset.setControllerOpacity(1);
    explode?.update(0);
    update(0,0,0);
  } finally { canvas.style.visibility=previousVisibility; }
  const startupPrograms=renderer.info.programs.length;
  onProgress(1);
  return {
    renderer,camera,headset,resize,update,
    get preparation(){return{ready:true,startupPrograms,programs:renderer.info.programs.length};},
    get modelSource(){return headset.source;},
    get opticalState(){const m=headset.materials.lens;return{physical:m.isMeshPhysicalMaterial,transmission:m.transmission,roughness:m.roughness,ior:m.ior,clearcoat:m.clearcoat,envMapIntensity:m.envMapIntensity,bakedMap:Boolean(m.map)};},
    get productState(){return{camera:camera.position.toArray(),headset:headset.headsetGroup.position.toArray(),scale:headset.headsetGroup.scale.x,rotation:headset.headsetGroup.rotation.toArray(),leftRotation:headset.controllerLeft.rotation.toArray(),rightRotation:headset.controllerRight.rotation.toArray(),left:headset.controllerLeft.position.toArray(),right:headset.controllerRight.position.toArray(),controllersVisible:headset.controllerLeft.visible,headsetBounds:screenBounds(headset.headsetGroup),renderedHeadsetBounds:screenBounds(headset.headsetGroup,explode?.active?explode.framingCorners:framingCorners),leftBounds:screenBounds(headset.controllerLeft,controllerCorners.get(headset.controllerLeft)),rightBounds:screenBounds(headset.controllerRight,controllerCorners.get(headset.controllerRight)),sequence:sequenceState(currentProgress),explode:explode?.state??{active:false,released:true}};},
    setFinish(value){headset.setFinish(value);},
    reduceQuality(){low=true;explode?.reduceQuality();headset.reduceQuality();resize();},
    dispose(){disposed=true;explode?.dispose();headset.dispose();environment.dispose();glassEnvironment.dispose();renderer.dispose();},
  };
}

