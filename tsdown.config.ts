import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'mcp-screenshot-mac',
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  dts: true,
  sourcemap: true,
  minify: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  external: [],
  report: true,
})
