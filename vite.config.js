import { defineConfig } from 'vite';

// base './' so the build works on GitHub Pages / Netlify / any sub-folder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173 },
});
