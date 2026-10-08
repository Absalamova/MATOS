import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root (…/MATOS). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Minimal .env reader: KEY=value lines, # comments, optional quotes. Never overrides real env vars. */
export function loadEnvFile(file: string) {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export interface Config {
  env: 'production' | 'development' | 'test';
  port: number;
  host: string;
  /** Public base URL of this API (used for uploaded image links). */
  publicUrl: string;
  /** Admin app URL (used in Telegram notifications). */
  adminUrl: string;
  dataDir: string;
  dbFile: string;
  uploadsDir: string;
  corsOrigins: string[];
  /** Number of reverse proxies in front of the API (0 = direct). */
  trustProxy: number;
  admin: { email: string; password: string; name: string };
  telegram: { token: string; chatId: string };
  sessionDaysUser: number;
  sessionHoursAdmin: number;
  /** Minutes east of UTC for daily reports (Uzbekistan: +300, no DST). */
  tzOffsetMin: number;
  logFormat: 'pretty' | 'json';
  lowStockM: number;
}

const list = (s: string | undefined) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim().replace(/\/$/, ''))
    .filter(Boolean);

const num = (s: string | undefined, d: number) => {
  const n = Number(s);
  return s !== undefined && s !== '' && Number.isFinite(n) ? n : d;
};

export function loadConfig(overrides: Partial<Config> = {}): Config {
  loadEnvFile(path.join(ROOT, '.env'));
  loadEnvFile(path.join(ROOT, 'server', '.env'));
  const e = process.env;
  const env = (e.NODE_ENV === 'production' || e.NODE_ENV === 'test' ? e.NODE_ENV : 'development') as Config['env'];
  const prod = env === 'production';
  const port = num(e.PORT, 8080);
  const dataDir = path.resolve(ROOT, e.DATA_DIR || path.join('server', 'data'));
  const devOrigins = ['http://localhost:*', 'http://127.0.0.1:*'];
  const prodOrigins = ['https://matos.uz', 'https://www.matos.uz', 'https://admin.matos.uz'];
  const cfg: Config = {
    env,
    port,
    host: e.HOST || (prod ? '127.0.0.1' : 'localhost'),
    publicUrl: (e.PUBLIC_URL || (prod ? 'https://api.matos.uz' : `http://localhost:${port}`)).replace(/\/$/, ''),
    adminUrl: (e.ADMIN_URL || (prod ? 'https://admin.matos.uz' : 'http://localhost:5174')).replace(/\/$/, ''),
    dataDir,
    dbFile: e.DB_FILE ? path.resolve(ROOT, e.DB_FILE) : path.join(dataDir, 'matos.db'),
    uploadsDir: path.join(dataDir, 'uploads'),
    corsOrigins: list(e.CORS_ORIGINS).length ? list(e.CORS_ORIGINS) : prod ? prodOrigins : devOrigins,
    trustProxy: e.TRUST_PROXY === 'true' ? 1 : Math.max(0, Math.floor(num(e.TRUST_PROXY, 0))),
    admin: {
      email: (e.ADMIN_EMAIL || (prod ? '' : 'admin@matos.uz')).trim().toLowerCase(),
      password: e.ADMIN_PASSWORD || (prod ? '' : 'matos-admin'),
      name: e.ADMIN_NAME || 'Administrator',
    },
    telegram: { token: e.TELEGRAM_BOT_TOKEN || '', chatId: e.TELEGRAM_CHAT_ID || '' },
    sessionDaysUser: num(e.SESSION_DAYS_USER, 30),
    sessionHoursAdmin: num(e.SESSION_HOURS_ADMIN, 12),
    tzOffsetMin: num(e.TZ_OFFSET_MIN, 300),
    logFormat: e.LOG_FORMAT === 'json' || (prod && e.LOG_FORMAT !== 'pretty') ? 'json' : 'pretty',
    lowStockM: num(e.LOW_STOCK_M, 20),
    ...overrides,
  };
  if (overrides.dataDir && !overrides.dbFile) cfg.dbFile = path.join(overrides.dataDir, 'matos.db');
  if (overrides.dataDir && !overrides.uploadsDir) cfg.uploadsDir = path.join(overrides.dataDir, 'uploads');
  return cfg;
}
