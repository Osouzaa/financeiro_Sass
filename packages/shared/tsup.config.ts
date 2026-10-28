import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Em modo watch não apaga o dist: a API e o front continuam enxergando o pacote durante a recompilação
  clean: !options.watch,
  sourcemap: true,
}));
