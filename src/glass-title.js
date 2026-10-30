import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MOTION, easeMotion, clockProgressAtScene, scrollProgressAtClock } from './motion.js';
import { createButterflyOcclusion } from './butterfly-occlusion.js';
import { assetUrl } from './assets.js';

// Horizon in the uncropped video (from the top). 47% of the block at 16:9.
// Wider windows compensate for object-fit: cover below. Adjust here.
export const HORIZON_Y = 0.47;
const TITLE_ASPECT = 5;
const TITLE_WIDTH = 0.88;
const SKY_FILL = 2 / 3;
const glintStart = scrollProgressAtClock(clockProgressAtScene(MOTION.field.start));
const glintEnd = scrollProgressAtClock(clockProgressAtScene(MOTION.field.end));

// The same broad studio reflection sweeps from the cap tops to the baseline.
// Use physical scroll distance; reverse scroll retraces the same lighting.
export function glintRotation(progress) {
  const scroll = scrollProgressAtClock(clockProgressAtScene(progress));
  const phase = Math.max(0, Math.min(1, (scroll - glintStart) / (glintEnd - glintStart)));
  return THREE.MathUtils.lerp(1.05, -.75, easeMotion(phase));
}

export function titleLayout(width, height, headerBottom = 72, videoWidth = 1920, videoHeight = 1080) {
  const crop = videoCover(width, height, videoWidth, videoHeight);
  const baseline = height * (HORIZON_Y - crop.offset[1]) / crop.repeat[1];
  const textHeight = Math.max(0, Math.min(baseline * SKY_FILL,
    width * TITLE_WIDTH / TITLE_ASPECT, baseline - headerBottom - 20));
  return { baseline, height: textHeight, width: textHeight * TITLE_ASPECT,
    left: (width - textHeight * TITLE_ASPECT) / 2, top: baseline - textHeight };
}

// Match object-fit: cover / object-position: 50% 50%, independently of lens UVs.
export function videoCover(viewWidth, viewHeight, videoWidth, videoHeight) {
  const viewAspect = viewWidth / viewHeight, videoAspect = videoWidth / videoHeight;
  const x = Math.min(1, viewAspect / videoAspect), y = Math.min(1, videoAspect / viewAspect);
  return { repeat: [x, y], offset: [(1 - x) / 2, (1 - y) / 2] };
}

// A lighting map only: dark studio reflections and broad silver softboxes.
// It never becomes a visible background and creates no scene objects.
function studioLighting(renderer) {
  const width = 512, height = 256, pixels = new Float32Array(width * height * 4);
  const gaussian = (value, center, spread) => Math.exp(-(((value - center) / spread) ** 2));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const front = gaussian(u, .75, .24);
    const belt = 2.2 * gaussian(v, .57 + .06 * (u - .75), .035) * front;
    const upper = .7 * gaussian(v, .76, .055) * front;
    const left = 3 * gaussian(u, .60, .016) * gaussian(v, .53, .25);
    const right = 2.5 * gaussian(u, .88, .023) * gaussian(v, .48, .24);
    const fill = .035 + .16 * gaussian(v, .3, .2);
    const light = belt + upper + left + right;
    const index = (y * width + x) * 4;
    pixels[index] = fill * .8 + light;
    pixels[index + 1] = fill * .9 + light;
    pixels[index + 2] = fill + light * 1.025;
    pixels[index + 3] = 1;
  }
  const map = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  map.mapping = THREE.EquirectangularReflectionMapping;
  map.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  try { return pmrem.fromEquirectangular(map); }
  finally { pmrem.dispose(); map.dispose(); }
}

