# Aura One model

Responsive devices below 1200px load `aura-one-mobile.glb` (Draco + embedded WebP <=1024). Generate it locally with `npm run model:mobile`; compression settings are in `src/mobileConfig.js`. A failed mobile load falls back to `aura-one.glb`. Desktop still uses the original file. Geometry decimation is optional and is not performed by Draco compression.

Place `aura-one.glb` here. The Vite model manifest detects it automatically on page reload; a production build includes the current model. A missing file shows the loading error state; no procedural headset is substituted.

Required independent roots: `headsetGroup`, `controller_left`, `controller_right`.
Mesh prefixes: `body`, `lens`, `cushion`, `strap`, `sensors`.
Material names: `body_mat`, `lens_mat`, `cushion_mat`, `strap_mat`, `glass_mat`.
Generate the prepared GLB and separate models with `node scripts/prepare-model.mjs path/to/oculus_quest_3.glb`.
Source: Oculus Quest 3 by AVILOV, CC BY 4.0, https://sketchfab.com/3d-models/oculus-quest-3-f4b794fc21784cd2a78392af05e0b597 . Geometry, lens surfaces and materials modified.

Orientation: front panel +Z, internal lenses -Z, up +Y. Meshes are centered and scaled to a maximum dimension of 1. Keep straps inside a reasonable product bounding box. Draco compression is supported by the bundled decoder at `/draco/`.
