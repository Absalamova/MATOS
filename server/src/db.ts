import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

type Param = string | number | bigint | null | Uint8Array;
type Input = Param | boolean | undefined;

const toParam = (v: Input): Param => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

/**
 * Thin wrapper over node:sqlite: cached prepared statements, booleans/undefined mapped to SQLite values,
 * and nested transactions via savepoints. All calls are synchronous — SQLite answers in microseconds
 * for a shop this size, and it keeps every request handler simple.
 */
export class Db {
  raw: DatabaseSync;
  private cache = new Map<string, StatementSync>();
  private depth = 0;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode = WAL');
    this.raw.exec('PRAGMA synchronous = NORMAL');
    this.raw.exec('PRAGMA foreign_keys = ON');
    this.raw.exec('PRAGMA busy_timeout = 5000');
  }

  private stmt(sql: string) {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: Input[]): T[] {
    return this.stmt(sql).all(...params.map(toParam)) as T[];
  }

  get<T = Record<string, unknown>>(sql: string, ...params: Input[]): T | undefined {
    return this.stmt(sql).get(...params.map(toParam)) as T | undefined;
  }

  run(sql: string, ...params: Input[]) {
    const r = this.stmt(sql).run(...params.map(toParam));
    return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
  }

  exec(sql: string) {
    this.raw.exec(sql);
  }

  /** Runs fn atomically. Nested calls become savepoints. */
  tx<T>(fn: () => T): T {
    const sp = `sp${this.depth}`;
    this.raw.exec(this.depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
    this.depth++;
    try {
      const out = fn();
      this.depth--;
      this.raw.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
      return out;
    } catch (err) {
      this.depth--;
      this.raw.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw err;
    }
  }

  close() {
    this.cache.clear();
    try {
      this.raw.close();
    } catch {
      /* already closed */
    }
  }
}

/** Schema migrations, applied in order and tracked with PRAGMA user_version. Never edit a shipped step — add a new one. */
const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );

  CREATE TABLE fabrics (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
    sort INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    pattern TEXT NOT NULL,
    organic INTEGER NOT NULL DEFAULT 0,
    gsm INTEGER NOT NULL,
    width_cm INTEGER NOT NULL,
    price_uzs INTEGER NOT NULL CHECK (price_uzs >= 0),
    drape_factor REAL NOT NULL,
    shrinkage_rate REAL NOT NULL DEFAULT 0,
    seller_name TEXT NOT NULL,
    info TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_fabrics_status ON fabrics (status, sort);

  CREATE TABLE fabric_colors (
    id TEXT PRIMARY KEY,
    fabric_id TEXT NOT NULL REFERENCES fabrics (id) ON DELETE CASCADE,
    sort INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    hex TEXT NOT NULL,
    roughness REAL NOT NULL DEFAULT 0.85,
    metalness REAL NOT NULL DEFAULT 0,
    sheen REAL,
    photos TEXT,
    stock_m REAL NOT NULL DEFAULT 0 CHECK (stock_m >= 0),
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_colors_fabric ON fabric_colors (fabric_id, sort);

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    measurements TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE admins (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager')),
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('user', 'admin')),
    subject_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX idx_sessions_subject ON sessions (kind, subject_id);
  CREATE INDEX idx_sessions_expiry ON sessions (expires_at);

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('fabric', 'sample')),
    status TEXT NOT NULL,
    user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('courier', 'pickup')),
    city TEXT,
    address TEXT,
    payment_method TEXT,
    note TEXT,
    subtotal_uzs INTEGER NOT NULL DEFAULT 0,
    delivery_uzs INTEGER NOT NULL DEFAULT 0,
    total_uzs INTEGER NOT NULL DEFAULT 0,
    admin_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_orders_kind_created ON orders (kind, created_at);
  CREATE INDEX idx_orders_status ON orders (kind, status);
  CREATE INDEX idx_orders_user ON orders (user_id);

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    fabric_id TEXT NOT NULL,
    color_id TEXT NOT NULL,
    fabric_name TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    photo TEXT NOT NULL DEFAULT '',
    meters REAL NOT NULL DEFAULT 0,
    price_uzs INTEGER NOT NULL DEFAULT 0,
    amount_uzs INTEGER NOT NULL DEFAULT 0,
    garment_key TEXT
  );
  CREATE INDEX idx_items_order ON order_items (order_id);

  CREATE TABLE order_events (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_events_order ON order_events (order_id);

  CREATE TABLE tailors (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
    sort INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    atelier_name TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    specialty TEXT NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0,
    rating REAL,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    completed_orders INTEGER NOT NULL DEFAULT 0,
    price_from_uzs INTEGER NOT NULL DEFAULT 0,
    lead_days INTEGER NOT NULL DEFAULT 14,
    phone TEXT NOT NULL,
    telegram TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE tailor_requests (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    tailor_id TEXT NOT NULL REFERENCES tailors (id),
    user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    garment_key TEXT NOT NULL,
    fabric_id TEXT,
    color_id TEXT,
    fabric_label TEXT NOT NULL DEFAULT '',
    measurements TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    admin_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_treq_status ON tailor_requests (status, created_at);
  CREATE INDEX idx_treq_user ON tailor_requests (user_id);

  CREATE TABLE idempotency_keys (
    key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    admin_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );
  `,
];

export function migrate(db: Db) {
  const current = Number((db.get<{ user_version: number }>('PRAGMA user_version') ?? { user_version: 0 }).user_version);
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.tx(() => {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
}

export function openDb(file: string) {
  const db = new Db(file);
  migrate(db);
  return db;
}

export const nowIso = () => new Date().toISOString();

export function json<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string' || !text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** Next value of a named counter (order numbers etc.), inside the caller's transaction. */
export function nextCounter(db: Db, name: string, start: number) {
  db.run('INSERT OR IGNORE INTO counters (name, value) VALUES (?, ?)', name, start);
  const row = db.get<{ value: number }>('UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value', name);
  return Number(row!.value);
}
