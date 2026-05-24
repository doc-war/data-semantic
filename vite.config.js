import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'index.js',
      name: 'DataPreview',
      formats: ['es', 'umd'],
      fileName: format => `data-preview.${format}.js`,
    },
    outDir: 'dist',
    minify: 'esbuild',
  },
})