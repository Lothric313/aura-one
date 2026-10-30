import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MOBILE_CONFIG as M, deviceProfile } from '../src/mobileConfig.js';

assert.equal(deviceProfile({width:767}).tier,'mobile');
assert.equal(deviceProfile({width:768}).tier,'tablet');
assert.equal(deviceProfile({width:1199}).tier,'tablet');
assert.equal(deviceProfile({width:1200}).tier,'desktop');
assert(deviceProfile({width:390,cores:4}).low);
assert(deviceProfile({width:820,memory:2}).low);
assert(!deviceProfile({width:390,cores:8,memory:8}).low);
assert.equal(M.explode.parts.length,6);

const require=createRequire(import.meta.url);
const {chromium,devices}=require(process.env.AURA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.AURA_BROWSER_PATH?{executablePath:process.env.AURA_BROWSER_PATH}:{})});
const base=process.env.AURA_QA_URL||'http://127.0.0.1:4189/';
const out=new URL('../artifacts/mobile-qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
const results=[],failures=[],screenshots=[];
const matrix=[
  ['360',360,640],['390',390,844],['430',430,932],['768',768,1024],['820',820,1180],
  ['iPhone-SE',375,667],['iPhone-14',390,844],['iPhone-15',393,852],['Pixel-7',412,915],
  ['iPad',820,1180],['landscape-SE',667,375],['landscape-phone',844,390],['landscape-iPad',1024,768],
  ['boundary-767',767,1024],['boundary-1199',1199,900],
];
function check(condition,message){if(!condition)failures.push(message);}
try {
  for(const [name,width,height] of matrix){
    const preset=name.startsWith('iPhone')?devices['iPhone 14']:name.startsWith('Pixel')?devices['Pixel 7']:name==='iPad'?devices['iPad (gen 7)']:{};
    const context=await browser.newContext({...preset,viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.classList.contains('loaded'),null,{timeout:30000});
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.loader')).opacity)<.01);
    check(await page.evaluate(()=>window.aura.modelSource==='glb-mobile-draco'),`${name}: mobile GLB must load`);
    check(requests.some(url=>url.endsWith('inside.mp4')),`${name}: the original video must also load on mobile`);
    const samples=[];
    for(const [scene,p,selector] of [['opening',0,null],['title',.15,'.scene-title'],['design',.32,'.design-panel'],['specs',.49,'.specs-panel'],['explode',.55,null],['controllers',.68,'.controllers-panel'],['world',.90,'.landscape-title'],['return',.995,null]]){
      await page.evaluate(p=>window.aura.seek(p),p);
      await page.waitForFunction(p=>Math.abs(window.aura.progress-p)<.0003,p);
      if(scene==='world')await page.waitForFunction(()=>!window.aura.world.released,null,{timeout:15000});
      const sample=await page.evaluate(({scene,selector})=>{
        const rect=selector?document.querySelector(selector).getBoundingClientRect():null;
        const e=selector?document.querySelector(selector):null;
        return{scene,progress:window.aura.progress,overflow:document.documentElement.scrollWidth-innerWidth,model:window.aura.productState,
          panel:rect?.toJSON(),opacity:e?Number(getComputedStyle(e.matches('.info-panel')?e.firstElementChild:e).opacity):null,
          swatches:[...document.querySelectorAll('.swatch-button')].map(e=>({width:e.offsetWidth,height:e.offsetHeight})),world:window.aura.world,
          memory:{...window.aura.renderInfo.memory},pixelRatio:window.aura.pixelRatio};
      },{scene,selector});
      check(sample.overflow===0,`${name}/${scene}: horizontal overflow ${sample.overflow}`);
      if(sample.panel){check(sample.panel.top>=0&&sample.panel.bottom<=height+1,`${name}/${scene}: text clipped (${sample.panel.top}…${sample.panel.bottom}/${height})`);check(sample.panel.left>=0&&sample.panel.right<=width+1,`${name}/${scene}: text exceeds width`);}
      if(['opening','design','specs','explode','controllers','return'].includes(scene)){
        const b=sample.model.renderedHeadsetBounds;
        check(b.min.every(x=>x>=-.001)&&b.max.every(x=>x<=1.001),`${name}/${scene}: headset clipped ${JSON.stringify(b)}`);
        if(selector&&scene!=='world')check(b.max[1]*height<=sample.panel.top+1,`${name}/${scene}: headset overlaps text`);
        if(sample.model.controllersVisible)for(const side of['leftBounds','rightBounds']){
          const c=sample.model[side];check(c.min.every(x=>x>=-.001)&&c.max.every(x=>x<=1.001),`${name}/${scene}: controller clipped`);
        }
      }
      if(scene==='design'){
        check(sample.swatches.length===3,`${name}: expected three finishes`);check(sample.swatches.every(s=>s.width>=44&&s.height>=44),`${name}: small swatch`);
        await page.locator('[data-finish="black"]').click();check(await page.evaluate(()=>window.aura.finish==='black'),`${name}: black finish failed`);await page.locator('[data-finish="white"]').click();
      }
      samples.push(sample);
      if(['360','390','landscape-SE','768'].includes(name)&&['design','explode','world'].includes(scene)){
        const file=`${name}-${scene}.png`;await page.screenshot({path:fileURLToPath(new URL(file,out)),timeout:10000});screenshots.push(file);
      }
    }
    // Native dialog: focus containment, backdrop close, Escape, swipe and navigation.
    await page.locator('.menu-toggle').click();
    check(await page.locator('#mobile-menu').evaluate(e=>e.open),'menu did not open');
    check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='true',`${name}: aria-expanded`);
    await page.keyboard.press('Tab');check(await page.evaluate(()=>document.activeElement.closest('#mobile-menu')!==null),`${name}: focus escaped menu`);
    await page.keyboard.press('Escape');check(await page.locator('.menu-toggle').evaluate(e=>e===document.activeElement),`${name}: focus not restored`);
    await page.locator('.menu-toggle').click();await page.mouse.click(2,2);check(!(await page.locator('#mobile-menu').evaluate(e=>e.open)),`${name}: outside tap failed`);
    await page.locator('.menu-toggle').click();
    await page.evaluate(()=>{const e=document.querySelector('#mobile-menu');e.dispatchEvent(new TouchEvent('touchstart',{touches:[new Touch({identifier:1,target:e,clientY:100})]}));e.dispatchEvent(new TouchEvent('touchend',{changedTouches:[new Touch({identifier:1,target:e,clientY:220})]}));});
    check(!(await page.locator('#mobile-menu').evaluate(e=>e.open)),`${name}: swipe close failed`);
    await page.locator('.menu-toggle').click();await page.locator('#mobile-menu a[href="#design"]').click();
    await page.waitForFunction(()=>Math.abs(window.aura.progress-.32)<.001);
    check(!(await page.locator('#mobile-menu').evaluate(e=>e.open)),`${name}: navigation failed to close menu`);
    // Forward/backward lazy resource ownership must remain bounded.
    const memory=[];
    for(let i=0;i<3;i++)for(const p of[.49,.68]){await page.evaluate(p=>window.aura.seek(p),p);await page.waitForFunction(p=>Math.abs(window.aura.progress-p)<.0003,p);await page.waitForTimeout(40);memory.push(await page.evaluate(()=>({...window.aura.renderInfo.memory})));}
    const closed=memory.filter((_,i)=>i%2===1);check(closed.every(x=>x.geometries===closed[0].geometries&&x.textures===closed[0].textures),`${name}: memory grows after reverse navigation`);
    await page.evaluate(()=>document.querySelector('.footer').scrollIntoView({behavior:'instant'}));await page.waitForTimeout(200);
    const before=await page.evaluate(()=>window.aura.renderInfo.render.frame);await page.waitForTimeout(100);const after=await page.evaluate(()=>window.aura.renderInfo.render.frame);check(before===after,`${name}: offscreen rendering continues`);
    const targets=await page.evaluate(()=>[...document.querySelectorAll('.header a,.header button,.swatch-button,.footer a,.footer button')].map(e=>({label:e.ariaLabel||e.textContent,rect:e.getBoundingClientRect()})).filter(x=>x.rect.width>0).map(x=>({label:x.label,width:x.rect.width,height:x.rect.height})));
    check(targets.every(x=>x.width>=43.99&&x.height>=43.99),`${name}: small interactive target: ${JSON.stringify(targets.filter(x=>x.width<43.99||x.height<43.99))}`);
    check(errors.length===0,`${name}: JS errors: ${errors.join('; ')}`);
    results.push({name,width,height,errors,samples,memory});console.log(`Checked ${name} ${width}x${height}`);
    await context.close();
  }
  // Portrait -> landscape -> browser chrome height changes on one live session.
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await page.goto(base);await page.waitForFunction(()=>window.aura.modelSource!=='loading');
  for(const size of[{width:390,height:700},{width:844,height:390},{width:390,height:844}]){await page.setViewportSize(size);await page.waitForTimeout(M.scroll.refreshDebounceMs+80);await page.evaluate(()=>window.aura.seek(.32));await page.waitForFunction(()=>Math.abs(window.aura.progress-.32)<.0003);check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Rotation/chrome resize overflow');}
  await page.close();
  // Reduced motion and low-device signals must work independently of viewport.
  const low=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await low.addInitScript(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>2});});
  const p=await low.newPage();await p.goto(base);await p.waitForFunction(()=>window.aura.modelSource!=='loading');await p.evaluate(()=>window.aura.seek(.90));await p.waitForFunction(()=>!window.aura.world.released);
  const lowState=await p.evaluate(()=>({quality:window.aura.quality,dpr:window.aura.pixelRatio,world:window.aura.world,rotation:window.aura.productState.rotation}));
  check(lowState.quality==='low'&&lowState.dpr<=M.performance.lowPixelRatio,'Low-device quality/DPR');check(lowState.world.source==='video'&&lowState.world.ready&&!lowState.world.playing,'Reduced motion holds a still frame of the original video');
  results.push({name:'low-device-reduced-motion',...lowState});await low.close();
  const lifecycle=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await lifecycle.goto(base);await lifecycle.waitForFunction(()=>window.aura.modelSource!=='loading');
  check(await lifecycle.evaluate(()=>window.aura.pixelRatio<=2),'High-DPR cap');
  await lifecycle.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const frozen=await lifecycle.evaluate(()=>window.aura.renderInfo.render.frame);await lifecycle.waitForTimeout(150);check(frozen===await lifecycle.evaluate(()=>window.aura.renderInfo.render.frame),'Hidden-tab rendering continues');
  await lifecycle.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await lifecycle.waitForTimeout(80);check(frozen<await lifecycle.evaluate(()=>window.aura.renderInfo.render.frame),'Visible-tab rendering failed to resume');
  const cdp=await lifecycle.context().newCDPSession(lifecycle);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:650}]});
  for(const y of[600,500,400,300]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y}]});await lifecycle.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await lifecycle.waitForTimeout(150);
  check(await lifecycle.evaluate(()=>scrollY>0&&window.aura.progress>0),'Native touch swipe failed');await lifecycle.close();
  const fallbackContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const fallback=await fallbackContext.newPage();await fallback.route('**/models/aura-one-mobile.glb',route=>route.fulfill({status:404,body:'missing'}));await fallback.goto(base);await fallback.waitForFunction(()=>document.body.classList.contains('loaded'));
  check(await fallback.evaluate(()=>window.aura.modelSource==='glb-fallback'),'Missing-mobile-GLB fallback failed');await fallbackContext.close();
  const noGLContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await noGLContext.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
  const noGL=await noGLContext.newPage();await noGL.goto(base);await noGL.waitForFunction(()=>document.body.classList.contains('no-webgl'));
  check(await noGL.locator('.webgl-fallback').isVisible(),'WebGL fallback hidden');await noGLContext.close();
} finally {
  await fs.writeFile(new URL('results.json',out),JSON.stringify({base,results,failures,screenshots},null,2));await browser.close();
}
assert.equal(failures.length,0,failures.join('\n'));
console.log(`Passed ${matrix.length} viewports, orientation changes, native touch navigation, menu/focus, GLB, lazy resources, reduced motion and low-device mode.`);
