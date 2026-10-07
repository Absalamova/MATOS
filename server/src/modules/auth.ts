import type { Db } from '../db.ts';
import { json, nowIso } from '../db.ts';
import type { AdminRole, AdminUser, BodyMeasurements, User } from '../../../shared/types.ts';
import { burnPasswordCheck, hashPassword, newToken, sha256, verifyPassword } from '../lib/crypto.ts';
import { conflict, forbidden, HttpError, unauthorized } from '../lib/errors.ts';
import type { Ctx } from '../http.ts';

interface UserRow {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  password_hash: string;
  measurements: string | null;
  status: 'active' | 'blocked';
  created_at: string;
  last_login_at: string | null;
}

interface AdminRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: AdminRole;
  created_at: string;
  last_login_at: string | null;
}

export const userOut = (u: UserRow): User => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
  email: u.email,
  measurements: json<BodyMeasurements | null>(u.measurements, null),
  createdAt: u.created_at,
});

export const adminOut = (a: AdminRow): AdminUser => ({
  id: a.id,
  email: a.email,
  name: a.name,
  role: a.role,
  createdAt: a.created_at,
  lastLoginAt: a.last_login_at,
});

/* ───────────── Sessions ───────────── */

export function createSession(db: Db, kind: 'user' | 'admin', subjectId: number, ttlMs: number, ctx: Pick<Ctx, 'ip' | 'header'>) {
  const token = newToken();
  const now = Date.now();
  db.run(
    'INSERT INTO sessions (token_hash, kind, subject_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sha256(token),
    kind,
    subjectId,
    new Date(now).toISOString(),
    new Date(now + ttlMs).toISOString(),
    ctx.ip.slice(0, 64),
    ctx.header('user-agent').slice(0, 300),
  );
  return token;
}

export function bearer(ctx: Pick<Ctx, 'header'>) {
  const h = ctx.header('authorization');
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(h.trim());
  return m ? m[1] : null;
}

function findSession(db: Db, kind: 'user' | 'admin', token: string) {
  const row = db.get<{ subject_id: number; expires_at: string; created_at: string }>(
    'SELECT subject_id, expires_at, created_at FROM sessions WHERE token_hash = ? AND kind = ?',
    sha256(token),
    kind,
  );
  if (!row) return null;
  if (row.expires_at <= nowIso()) {
    db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
    return null;
  }
  return row;
}

export function revokeSession(db: Db, token: string | null) {
  if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

export function revokeAll(db: Db, kind: 'user' | 'admin', subjectId: number) {
  db.run('DELETE FROM sessions WHERE kind = ? AND subject_id = ?', kind, subjectId);
}

/** Shopper sessions slide: a visit in the second half of the lifetime extends it. */
export function currentUser(db: Db, ctx: Ctx, ttlMs: number): User | null {
  if (ctx.state.user !== undefined) return ctx.state.user as User | null;
  const token = bearer(ctx);
  let user: User | null = null;
  if (token) {
    const s = findSession(db, 'user', token);
    if (s) {
      const row = db.get<UserRow>('SELECT * FROM users WHERE id = ?', s.subject_id);
      if (row && row.status === 'active') {
        user = userOut(row);
        const left = Date.parse(s.expires_at) - Date.now();
        if (left < ttlMs / 2) db.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', new Date(Date.now() + ttlMs).toISOString(), sha256(token));
      }
    }
  }
  ctx.state.user = user;
  return user;
}

export function requireUser(db: Db, ctx: Ctx, ttlMs: number): User {
  const u = currentUser(db, ctx, ttlMs);
  if (!u) throw unauthorized('Avval profilingizga kiring');
  return u;
}

export function requireAdmin(db: Db, ctx: Ctx, role?: AdminRole): AdminUser {
  if (ctx.state.admin) return ctx.state.admin as AdminUser;
  const token = bearer(ctx);
  const s = token ? findSession(db, 'admin', token) : null;
  const row = s ? db.get<AdminRow>('SELECT * FROM admins WHERE id = ?', s.subject_id) : undefined;
  if (!row) throw unauthorized('Sessiya tugagan. Qaytadan kiring.', 'session_expired');
  const admin = adminOut(row);
  if (role === 'owner' && admin.role !== 'owner') throw forbidden('Bu bo‘lim faqat egasi uchun');
  ctx.state.admin = admin;
  return admin;
}

/* ───────────── Shoppers ───────────── */

export async function registerUser(db: Db, input: { name: string; phone: string; password: string; measurements?: BodyMeasurements }) {
  if (db.get('SELECT 1 FROM users WHERE phone = ?', input.phone)) {
    throw conflict('Bu raqam bilan profil allaqachon bor. Kirish bo‘limidan foydalaning.', 'phone_taken');
  }
  const hash = await hashPassword(input.password);
  const now = nowIso();
  try {
    const r = db.run(
      'INSERT INTO users (name, phone, password_hash, measurements, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
      input.name,
      input.phone,
      hash,
      input.measurements ? JSON.stringify(input.measurements) : null,
      now,
      now,
    );
    return userOut(db.get<UserRow>('SELECT * FROM users WHERE id = ?', r.lastId)!);
  } catch (err) {
    // Two registrations racing for one phone.
    if (String((err as Error).message).includes('UNIQUE')) throw conflict('Bu raqam bilan profil allaqachon bor.', 'phone_taken');
    throw err;
  }
}

export async function loginUser(db: Db, phone: string, password: string) {
  const row = db.get<UserRow>('SELECT * FROM users WHERE phone = ?', phone);
  if (!row) {
    await burnPasswordCheck(password);
    throw new HttpError(401, 'invalid_credentials', 'Telefon raqami yoki parol noto‘g‘ri');
  }
  if (!(await verifyPassword(password, row.password_hash))) throw new HttpError(401, 'invalid_credentials', 'Telefon raqami yoki parol noto‘g‘ri');
  if (row.status !== 'active') throw forbidden('Profil vaqtincha bloklangan. Qo‘llab-quvvatlash xizmatiga yozing.', 'blocked');
  db.run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), row.id);
  return userOut(row);
}

