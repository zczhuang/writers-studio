import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Target older iOS Safari / iPad Chrome (Chrome on iOS uses WebKit, so its
// supported syntax tracks the device's iOS Safari version). iOS Safari 15.4
// is the floor for iPads still on iPadOS 15. Vite/esbuild emits errors at
// build time on syntax newer than the target, catching things like regex
// lookbehind (Safari 16.4+) before they ship and crash the bundle.
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2020', 'safari15.4'],
  },
});
