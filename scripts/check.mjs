// Environment checks shared by the launch scripts. Plain JavaScript on purpose: it must run
// (and explain the problem in Uzbek) even on an old Node.js or before `npm install`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIN = [22, 18];

export function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > MIN[0] || (major === MIN[0] && minor >= MIN[1])) return;
  console.error(
    [
      '',
      `  ✖ Node.js ${process.versions.node} eskirgan. MATOS uchun Node.js ${MIN.join('.')} yoki yangiroq kerak.`,
      '',
      '    1. https://nodejs.org saytidan “LTS” versiyasini yuklab o‘rnating (24.x tavsiya qilinadi).',
      '    2. Terminalni yopib, qayta oching va tekshiring:  node -v',
      '    3. So‘ng loyiha papkasida:  npm install  →  npm run dev',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

export function checkDeps(names = ['vite', 'react', '@vitejs/plugin-react', '@tailwindcss/vite']) {
  const missing = names.filter((n) => !fs.existsSync(path.join(ROOT, 'node_modules', n, 'package.json')));
  if (!missing.length) return;
  console.error(
    [
      '',
      `  ✖ Kutubxonalar o‘rnatilmagan (${missing.join(', ')} topilmadi).`,
      '',
      '    Loyiha papkasida bir marta shu buyruqni bering:',
      '      npm install',
      '',
      '    Agar PowerShell “running scripts is disabled” desa:  npm.cmd install   (keyin  npm.cmd run dev)',
      '    Agar npm install xato bersa: node_modules papkasi va package-lock.json faylini o‘chirib, qayta urinib ko‘ring.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

/** Absolute path to a package's CLI entry (avoids .cmd shims on Windows). */
export function binOf(pkg, name = pkg) {
  const dir = path.join(ROOT, 'node_modules', pkg);
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const rel = typeof json.bin === 'string' ? json.bin : json.bin?.[name];
  if (!rel) throw new Error(`${pkg} paketida ${name} buyrug‘i topilmadi`);
  return path.join(dir, rel);
}
