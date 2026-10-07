#!/usr/bin/env node
// `npm run dev` — starts the API, the store and the seller panel together, with one log.
//   API    http://localhost:8080
//   Sayt   http://localhost:5173
//   Admin  http://localhost:5174
// Works the same on Windows, macOS and Linux; Ctrl+C stops everything.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { binOf, checkDeps, checkNode, ROOT } from './check.mjs';

checkNode();
checkDeps();

const vite = binOf('vite');
const color = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const procs = [
  { name: 'api  ', tint: 33, args: [path.join('scripts', 'api.mjs'), '--watch'] },
  { name: 'sayt ', tint: 36, args: [vite, '--strictPort'] },
  { name: 'admin', tint: 35, args: [vite, '--config', path.join('admin', 'vite.config.ts'), '--strictPort'] },
];

let stopping = false;
const children = procs.map((p) => {
  const child = spawn(process.execPath, p.args, {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? '1' : '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = color(p.tint, `[${p.name}]`);
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) out.write(`${tag} ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`${tag} to‘xtadi (kod ${code}).`);
    if (code) {
      const hint =
        p.name.trim() === 'api'
          ? 'API ishga tushmadi. Yuqoridagi xatoni o‘qing; 8080-port band bo‘lsa, eski oynani yoping yoki .env da PORT=8081 qiling.'
          : `${p.name.trim() === 'sayt' ? 5173 : 5174}-port band bo‘lishi mumkin — boshqa terminal oynasida ishlayotgan “npm run dev” ni yoping.`;
      console.error(color(31, `  ✖ ${hint}`));
      stopAll(1);
    }
  });
  return child;
});

setTimeout(() => {
  if (stopping) return;
  console.log(
    [
      '',
      color(1, '  MATOS ishga tushdi'),
      `  Sayt   → ${color(36, 'http://localhost:5173')}`,
      `  Admin  → ${color(35, 'http://localhost:5174')}   (birinchi ishga tushishda: admin@matos.uz / matos-admin)`,
      `  API    → ${color(33, 'http://localhost:8080/api/health')}`,
      '  To‘xtatish: Ctrl+C',
      '',
    ].join('\n'),
  );
}, 2500);

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 600);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
