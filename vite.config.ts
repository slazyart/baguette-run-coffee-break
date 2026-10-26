import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // Editing tools on Windows can create short-lived atomic-write folders.
    // They are not game assets and should never crash the dev watcher.
    watch: {
      ignored: ['**/*.tmp', '**/*.tmpdir/**', '**/test-artifacts/**'],
    },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    cssCodeSplit: false,
  },
});
