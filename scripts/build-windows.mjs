import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { embedUI } from './embed-ui.mjs';
await embedUI();
await mkdir('release/windows', { recursive: true });
const loader = await readFile('native/runtime/WebView2Loader.dll');
const loaderHash = createHash('sha256').update(loader).digest('hex');
const loaderSource = await readFile('native/third_party/go-webview2/webviewloader/module_windows.go', 'utf8');
if (!loaderSource.includes(`const LoaderSHA256 = "${loaderHash}"`)) throw new Error('WebView2 SDK loader does not match the pinned SHA-256');
await copyFile('native/runtime/WebView2Loader.dll', 'release/windows/WebView2Loader.dll');
await copyFile('native/runtime/LICENSE.txt', 'release/windows/WebView2-SDK-LICENSE.txt');
const output = resolve('release/windows/Tekaku.exe');
execFileSync(process.env.TEKAKU_GO || 'go', ['build', '-trimpath', '-buildvcs=false', '-ldflags=-H=windowsgui -s -w', '-o', output, '.'], {
  cwd: 'native', stdio: 'inherit', env: { ...process.env, GOOS: 'windows', GOARCH: 'amd64', CGO_ENABLED: '0' },
});
const binary = await readFile(output);
const hash = createHash('sha256').update(binary).digest('hex');
await writeFile('release/windows/SHA256SUMS.txt', `${hash}  Tekaku.exe\n${loaderHash}  WebView2Loader.dll\n`);
await copyFile('docs/WINDOWS.txt', 'release/windows/使用说明.txt');
await copyFile('docs/THIRD_PARTY_NOTICES.txt', 'release/windows/THIRD_PARTY_NOTICES.txt');
await copyFile('docs/MARKDOWN.md', 'release/windows/Markdown编辑指南.md');
console.log(`Windows x64 executable: ${(binary.length / 1024 / 1024).toFixed(2)} MiB`);
console.log(`SHA-256: ${hash}`);
