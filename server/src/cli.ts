/**
 * Maintenance commands:
 *   npm run admin:create -- <email> <password> [name] [--manager]
 *   npm run admin:password -- <email> <new-password>
 *   npm run db:backup [-- <folder>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { seedIfEmpty } from './app.ts';
import { createAdmin, revokeAll, setAdminPassword } from './modules/auth.ts';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));
const cfg = loadConfig();
const db = openDb(cfg.dbFile);

function done(msg: string, code = 0) {
  db.close();
  (code ? console.error : console.log)(msg);
  process.exit(code);
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

switch (cmd) {
  case 'create-admin': {
    const [email, password, ...name] = args;
    if (!email || !password || !emailOk(email)) done('Foydalanish: npm run admin:create -- email@domen.uz Parol123 [Ism]', 1);
    if (password.length < 8) done('Parol kamida 8 belgidan iborat bo‘lsin', 1);
    seedIfEmpty(db);
    try {
      const a = await createAdmin(db, { email: email.toLowerCase(), password, name: name.join(' ') || 'Administrator', role: flags.has('--manager') ? 'manager' : 'owner' });
      done(`Xodim qo‘shildi: ${a.email} (${a.role === 'owner' ? 'ega' : 'menejer'})`);
    } catch (err) {
      done(`Xato: ${(err as Error).message}`, 1);
    }
    break;
  }
  case 'reset-password': {
    const [email, password] = args;
    if (!email || !password) done('Foydalanish: npm run admin:password -- email@domen.uz YangiParol123', 1);
    if (password.length < 8) done('Parol kamida 8 belgidan iborat bo‘lsin', 1);
    const row = db.get<{ id: number }>('SELECT id FROM admins WHERE email = ?', email.toLowerCase());
    if (!row) done(`${email} topilmadi`, 1);
    await setAdminPassword(db, row!.id, password);
    revokeAll(db, 'admin', row!.id);
    done('Parol yangilandi. Barcha sessiyalar yopildi.');
    break;
  }
  case 'backup': {
    const dir = path.resolve(args[0] || path.join(cfg.dataDir, 'backups'));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `matos-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    done(`Zaxira nusxa: ${file}`);
    break;
  }
  default:
    done('Buyruqlar: create-admin, reset-password, backup', 1);
}