export function updateUser(db: Db, id: number, patch: { name?: string; email?: string | null; measurements?: BodyMeasurements }) {
  const row = db.get<UserRow>('SELECT * FROM users WHERE id = ?', id)!;
  db.run(
    'UPDATE users SET name = ?, email = ?, measurements = ? WHERE id = ?',
    patch.name ?? row.name,
    patch.email === undefined ? row.email : patch.email,
    patch.measurements ? JSON.stringify(patch.measurements) : row.measurements,
    id,
  );
  return userOut(db.get<UserRow>('SELECT * FROM users WHERE id = ?', id)!);
}

export async function changeUserPassword(db: Db, id: number, current: string, next: string) {
  const row = db.get<UserRow>('SELECT * FROM users WHERE id = ?', id)!;
  if (!(await verifyPassword(current, row.password_hash))) throw new HttpError(400, 'wrong_password', 'Joriy parol noto‘g‘ri');
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(next), id);
}

/* ───────────── Staff ───────────── */

export async function loginAdmin(db: Db, email: string, password: string) {
  const row = db.get<AdminRow>('SELECT * FROM admins WHERE email = ?', email);
  if (!row) {
    await burnPasswordCheck(password);
    throw new HttpError(401, 'invalid_credentials', 'Email yoki parol noto‘g‘ri');
  }
  if (!(await verifyPassword(password, row.password_hash))) throw new HttpError(401, 'invalid_credentials', 'Email yoki parol noto‘g‘ri');
  db.run('UPDATE admins SET last_login_at = ? WHERE id = ?', nowIso(), row.id);
  return adminOut(row);
}

export async function createAdmin(db: Db, input: { email: string; name: string; password: string; role: AdminRole }) {
  if (db.get('SELECT 1 FROM admins WHERE email = ?', input.email)) throw conflict('Bu email bilan xodim allaqachon bor', 'email_taken');
  const r = db.run(
    'INSERT INTO admins (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    input.email,
    input.name,
    await hashPassword(input.password),
    input.role,
    nowIso(),
  );
  return adminOut(db.get<AdminRow>('SELECT * FROM admins WHERE id = ?', r.lastId)!);
}

export async function setAdminPassword(db: Db, id: number, password: string) {
  db.run('UPDATE admins SET password_hash = ? WHERE id = ?', await hashPassword(password), id);
}

export async function changeAdminPassword(db: Db, id: number, current: string, next: string) {
  const row = db.get<AdminRow>('SELECT * FROM admins WHERE id = ?', id)!;
  if (!(await verifyPassword(current, row.password_hash))) throw new HttpError(400, 'wrong_password', 'Joriy parol noto‘g‘ri');
  await setAdminPassword(db, id, next);
}

export const listAdmins = (db: Db) => db.all<AdminRow>('SELECT * FROM admins ORDER BY id').map(adminOut);
