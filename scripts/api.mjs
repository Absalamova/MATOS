#!/usr/bin/env node
// Launches the API (server/src/*.ts runs directly on Node's built-in TypeScript support).
//   node scripts/api.mjs            → production-style start
//   node scripts/api.mjs --watch    → restart on file changes (development)
//   node scripts/api.mjs --test     → integration tests
//   node scripts/api.mjs --cli create-admin email parol
import { spawn } from 'node:child_process';
import path from 'node:path';
import { checkNode, ROOT } from './check.mjs';

checkNode();

const args = process.argv.slice(2);
const base = ['--disable-warning=ExperimentalWarning'];
let cmd;
if (args[0] === '--test') cmd = [...base, '--test', path.join('server', 'test', 'api.test.ts')];
else if (args[0] === '--cli') cmd = [...base, path.join('server', 'src', 'cli.ts'), ...args.slice(1)];
else cmd = [...base, ...(args.includes('--watch') ? ['--watch', '--watch-preserve-output'] : []), path.join('server', 'src', 'index.ts')];

const env = { ...process.env };
if (args[0] === '--test' && !env.NODE_ENV) env.NODE_ENV = 'test';
const child = spawn(process.execPath, cmd, { cwd: ROOT, stdio: 'inherit', env });
const forward = (sig) => () => child.kill(sig);
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
