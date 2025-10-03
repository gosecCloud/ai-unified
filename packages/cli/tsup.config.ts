import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: false,
  splitting: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
