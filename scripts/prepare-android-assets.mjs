import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
await rm('mobile/android/build/web-assets',{recursive:true,force:true});
await mkdir('mobile/android/build/web-assets/web',{recursive:true});
await cp('mobile/android/build/web','mobile/android/build/web-assets/web',{recursive:true});
await copyFile('docs/THIRD_PARTY_NOTICES.txt','mobile/android/build/web-assets/THIRD_PARTY_NOTICES.txt');
