import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { loadConfig, type Config } from './config.ts';
import { openDb, nowIso, type Db } from './db.ts';
import { createHandler } from './http.ts';
import { buildRouter } from './routes.ts';
import { configureLog, log } from './lib/log.ts';
import { createRateLimiter } from './lib/rateLimit.ts';
import { createNotifier } from './lib/telegram.ts';
import { serveUpload } from './modules/uploads.ts';
import { seedFabrics } from './modules/catalog.ts';
import { seedTailors } from './modules/tailors.ts';
import { createAdmin } from './modules/auth.ts';
import { saveSettings } from './modules/settings.ts';
import { SEED_FABRICS } from '../../shared/catalog.ts';
import { SEED_TAILORS } from '../../shared/tailors.ts';
import { DEFAULT_SETTINGS } from '../../shared/pricing.ts';

/** First run: catalog, partner ateliers and settings come from shared/ seed data. */
export function seedIfEmpty(db: Db) {
  if (!db.get('SELECT 1 FROM fabrics LIMIT 1')) {
    seedFabrics(db, SEED_FABRICS);
    log.info(`Katalog yaratildi: ${SEED_FABRICS.length} ta mato`);
  }
  if (!db.get('SELECT 1 FROM tailors LIMIT 1')) seedTailors(db, SEED_TAILORS);
  if (!db.get("SELECT 1 FROM settings WHERE key = 'store'")) saveSettings(db, DEFAULT_SETTINGS);
}

/** Creates the first owner account from ADMIN_EMAIL / ADMIN_PASSWORD when there is no staff yet. */
export async function ensureOwner(db: Db, cfg: Config) {
  if (db.get('SELECT 1 FROM admins LIMIT 1')) return;
  if (!cfg.admin.email || !cfg.admin.password) {
    log.warn('Admin hisobi yo‘q. .env faylida ADMIN_EMAIL va ADMIN_PASSWORD ni kiriting yoki `npm run admin:create -- email parol` buyrug‘ini bering.');
    return;
  }
  if (cfg.env === 'production' && cfg.admin.password.length < 10) {
    log.error('ADMIN_PASSWORD kamida 10 belgidan iborat bo‘lsin. Admin hisobi yaratilmadi.');
    return;
  }
  await createAdmin(db, { email: cfg.admin.email, name: cfg.admin.name, password: cfg.admin.password, role: 'owner' });
  log.info(`Admin hisobi yaratildi: ${cfg.admin.email}`);
  if (cfg.env !== 'production' && cfg.admin.password === 'matos-admin') log.warn('Demo admin paroli ishlatilmoqda (matos-admin). Productionda albatta almashtiring.');
}

/** Fails fast with a clear message when the data folder (DB + photos) is read-only, e.g. a root-owned volume. */
function ensureWritable(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.rmSync(probe);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? String(err);
    throw new Error(
      `Ma’lumotlar papkasiga yozib bo‘lmadi: ${dir} (${code}). ` +
        'Railway’da xizmat o‘zgaruvchilariga RAILWAY_RUN_UID=0 qo‘shing; o‘z serveringizda papka egasini tekshiring (chown).',
    );
  }
}

export interface Running {
  server: http.Server;
  db: Db;
  config: Config;
  url: string;
  close: () => Promise<void>;
}

export async function startServer(overrides: Partial<Config> = {}, opts: { quiet?: boolean } = {}): Promise<Running> {
  const config = loadConfig(overrides);
  configureLog({ format: config.logFormat, silent: opts.quiet });
  if (config.dbFile !== ':memory:') ensureWritable(path.dirname(config.dbFile));
  ensureWritable(config.uploadsDir);
  const db = openDb(config.dbFile);
  seedIfEmpty(db);
  await ensureOwner(db, config);

  const notifier = createNotifier(config.telegram);
  const rateLimit = createRateLimiter({ multiplier: config.env === 'test' ? 50 : 1 });
  const router = buildRouter({ db, config, notifier, startedAt: Date.now() });
  const handler = createHandler({
    config,
    router,
    rateLimit,
    fallback: (req, res, path) => {
      if (path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end('MATOS API ishlayapti. Tekshiruv: /api/health\n');
        return true;
      }
      return serveUpload(config.uploadsDir, req, res, path);
    },
  });

  const server = http.createServer({ requestTimeout: 30_000, headersTimeout: 15_000 }, (req, res) => {
    void handler(req, res);
  });
  server.keepAliveTimeout = 65_000;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const addr = server.address() as AddressInfo;
  const host = addr.family === 'IPv6' ? `[${addr.address}]` : addr.address;
  const url = config.port === 0 ? `http://${host}:${addr.port}` : config.publicUrl;

  // Housekeeping: expired sessions and old idempotency keys.
  const sweep = setInterval(() => {
    try {
      db.run('DELETE FROM sessions WHERE expires_at <= ?', nowIso());
      db.run('DELETE FROM idempotency_keys WHERE created_at <= ?', new Date(Date.now() - 2 * 86400000).toISOString());
    } catch (err) {
      log.warn('Tozalash bajarilmadi', { err: String(err) });
    }
  }, 3600_000);
  sweep.unref();

  const close = () =>
    new Promise<void>((resolve) => {
      clearInterval(sweep);
      rateLimit.stop();
      server.close(() => {
        db.close();
        resolve();
      });
      server.closeAllConnections?.();
    });

  return { server, db, config, url, close };
}
