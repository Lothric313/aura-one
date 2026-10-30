import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';

const modelManifest = () => ({
  name: 'aura-model-manifest',
  configureServer(server) {
    server.middlewares.use('/models/manifest.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ available: existsSync('public/models/aura-one.glb') }));
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'models/manifest.json', source: JSON.stringify({ available: existsSync('public/models/aura-one.glb') }) });
  },
});

export default defineConfig({
  plugins: [modelManifest()],
  server: { watch: { ignored: ['**/artifacts/**'] } },
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], motion: ['gsap', 'lenis'] },
      },
    },
  },
});
