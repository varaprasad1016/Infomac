import { defineConfig } from 'vite';

// One page. The 3D hero is the only reason this repo needs a build step at all:
// three.js, postprocessing and n8ao ship as bare ES modules that a browser cannot
// resolve on its own. Everything else about the site is still plain HTML and CSS.
export default defineConfig({
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181 },
  build: {
    target: 'es2022',
    // The hero video and app icon are referenced by plain relative paths from the
    // markup and are already optimised; copy them through untouched.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