/** Only the wordmark and lights live in this scene. No landscape geometry. */
export function createGlassTitle({ video, element, lowQuality, reducedMotion }) {
  const stage = element.parentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'glass-title-canvas'; canvas.setAttribute('aria-hidden', 'true');
  element.appendChild(canvas);
  let renderer, scene, camera, text, material, videoTexture, videoTarget, environment, foreground;
  let initialized = false, prepared = false, disposed = false, unavailable = false, pending = null;
  let visible = false, inViewport = true, dirty = true, lastVideoTime = -1;
  let lastProgress = -1, lastReducedMotion = reducedMotion.matches, highlightRotation = 0;
  let frames = 0, renderMs = 0, slowFrames = 0, qualityReduced = lowQuality, layout = null;
  const drawingSize = new THREE.Vector2(), refractionSize = { value: new THREE.Vector2(1, 1) };
  const events = new AbortController();

  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    layout = titleLayout(width, height, document.querySelector('.header').getBoundingClientRect().bottom,
      video.videoWidth || 1920, video.videoHeight || 1080);
    element.style.setProperty('--horizon-y', `${layout.baseline / height * 100}%`);
    element.style.setProperty('--title-height', `${layout.height}px`);
    element.style.setProperty('--title-width', `${layout.width}px`);
    element.style.setProperty('--title-font-size', `${layout.height / .755}px`);
    if (!initialized) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, qualityReduced ? 1 : 1.25));
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(drawingSize);
    videoTarget.setSize(drawingSize.x, drawingSize.y);
    refractionSize.value.copy(drawingSize);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    text.scale.setScalar(layout.height);
    text.position.set(0, height / 2 - layout.baseline, 0);
    const cover = videoCover(width, height, video.videoWidth || 1920, video.videoHeight || 1080);
    videoTexture.repeat.fromArray(cover.repeat); videoTexture.offset.fromArray(cover.offset);
    videoTexture.updateMatrix(); dirty = true;
  }
  function release() {
    text?.geometry.dispose(); material?.dispose(); videoTarget?.dispose();
    videoTexture?.dispose(); environment?.dispose(); renderer?.dispose();
    foreground?.dispose();
    renderer?.forceContextLoss(); initialized = false;
  }
  async function prepare() {
    if (pending) return pending;
    if (initialized || unavailable || disposed) return;
    pending = (async () => {
      try {
        const model = await new GLTFLoader().loadAsync(assetUrl('/models/glass-title.glb'));
        const mesh = model.scene.children[0], geometry = mesh.geometry;
        mesh.material.dispose();
        if (disposed) { geometry.dispose(); return; }
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Keep the refraction input and the DOM video in exactly the same colors.
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.transmissionResolutionScale = .25;
        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 4000); camera.position.z = 2000;
        videoTexture = new THREE.VideoTexture(video); videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = videoTexture.magFilter = THREE.LinearFilter; videoTexture.generateMipmaps = false;
        foreground = createButterflyOcclusion(video);
        videoTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType,
          minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
          generateMipmaps: true, depthBuffer: false });

        environment = studioLighting(renderer);
        scene.environment = environment.texture;
        scene.add(new THREE.AmbientLight(0xffffff, .3));
        const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 5, 4); scene.add(key);
        const rim = new THREE.DirectionalLight(0xddecff, 3.5); rim.position.set(5, 2, -3); scene.add(rim);
        const edge = new THREE.DirectionalLight(0xffffff, 2.8); edge.position.set(-5, 1, -2); scene.add(edge);
        // Softly hazed glass with a polished, slightly silvered front surface.
        material = new THREE.MeshPhysicalMaterial({ color: 0xedf2fa, metalness: .18,
          transmission: .88, roughness: .12, ior: 1.49, thickness: .45,
          clearcoat: .85, clearcoatRoughness: .025, dispersion: .03, envMapIntensity: 1.2 });
        // Retain Three's physical refraction. Sample the background-only frame,
        // then output letters on alpha so a second video never changes the fades.
        material.onBeforeCompile = shader => {
          shader.uniforms.videoRefractionMap = { value: videoTarget.texture };
          shader.uniforms.videoRefractionSize = refractionSize;
          shader.uniforms.butterflyMask = { value: foreground.texture };
          shader.uniforms.butterflySkyFraction = foreground.skyFraction;
          shader.uniforms.videoCoverRepeat = { value: videoTexture.repeat };
          shader.uniforms.videoCoverOffset = { value: videoTexture.offset };
          // A shallow convex optical profile on the front, shared by refraction
          // and clearcoat. The beveled perimeter retains its geometric normals.
          shader.vertexShader = 'varying float vGlassHeight;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>', '#include <begin_vertex>\nvGlassHeight = position.y;');
          shader.fragmentShader = `
            varying float vGlassHeight;
            uniform sampler2D butterflyMask;
            uniform float butterflySkyFraction;
            uniform vec2 videoCoverRepeat;
            uniform vec2 videoCoverOffset;
          ` + shader.fragmentShader.replace(
            '#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(
              'vec3 nonPerturbedNormal = normal;', `
              float glassFront = smoothstep(.72, .98, normal.z);
              normal = normalize(normal + glassFront * vec3(
                .018 * sin(vGlassHeight * 6.28318), (.52 - vGlassHeight) * .85, 0.0));
              vec3 nonPerturbedNormal = normal;
            `));
          shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>',
            THREE.ShaderChunk.transmission_pars_fragment
              .replaceAll('transmissionSamplerMap', 'videoRefractionMap')
              .replaceAll('transmissionSamplerSize', 'videoRefractionSize'));
          // Composite the ACTUAL, unrefracted butterfly pixels in front of the
          // glass. No second video, replacement butterflies or extra geometry.
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            #include <opaque_fragment>
            vec2 foregroundScreenUv = gl_FragCoord.xy / videoRefractionSize;
            vec2 foregroundVideoUv = foregroundScreenUv * videoCoverRepeat + videoCoverOffset;
            vec2 foregroundMaskUv = vec2(foregroundVideoUv.x,
              (1.0 - foregroundVideoUv.y) / butterflySkyFraction);
            float foregroundAlpha = 0.0;
            if (foregroundMaskUv.y >= 0.0 && foregroundMaskUv.y <= 1.0) {
              foregroundAlpha = texture2D(butterflyMask, foregroundMaskUv).r;
            }
            vec3 originalForeground = texture2D(videoRefractionMap, foregroundScreenUv).rgb;
            gl_FragColor = mix(gl_FragColor, vec4(originalForeground, 1.0), foregroundAlpha);
          `);
        };
        material.customProgramCacheKey = () => 'aura-video-glass-foreground-v3';
        text = new THREE.Mesh(geometry, material); text.name = 'Aura One · glass text'; scene.add(text);
        initialized = true; resize();
        await renderer.compileAsync(scene, camera);
        if (disposed) return;
        // Allocate targets and upload geometry while the initial loader is visible.
        scene.background = videoTexture; text.visible = false;
        renderer.setRenderTarget(videoTarget); renderer.render(scene, camera);
        scene.background = null; text.visible = true;
        renderer.setRenderTarget(null); renderer.render(scene, camera);
        prepared = true; dirty = true;
      } catch (error) {
        unavailable = true; release(); canvas.hidden = true;
        element.classList.remove('glass-title-ready'); console.warn('Glass wordmark: CSS fallback enabled.', error);
      } finally { pending = null; }
    })();
    await pending;
  }
  function update(progress, opacity) {
    visible = opacity > .001 && inViewport && !document.hidden;
    if (!visible || !prepared || unavailable || disposed) return;
    if (progress !== lastProgress || reducedMotion.matches !== lastReducedMotion) {
      const nextRotation = reducedMotion.matches ? 0 : glintRotation(progress);
      if (nextRotation !== highlightRotation) dirty = true;
      highlightRotation = nextRotation;
      lastProgress = progress;
      lastReducedMotion = reducedMotion.matches;
    }
    scene.environmentRotation.x = highlightRotation;
    if (foreground.update()) dirty = true;
    if (!dirty && (video.paused || reducedMotion.matches) && video.currentTime === lastVideoTime) return;
    const start = performance.now();
    // Background pass: SAME video + cover UVs; no background geometry.
    scene.background = videoTexture; text.visible = false;
    renderer.setRenderTarget(videoTarget); renderer.render(scene, camera);
    // Visible pass: beveled letters only. All pixels outside them stay transparent.
    scene.background = null; text.visible = true;
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    scene.background = videoTexture;
    element.classList.add('glass-title-ready'); lastVideoTime = video.currentTime; dirty = false; frames++;
    canvas.dataset.renderedFrames = String(frames);
    canvas.dataset.highlightRotation = highlightRotation.toFixed(5);
    canvas.dataset.foregroundFrame = String(foreground.state.frame);
    renderMs = performance.now() - start;
    slowFrames = renderMs > 12 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (!qualityReduced && slowFrames > 30) { qualityReduced = true; resize(); }
  }
  const observer = new IntersectionObserver(entries => {
    inViewport = entries[0].isIntersecting;
    if (inViewport) dirty = true; else visible = false;
  });
  observer.observe(stage);
  const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(stage);
  video.addEventListener('loadedmetadata', resize, { signal: events.signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); unavailable = true; element.classList.remove('glass-title-ready'); canvas.hidden = true;
  }, { signal: events.signal });
  resize();
  return { update, resize, prepare,
    pause() { visible = false; }, reduceQuality() { qualityReduced = true; resize(); },
    get state() { return { initialized, prepared, visible, frames, renderMs, layout, horizonY: HORIZON_Y, highlightRotation,
      foreground: foreground?.state,
      source: 'same-video', meshes: text ? 1 : 0,
      triangles: text ? (text.geometry.index?.count || text.geometry.attributes.position.count) / 3 : 0,
      pixelRatio: renderer?.getPixelRatio(), fallback: unavailable }; },
    dispose() { disposed = true; observer.disconnect(); sizeObserver.disconnect(); events.abort();
      release(); canvas.remove(); element.classList.remove('glass-title-ready'); },
  };
}
