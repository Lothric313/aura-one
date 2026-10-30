import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.AURA_PLAYWRIGHT_PATH||'playwright');
const sharp=require(process.env.AURA_SHARP_PATH||'sharp');
const browser=await chromium.launch({headless:true,...(process.env.AURA_BROWSER_PATH?{executablePath:process.env.AURA_BROWSER_PATH}:{})});
const out=new URL('../artifacts/mobile-qa/',import.meta.url),results=[];await fs.mkdir(out,{recursive:true});
try{
  for(const [name,hash,p] of [['design','#design',.32],['specs','#specifications',.49],['controllers','#controllers',.68]]){
    const states=[],screens=[];
    for(const [label,base] of [['before','http://127.0.0.1:4191/'],['after','http://127.0.0.1:4190/']]){
      const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
      await page.goto(base+hash,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.classList.contains('loaded'));
      await page.waitForFunction(p=>Math.abs(window.aura.progress-p)<.0001,p);
      await page.waitForTimeout(80);
      states.push(await page.evaluate(()=>({progress:window.aura.progress,product:window.aura.productState,source:window.aura.modelSource,
        styles:[...document.querySelectorAll('.header,.scene-title,.info-panel,.info-panel h2,.panel-body,.spec-row,.footer')].map(e=>({class:e.className,text:e.textContent,css:['width','height','top','bottom','left','right','font-size','transform','color','padding','margin'].map(k=>[k,getComputedStyle(e).getPropertyValue(k)])}))})));
      const image=await page.screenshot({path:fileURLToPath(new URL(`desktop-${label}-${name}.png`,out)),timeout:15000});screens.push(image);await page.close();
    }
    // All desktop boxes, typography, full copy and key model transforms must match.
    assert.deepEqual(states[1].styles.map(x=>x.css),states[0].styles.map(x=>x.css),`Desktop ${name} styles changed`);
    for(const key of['headset','scale','rotation','left','right','leftRotation','rightRotation'])assert.deepEqual(states[1].product[key],states[0].product[key],`Desktop ${name}/${key} changed`);
    const a=await sharp(screens[0]).ensureAlpha().raw().toBuffer(),b=await sharp(screens[1]).ensureAlpha().raw().toBuffer();
    let different=0,maxDelta=0;for(let i=0;i<a.length;i+=4){let delta=0;for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(a[i+c]-b[i+c]));if(delta>2)different++;maxDelta=Math.max(maxDelta,delta);}
    const changedPixels=different/(1920*1080);
    results.push({scene:name,styleMatch:true,poseMatch:true,changedPixels,maxDelta});
    assert(changedPixels<.001,`Desktop ${name}: ${changedPixels*100}% pixels changed`);
    console.log(`Desktop ${name}: same styles/poses; ${(changedPixels*100).toFixed(5)}% changed pixels`);
  }
}finally{await fs.writeFile(new URL('desktop-regression.json',out),JSON.stringify(results,null,2));await browser.close();}
