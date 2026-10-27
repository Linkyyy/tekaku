import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import dart from 'highlight.js/lib/languages/dart';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import powershell from 'highlight.js/lib/languages/powershell';

// Register only these grammars; never bundle all of highlight.js.
export const lowlight = createLowlight({ plaintext, javascript, typescript, python, c, cpp, csharp, java, go, rust, php, ruby, swift, kotlin, dart, json, yaml, ini, css, xml, bash, powershell, sql, markdown, diff, dockerfile });
export const codeLanguages = [
  ['plaintext', '纯文本'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['python', 'Python'], ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'], ['java', 'Java'],
  ['go', 'Go'], ['rust', 'Rust'], ['php', 'PHP'], ['ruby', 'Ruby'], ['swift', 'Swift'],
  ['kotlin', 'Kotlin'], ['dart', 'Dart'], ['json', 'JSON'], ['yaml', 'YAML'],
  ['ini', 'INI / TOML'], ['xml', 'HTML / XML'], ['css', 'CSS'], ['bash', 'Shell / Bash'],
  ['powershell', 'PowerShell'], ['sql', 'SQL'], ['markdown', 'Markdown'],
  ['diff', 'Diff'], ['dockerfile', 'Dockerfile'],
];
export function languageName(language) {
  return ({js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',py:'python',python3:'python',
    'c++':'cpp',cc:'cpp',hpp:'cpp','c#':'csharp',cs:'csharp',rs:'rust',rb:'ruby',kt:'kotlin',kts:'kotlin',
    jsonc:'json',yml:'yaml',toml:'ini',html:'xml',svg:'xml',sh:'bash',zsh:'bash',shell:'bash',ps:'powershell',
    ps1:'powershell',md:'markdown',docker:'dockerfile',text:'plaintext',txt:'plaintext',none:'plaintext'})[language] || language;
}
