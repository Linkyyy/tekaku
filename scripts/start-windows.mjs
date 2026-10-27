import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
if (process.platform !== 'win32') {
  console.error('桌面窗口需要 Windows 10/11。当前平台请使用 npm run dev 验证编辑器。');
  process.exit(1);
}
const child = spawn(resolve('release/windows/Tekaku.exe'), process.argv.slice(2), { stdio: 'inherit' });
child.on('error', error => { console.error('请先运行 npm run package:windows。', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
