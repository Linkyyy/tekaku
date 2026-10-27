import { readFile, writeFile, mkdir, readdir, access, chmod, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const jvm=['-XX:ActiveProcessorCount=2','-Xms32m','-Xmx512m'];
const run=(command,args,options={})=>execFileSync(command,command==='java'?[...jvm,...args]:args,{stdio:'inherit',...options});
const sdk=resolve(process.env.TEKAKU_ANDROID_SDK||'/workspace/.tools/tekaku-android');
const tools=resolve(sdk,'build-tools/android-15'),platform=resolve(sdk,'platform/android-35/android.jar');
const build=resolve('mobile/android/build'),version=JSON.parse(await readFile('mobile/version.json','utf8'));
await access(platform);await access(resolve(build,'web/index.html'));await mkdir('release/android',{recursive:true});
await rm(resolve(build,'classes'),{recursive:true,force:true});await mkdir(resolve(build,'classes'),{recursive:true});
await rm(resolve(build,'dex'),{recursive:true,force:true});await mkdir(resolve(build,'dex'),{recursive:true});
async function files(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())result.push(...await files(path));else result.push(path);}return result;}
run(resolve(tools,'aapt2'),['compile','--dir',resolve('mobile/android/res'),'-o',resolve(build,'resources.zip')]);
run(resolve(tools,'aapt2'),['link','-o',resolve(build,'unsigned.apk'),'--manifest',resolve('mobile/android/AndroidManifest.xml'),'-I',platform,'--min-sdk-version',String(version.minSdk),'--target-sdk-version',String(version.targetSdk),'--version-code',String(version.versionCode),'--version-name',version.version,'-A',resolve(build,'web-assets'),resolve(build,'resources.zip')]);
run('java',['com.sun.tools.javac.Main','-encoding','UTF-8','-source','8','-target','8','-bootclasspath',platform+':'+resolve(tools,'core-lambda-stubs.jar'),'-d',resolve(build,'classes'),...(await files(resolve('mobile/android/src'))).filter(x=>x.endsWith('.java'))]);
run('java',['-cp',resolve(tools,'lib/d8.jar'),'com.android.tools.r8.D8','--release','--min-api',String(version.minSdk),'--lib',platform,'--output',resolve(build,'dex'),...(await files(resolve(build,'classes'))).filter(x=>x.endsWith('.class'))]);
run('python3',['-c',`import zipfile,sys,pathlib\np=pathlib.Path(sys.argv[2])\nwith zipfile.ZipFile(sys.argv[1],'a',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for f in sorted(p.glob('*.dex')):\n  i=zipfile.ZipInfo(f.name,date_time=(2000,1,1,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,f.read_bytes(),compresslevel=9)`,resolve(build,'unsigned.apk'),resolve(build,'dex')]);
run(resolve(tools,'zipalign'),['-f','4',resolve(build,'unsigned.apk'),resolve(build,'aligned.apk')]);

// Release signing material is private and outside the repository. Never add it
// to source or download snapshots; preserve it to sign compatible future updates.
const keyDirectory=resolve(process.env.TEKAKU_ANDROID_SIGNING_DIR||'/workspace/.tekaku-signing');
await mkdir(keyDirectory,{recursive:true,mode:0o700});await chmod(keyDirectory,0o700);
const keystore=resolve(keyDirectory,'android-release.p12'),passwordFile=resolve(keyDirectory,'password');
try{await access(keystore);await access(passwordFile);}catch{
 try{await access(keystore);throw new Error('现有签名库缺少密码文件，请恢复原始签名材料后重试');}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(passwordFile,randomBytes(32).toString('hex'),{mode:0o600});
 const keytool=process.env.TEKAKU_KEYTOOL||'/usr/lib/jvm/java-21-openjdk-amd64/bin/keytool';
 run(keytool,['-genkeypair','-keystore',keystore,'-storetype','PKCS12','-storepass:file',passwordFile,'-keypass:file',passwordFile,'-alias','tekaku','-keyalg','RSA','-keysize','2048','-sigalg','SHA256withRSA','-validity','10000','-dname','CN=Tekaku Android Release']);await chmod(keystore,0o600);
}
const output=resolve(`release/Tekaku-${version.version}-android.apk`);
run('java',['-jar',resolve(tools,'lib/apksigner.jar'),'sign','--ks',keystore,'--ks-key-alias','tekaku','--ks-pass','file:'+passwordFile,'--v1-signing-enabled','false','--v2-signing-enabled','true','--v3-signing-enabled','true','--v4-signing-enabled','false','--out',output,resolve(build,'aligned.apk')]);
const verified=execFileSync('java',['-jar',resolve(tools,'lib/apksigner.jar'),'verify','--verbose','--print-certs',output],{encoding:'utf8'});console.log(verified);await writeFile('release/android/apk-signature.txt',verified);
const binary=await readFile(output),hash=createHash('sha256').update(binary).digest('hex');
await writeFile('release/android/SHA256SUMS.txt',`${hash}  Tekaku-${version.version}-android.apk\n`);
await copyFile('docs/THIRD_PARTY_NOTICES.txt','release/android/THIRD_PARTY_NOTICES.txt');
console.log(`Android APK: ${(binary.length/1024).toFixed(1)} KiB; SHA-256: ${hash}`);
