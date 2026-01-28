import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages - uses repo name from environment or defaults to '/'
  // GitHub Actions will set this, local dev uses root
  base: process.env.GITHUB_PAGES ? '/Project-Blender/' : '/',

  publicDir: 'public',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure clean builds
    emptyOutDir: true,
    // Target modern browsers (Phaser 3.80 requirement)
    target: 'es2020',
  },

  server: {
    // Local dev server config
    port: 5173,
    open: true,
  },

  // Handle Phaser's global requirements
  define: {
    'process.env': {},
  },
});
