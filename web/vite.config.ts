import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// @logic → jijie2 pure-logic engine (cc.*=0), @jjb → jjbDesign bridge (JJBData/JJBDoubles).
// Single source of truth: NOT copied — imported in place so Cocos line and React line
// read the same logic files.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@logic': resolve(__dirname, '../assets/Script/jijie2'),
      '@jjb': resolve(__dirname, '../assets/Script/jjbDesign'),
    },
  },
  server: {
    port: 7788,
    fs: { allow: [resolve(__dirname, '..')] },
  },
  build: { outDir: 'dist', target: 'es2020' },
});
