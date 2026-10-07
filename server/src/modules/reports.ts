import type { Db } from '../db.ts';
import { json, nowIso } from '../db.ts';
import type { AdminCustomer, AdminStats, Localized } from '../../../shared/types.ts';
import { notFound } from '../lib/errors.ts';
import { latestOrders, ordersForUser } from './orders.ts';
import { revokeAll } from './auth.ts';

/* ───────────── Customers ───────────── */

interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  status: 'active' | 'blocked';
  created_at: string;
  last_login_at: string | null;
  orders_count: number;
  total_spent: number | null;
}

const customerOut = (r: CustomerRow): AdminCustomer => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  status: r.status,
  ordersCount: Number(r.orders_count ?? 0),
  totalSpentUZS: Number(r.total_spent ?? 0),
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

const CUSTOMER_SELECT = `
  SELECT u.id, u.name, u.phone, u.email, u.status, u.created_at, u.last_login_at,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
    (SELECT SUM(o.total_uzs) FROM orders o WHERE o.user_id = u.id AND o.kind = 'fabric' AND o.status != 'cancelled') AS total_spent
  FROM users u`;

export function listCustomers(db: Db, q: { q?: string; page: number; pageSize: number }) {
  const text = (q.q ?? '').trim();
  const params: (string | number)[] = [];
  let sql = '';
  if (text) {
    const digits = text.replace(/\D/g, '');
    const like = `%${text.replace(/[%_]/g, '')}%`;
    sql = digits.length >= 3 ? 'WHERE u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?' : 'WHERE u.name LIKE ? OR u.email LIKE ?';
    params.push(...(digits.length >= 3 ? [like, `%${digits}%`, like] : [like, like]));
  }
  const total = Number(db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM users u ${sql}`, ...params)!.n);
  const rows = db.all<CustomerRow>(`${CUSTOMER_SELECT} ${sql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, ...params, q.pageSize, (q.page - 1) * q.pageSize);
  return { items: rows.map(customerOut), total, page: q.page, pageSize: q.pageSize };
}

export function getCustomer(db: Db, id: number, publicUrl: string) {
  const row = db.get<CustomerRow>(`${CUSTOMER_SELECT} WHERE u.id = ?`, id);
  if (!row) throw notFound('Mijoz topilmadi');
  const orders = ordersForUser(db, id, publicUrl, 200);
  const measurements = json(db.get<{ measurements: string | null }>('SELECT measurements FROM users WHERE id = ?', id)?.measurements, null);
  return { customer: customerOut(row), measurements, orders };
}

export function setCustomerStatus(db: Db, id: number, status: 'active' | 'blocked') {
  const r = db.run('UPDATE users SET status = ? WHERE id = ?', status, id);
  if (!r.changes) throw notFound('Mijoz topilmadi');
  if (status === 'blocked') revokeAll(db, 'user', id);
  return customerOut(db.get<CustomerRow>(`${CUSTOMER_SELECT} WHERE u.id = ?`, id)!);
}

/* ───────────── Dashboard ───────────── */

export function stats(db: Db, opts: { tzOffsetMin: number; lowStockM: number; publicUrl: string }): AdminStats {
  const off = `${opts.tzOffsetMin >= 0 ? '+' : ''}${opts.tzOffsetMin} minutes`;
  const localDay = (iso: string) => new Date(Date.parse(iso) + opts.tzOffsetMin * 60000).toISOString().slice(0, 10);
  const today = localDay(nowIso());
  const dayStart = (daysBack: number) => {
    // Start of the local day `daysBack` days ago, as a UTC ISO string comparable with created_at.
    const local = Date.parse(`${today}T00:00:00.000Z`) - daysBack * 86400000;
    return new Date(local - opts.tzOffsetMin * 60000).toISOString();
  };
  const revenueSince = (iso: string) =>
    Number(db.get<{ s: number | null }>("SELECT SUM(total_uzs) AS s FROM orders WHERE kind = 'fabric' AND status != 'cancelled' AND created_at >= ?", iso)!.s ?? 0);
  const count = (sql: string, ...p: string[]) => Number(db.get<{ n: number }>(sql, ...p)!.n);

  const byDay = db.all<{ d: string; n: number; s: number }>(
    `SELECT date(created_at, ?) AS d, COUNT(*) AS n, SUM(total_uzs) AS s FROM orders
     WHERE kind = 'fabric' AND status != 'cancelled' AND created_at >= ? GROUP BY d`,
    off,
    dayStart(29),
  );
  const map = new Map(byDay.map((r) => [r.d, r]));
  const ordersByDay = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.parse(`${today}T00:00:00.000Z`) - (29 - i) * 86400000).toISOString().slice(0, 10);
    const r = map.get(d);
    return { date: d, count: Number(r?.n ?? 0), totalUZS: Number(r?.s ?? 0) };
  });

  const low = db.all<{ fabric_id: string; info: string; color_id: string; name: string; stock_m: number }>(
    `SELECT f.id AS fabric_id, f.info, c.id AS color_id, c.name, c.stock_m FROM fabric_colors c JOIN fabrics f ON f.id = c.fabric_id
     WHERE f.status = 'active' AND c.active = 1 AND c.stock_m < ? ORDER BY c.stock_m LIMIT 50`,
    opts.lowStockM,
  );

  return {
    counts: {
      newOrders: count("SELECT COUNT(*) AS n FROM orders WHERE kind = 'fabric' AND status = 'new'"),
      newSamples: count("SELECT COUNT(*) AS n FROM orders WHERE kind = 'sample' AND status = 'new'"),
      newTailorRequests: count("SELECT COUNT(*) AS n FROM tailor_requests WHERE status = 'new'"),
      pendingTailors: count("SELECT COUNT(*) AS n FROM tailors WHERE status = 'pending'"),
      customers: count('SELECT COUNT(*) AS n FROM users'),
      lowStock: low.length,
    },
    revenue: { todayUZS: revenueSince(dayStart(0)), weekUZS: revenueSince(dayStart(6)), monthUZS: revenueSince(dayStart(29)) },
    ordersByDay,
    latest: latestOrders(db, 8, opts.publicUrl),
    lowStock: low.map((r) => ({
      fabricId: r.fabric_id,
      fabricName: json<{ name?: Localized }>(r.info, {}).name?.uz ?? r.fabric_id,
      colorId: r.color_id,
      colorName: json<Localized>(r.name, { uz: '', ru: '', en: '' }).uz,
      stockM: Math.round(r.stock_m * 100) / 100,
    })),
  };
}
