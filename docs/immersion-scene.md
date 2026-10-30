# Original video and glass Aura One wordmark

The immersive scene uses the original `public/media/inside.mp4` on desktop,
tablet and phone. Its SHA-256 is
`4d190dca310c6ee75a5366c8614148f82a135b8ad2cb1cfa8c538d208a227e4a`.
The video is unchanged. One muted, looping, inline video also supplies the
two optical screens. It pauses outside immersion and in hidden tabs;
reduced motion holds a still frame.

`src/glass-title.js` renders one beveled Inter Black TextGeometry using
MeshPhysicalMaterial (transmission .88, IOR 1.49, roughness .12, thickness
.45, metalness .18, clearcoat .85, dispersion .03, environment intensity 1.2).
The wider, smoothly shaded bevel gives the front rounded glass reflections;
light surface haze and a silver coating improve contrast while retaining
video refraction. A neutral studio lighting map supplies broad white
softbox reflections against dark regions, matching the front glass in the
reference. It is baked to a PMREM once and never used as a visible backdrop.
The scene contains one text mesh and lights only; no rear graphic elements.
The central softbox reflection sweeps from the top of the letters to their
baseline across the field chapter (`.87`–`.93`). `glintRotation()` maps the
existing physical scroll distance to the lighting map's X rotation, using
the shared easing. Reverse scroll retraces the reflection; stopping scroll
holds it in place. No PMREM regeneration or additional animation loop is
needed. Reduced motion keeps the original stationary reflection.
The subset font asset `public/fonts/Inter-Black-title.typeface.json` comes
from the existing licensed Inter 4.1 Black font; no extra font dependency.

`HORIZON_Y = 0.47` is measured from the top of the uncropped video. At 16:9
this is 47% of the block height; wider windows adjust for the video's
vertical cover crop. The bottom of the mesh sits exactly on that line.
The Full HD title spans 88% of the block width and about two thirds of the
sky. Other sizes retain its proportions, with 20px clearance below the header.

A separate VideoTexture uses the same HTML video decoder, with centered
cover UVs independent of the existing optical-screen crop. A background-only
render target captures scene.background for Three's physical transmission
shader. The final canvas renders only the letters onto alpha, so pixels
outside the text and the existing entry/exit crossfades remain unchanged.
There are no landscape meshes or new scenery. `src/world-title.css` adds
a thin dark outline, bright edge and a neutral CSS fallback.

Butterflies crossing the letters remain in the foreground. The sparse alpha
mask in `public/media/butterfly-occlusion.json` is extracted from the exact
original video (its hash is checked), including the wings near the horizon.
`src/butterfly-occlusion.js` follows the video's presented frame at 24 fps
and uploads one small R8 mask. The text shader composites the unmodified,
unrefracted video pixels over the glass before color conversion. It uses the
same cover crop and decoded video frame, with no second video decoder,
additional butterfly imagery, scene objects or live segmentation work.
Regenerate after replacing the source video using
`python scripts/prepare-butterfly-mask.py [ffmpeg-path]` (numpy and Pillow).

The existing GSAP ticker drives the text; it creates no animation loop.
Rendering stops outside the video's visible interval, outside the viewport,
at the footer and when the document is hidden. Paused/reduced-motion video
renders once until a frame, scroll-driven reflection or layout changes. Pixel ratio is capped at 1.25
(1 on low quality), with adaptive reduction for slow text frames.
All other product, exploded-view and responsive layouts retain the existing
implementation. `node scripts/check-glass-title.mjs` verifies eight viewport
layouts, cover alignment, header clearance and the unchanged video's hash.

The field chapter (scene progress `.87`–`.93`) now takes exactly half its
previous scroll distance: 234.242941vh becomes 117.121471vh on both desktop
and mobile. `MOTION.field.scrollScale` controls this factor. Smooth ramps
match the original scroll velocity at both boundaries; other scenes keep
their original distances. Page height is reduced by the saved distance,
and navigation uses the inverse mapping when seeking a scene.
