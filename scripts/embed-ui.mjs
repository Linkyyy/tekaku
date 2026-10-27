import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function embedUI() {
// Vite bundles the editor; embedding one HTML file keeps the .exe portable
// and avoids a localhost server or loose frontend files at runtime.
let html = await readFile('dist/index.html', 'utf8');
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Vite output is missing its JS or CSS asset');
const js = await readFile(resolve('dist', script[1].replace(/^\.\//, '')), 'utf8');
const css = await readFile(resolve('dist', stylesheet[1].replace(/^\.\//, '')), 'utf8');
html = html.replace(script[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https: http:; connect-src 'none'; base-uri 'none'; form-action 'none'">`);
await mkdir('native/web', { recursive: true });
await writeFile('native/web/index.html', html);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/embed-ui.mjs')) await embedUI();
