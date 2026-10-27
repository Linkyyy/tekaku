import { mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root=resolve(process.env.TEKAKU_ANDROID_SDK||'/workspace/.tools/tekaku-android');
if(process.platform!=='linux'||process.arch!=='x64')throw new Error('此可复现构建脚本需要 Linux x64 与 Java 21（Windows 可使用 WSL）');
const packages=[
 {file:'build-tools.zip',directory:'build-tools',url:'https://dl.google.com/android/repository/build-tools_r35_linux.zip',sha256:'bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88',check:'android-15/aapt2'},
 {file:'platform.zip',directory:'platform',url:'https://dl.google.com/android/repository/platform-35_r02.zip',sha256:'0988cacad01b38a18a47bac14a0695f246bc76c1b06c0eeb8eb0dc825ab0c8e0',check:'android-35/android.jar'},
];
await mkdir(root,{recursive:true});
for(const item of packages){
 const archive=resolve(root,item.file);
 try{await access(archive);}catch{execFileSync('curl',['--fail','--location','--silent','--show-error',item.url,'--output',archive],{stdio:'inherit'});}
 if(createHash('sha256').update(await readFile(archive)).digest('hex')!==item.sha256)throw new Error('Android SDK 归档校验失败：'+item.file);
 try{await access(resolve(root,item.directory,item.check));}catch{
  execFileSync('python3',['-c',`import zipfile,pathlib,sys\nr=pathlib.Path(sys.argv[2])\nwith zipfile.ZipFile(sys.argv[1]) as z:\n z.extractall(r)\n for e in z.infolist():\n  p=r/e.filename\n  if p.is_file() and (e.external_attr>>16)&0o111:p.chmod(0o755)`,archive,resolve(root,item.directory)],{stdio:'inherit'});
 }
}
execFileSync('java',['com.sun.tools.javac.Main','-version'],{stdio:'inherit'});
await writeFile(resolve(root,'sources.json'),JSON.stringify(packages,null,2)+'\n');
console.log('Android SDK archives verified; Java compiler available.');
