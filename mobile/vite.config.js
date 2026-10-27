import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root:resolve('mobile'),base:'./',
  build:{target:'chrome95',outDir:resolve('mobile/android/build/web'),emptyOutDir:true},
  server:{host:'127.0.0.1',port:5174,strictPort:true},
});
