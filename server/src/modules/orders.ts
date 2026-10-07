import type { Db } from '../db.ts';
import { json, nextCounter, nowIso } from '../db.ts';
import type {
  AdminOrderDTO,
  CheckoutResult,
  GarmentTypeKey,
  Localized,
  OrderDTO,
  OrderItemDTO,
  OrderKind,
  OrderStatus,
  StoreSettings,
} from '../../../shared/types.ts';
import { deliveryFeeUZS, MAX_ITEM_METERS, MIN_ITEM_METERS, round2 } from '../../../shared/pricing.ts';
import { ORDER_NUMBER_PREFIX, ORDER_STATUS_LABEL, orderStatusesFor } from '../../../shared/status.ts';
import { GARMENTS } from '../../../shared/garments.ts';
import { displayPhone } from '../../../shared/phone.ts';
import { conflict, HttpError, invalid, notFound } from '../lib/errors.ts';
import { v, type Infer } from '../lib/validate.ts';
import { escapeHtml, type Notifier } from '../lib/telegram.ts';
import { bumpCatalog } from './revision.ts';

interface OrderRow {
  id: number;
  number: string;
  kind: OrderKind;
  status: OrderStatus;
  user_id: number | null;
  customer_name: string;
  customer_phone: string;
  delivery_method: 'courier' | 'pickup';
  city: string | null;
  address: string | null;
  payment_method: 'cash' | 'card' | null;
  note: string | null;
  subtotal_uzs: number;
  delivery_uzs: number;
  total_uzs: number;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  order_id: number;
  fabric_id: string;
  color_id: string;
  fabric_name: string;
  color_name: string;
  color_hex: string;
  photo: string;
  meters: number;
  price_uzs: number;
  amount_uzs: number;
  garment_key: string | null;
}

const EMPTY_L: Localized = { uz: '', ru: '', en: '' };
const garmentKeys = GARMENTS.map((g) => g.typeKey);

export const checkoutSchema = v.object({
  customer: v.object({ name: v.string({ min: 2, max: 80 }), phone: v.phone() }),
  delivery: v.object({
    method: v.enum(['courier', 'pickup'] as const),
    city: v.string({ max: 60 }).optional(),
    address: v.string({ max: 300 }).optional(),
  }),
  payment: v.enum(['cash', 'card'] as const).default('cash'),
  note: v.string({ max: 600 }).optional(),
  items: v
    .array(
      v.object({
        fabricId: v.string({ max: 80 }),
        colorId: v.string({ max: 80 }),
        meters: v.number({ min: MIN_ITEM_METERS, max: MAX_ITEM_METERS }),
        garmentKey: v.enum(garmentKeys).optional(),
      }),
      { max: 30 },
    )
    .default([]),
  samples: v.array(v.object({ fabricId: v.string({ max: 80 }), colorId: v.string({ max: 80 }) }), { max: 10 }).default([]),
});
export type CheckoutPayload = Infer<typeof checkoutSchema>;

function photoOut(p: string, publicUrl: string) {
  return p.startsWith('/uploads/') ? `${publicUrl}${p}` : p;
}

function itemsFor(db: Db, ids: number[], publicUrl: string) {
  const map = new Map<number, OrderItemDTO[]>();
  if (!ids.length) return map;
  const rows = db.all<ItemRow>(`SELECT * FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ...ids);
  for (const r of rows) {
    const list = map.get(r.order_id) ?? [];
    list.push({
      fabricId: r.fabric_id,
      colorId: r.color_id,
      fabricName: json<Localized>(r.fabric_name, EMPTY_L),
      colorName: json<Localized>(r.color_name, EMPTY_L),
      colorHex: r.color_hex,
      photo: photoOut(r.photo, publicUrl),
      meters: r.meters,
      priceUZS: r.price_uzs,
      amountUZS: r.amount_uzs,
      garmentKey: (r.garment_key as GarmentTypeKey | null) ?? null,
    });
    map.set(r.order_id, list);
  }
  return map;
}

function orderOut(o: OrderRow, items: OrderItemDTO[]): OrderDTO {
  return {
    id: o.id,
    number: o.number,
    kind: o.kind,
    status: o.status,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    delivery: { method: o.delivery_method, city: o.city, address: o.address },
    payment: o.payment_method,
    note: o.note,
    subtotalUZS: o.subtotal_uzs,
    deliveryUZS: o.delivery_uzs,
    totalUZS: o.total_uzs,
    items,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

function ordersOut(db: Db, rows: OrderRow[], publicUrl: string): OrderDTO[] {
  const items = itemsFor(db, rows.map((r) => r.id), publicUrl);
  return rows.map((r) => orderOut(r, items.get(r.id) ?? []));
}

function adminOrderOut(db: Db, row: OrderRow, publicUrl: string): AdminOrderDTO {
  const [base] = ordersOut(db, [row], publicUrl);
  const events = db.all<{ status: OrderStatus; note: string | null; actor: string; created_at: string }>(
    'SELECT status, note, actor, created_at FROM order_events WHERE order_id = ? ORDER BY id',
    row.id,
  );
  return { ...base, userId: row.user_id, adminNote: row.admin_note, events: events.map((e) => ({ status: e.status, note: e.note, actor: e.actor, createdAt: e.created_at })) };
}

interface ColorJoin {
  fabric_id: string;
  fabric_status: string;
  price_uzs: number;
  info: string;
  color_id: string;
  color_name: string;
  hex: string;
  photos: string | null;
  stock_m: number;
  active: number;
}

function loadColor(db: Db, fabricId: string, colorId: string) {
  return db.get<ColorJoin>(
    `SELECT f.id AS fabric_id, f.status AS fabric_status, f.price_uzs, f.info, c.id AS color_id, c.name AS color_name, c.hex, c.photos, c.stock_m, c.active
     FROM fabric_colors c JOIN fabrics f ON f.id = c.fabric_id WHERE f.id = ? AND c.id = ?`,
    fabricId,
    colorId,
  );
}

const fabricName = (info: string) => JSON.stringify(json<{ name?: Localized }>(info, {}).name ?? EMPTY_L);
const mainPhoto = (photos: string | null) => json<{ swatch?: string } | null>(photos, null)?.swatch ?? '';

export interface CheckoutDeps {
  db: Db;
  settings: StoreSettings;
  notifier: Notifier;
  adminUrl: string;
}

/**
 * Places a fabric order and/or a free-sample request in one transaction.
 * Prices, delivery and stock are taken from the database — the client only says what and how much.
 * With an Idempotency-Key, a retried request returns the first result instead of a second order.
 */
export function checkout(deps: CheckoutDeps, input: CheckoutPayload, userId: number | null, idemKey: string | null): CheckoutResult {
  const { db, settings } = deps;
  const scopedKey = idemKey ? `checkout:${idemKey}` : null;
  if (scopedKey) {
    const prev = db.get<{ response: string }>('SELECT response FROM idempotency_keys WHERE key = ?', scopedKey);
    if (prev) return JSON.parse(prev.response) as CheckoutResult;
  }

  // Merge duplicate lines.
  const merged = new Map<string, { fabricId: string; colorId: string; meters: number; garmentKey?: GarmentTypeKey }>();
  for (const it of input.items) {
    const k = `${it.fabricId}|${it.colorId}`;
    const prev = merged.get(k);
    if (prev) prev.meters += it.meters;
    else merged.set(k, { ...it });
  }
  const samples = [...new Map(input.samples.map((s) => [`${s.fabricId}|${s.colorId}`, s])).values()];

  if (!merged.size && !samples.length) throw new HttpError(422, 'empty_order', 'Savat bo‘sh');
  if (samples.length > settings.maxSamples) throw invalid({ samples: `Bir buyurtmada ${settings.maxSamples} tagacha bepul namuna` });
  if (input.delivery.method === 'courier') {
    const f: Record<string, string> = {};
    if (!input.delivery.city) f['delivery.city'] = 'Shaharni tanlang';
    if (!input.delivery.address || input.delivery.address.length < 5) f['delivery.address'] = 'Manzilni to‘liq yozing';
    if (Object.keys(f).length) throw invalid(f);
  }

  const result = db.tx((): CheckoutResult => {
    const now = nowIso();
    const created: CheckoutResult['orders'] = [];
    const lines = [...merged.values()].map((it) => {
      const c = loadColor(db, it.fabricId, it.colorId);
      if (!c || c.fabric_status !== 'active' || !c.active) {
        throw conflict('Savatdagi mato sotuvdan olingan. Savatni yangilang.', 'unavailable', { fabricId: it.fabricId, colorId: it.colorId });
      }
      const meters = Math.round(it.meters * 10) / 10;
      if (meters > MAX_ITEM_METERS) throw invalid({ items: `Bitta matodan ko‘pi bilan ${MAX_ITEM_METERS} m` });
      if (c.stock_m + 1e-9 < meters) {
        throw conflict(`Omborda faqat ${round2(c.stock_m)} m qolgan`, 'out_of_stock', { fabricId: it.fabricId, colorId: it.colorId, availableM: round2(c.stock_m) });
      }
      return { ...it, meters, c, amount: Math.round(c.price_uzs * meters) };
    });

    const insertOrder = (kind: OrderKind, subtotal: number, delivery: number) => {
      const prefix = ORDER_NUMBER_PREFIX[kind];
      const number = `${prefix}-${nextCounter(db, `order_${prefix}`, kind === 'fabric' ? 1042 : 310)}`;
      const r = db.run(
        `INSERT INTO orders (number, kind, status, user_id, customer_name, customer_phone, delivery_method, city, address, payment_method, note,
          subtotal_uzs, delivery_uzs, total_uzs, created_at, updated_at)
         VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        number,
        kind,
        userId,
        input.customer.name,
        input.customer.phone,
        input.delivery.method,
        input.delivery.method === 'courier' ? input.delivery.city : null,
        input.delivery.method === 'courier' ? input.delivery.address : null,
        kind === 'fabric' ? input.payment : null,
        input.note ?? null,
        subtotal,
        delivery,
        subtotal + delivery,
        now,
        now,
      );
      db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, 'new', NULL, 'Mijoz', ?)", r.lastId, now);
      created.push({ number, kind, totalUZS: subtotal + delivery });
      return r.lastId;
    };

    if (lines.length) {
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const fee = deliveryFeeUZS(subtotal, input.delivery.method, settings, true);
      const orderId = insertOrder('fabric', subtotal, fee);
      for (const l of lines) {
        db.run(
          `INSERT INTO order_items (order_id, fabric_id, color_id, fabric_name, color_name, color_hex, photo, meters, price_uzs, amount_uzs, garment_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          orderId,
          l.fabricId,
          l.colorId,
          fabricName(l.c.info),
          l.c.color_name,
          l.c.hex,
          mainPhoto(l.c.photos),
          l.meters,
          l.c.price_uzs,
          l.amount,
          l.garmentKey ?? null,
        );
        db.run('UPDATE fabric_colors SET stock_m = MAX(0, ROUND(stock_m - ?, 2)) WHERE id = ?', l.meters, l.colorId);
      }
      bumpCatalog();
    }

    if (samples.length) {
      const orderId = insertOrder('sample', 0, 0);
      for (const s of samples) {
        const c = loadColor(db, s.fabricId, s.colorId);
        if (!c || c.fabric_status !== 'active' || !c.active) {
          throw conflict('Namunadagi mato sotuvdan olingan. Savatni yangilang.', 'unavailable', { fabricId: s.fabricId, colorId: s.colorId });
        }
        db.run(
          `INSERT INTO order_items (order_id, fabric_id, color_id, fabric_name, color_name, color_hex, photo, meters, price_uzs, amount_uzs)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
          orderId,
          s.fabricId,
          s.colorId,
          fabricName(c.info),
          c.color_name,
          c.hex,
          mainPhoto(c.photos),
        );
      }
    }

    const out = { orders: created };
    if (scopedKey) db.run('INSERT INTO idempotency_keys (key, response, created_at) VALUES (?, ?, ?)', scopedKey, JSON.stringify(out), now);
    return out;
  });

  notifyNewOrders(deps, result);
  return result;
}

function notifyNewOrders(deps: CheckoutDeps, result: CheckoutResult) {
  if (!deps.notifier.enabled) return;
  for (const o of result.orders) {
    const row = deps.db.get<OrderRow>('SELECT * FROM orders WHERE number = ?', o.number);
    if (!row) continue;
    const items = deps.db.all<ItemRow>('SELECT * FROM order_items WHERE order_id = ?', row.id);
    const money = (n: number) => `${new Intl.NumberFormat('ru-RU').format(n)} so‘m`;
    const lines = items.map((i) => {
      const name = `${json<Localized>(i.fabric_name, EMPTY_L).uz}, ${json<Localized>(i.color_name, EMPTY_L).uz}`;
      return row.kind === 'fabric' ? `• ${escapeHtml(name)} — ${i.meters} m` : `• ${escapeHtml(name)}`;
    });
    const where =
      row.delivery_method === 'pickup' ? 'Olib ketish' : `Kuryer: ${escapeHtml([row.city, row.address].filter(Boolean).join(', '))}`;
    deps.notifier.send(
      [
        `<b>${row.kind === 'fabric' ? '🧵 Yangi buyurtma' : '✂️ Bepul namuna so‘rovi'} ${row.number}</b>`,
        `${escapeHtml(row.customer_name)}, ${displayPhone(row.customer_phone)}`,
        ...lines,
        row.kind === 'fabric' ? `Jami: <b>${money(row.total_uzs)}</b>` : '',
        where,
        row.note ? `Izoh: ${escapeHtml(row.note)}` : '',
        `${deps.adminUrl}/#/${row.kind === 'fabric' ? 'orders' : 'samples'}/${row.id}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

/* ───────────── Reads ───────────── */

export function ordersForUser(db: Db, userId: number, publicUrl: string, limit = 100) {
  return ordersOut(db, db.all<OrderRow>('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', userId, limit), publicUrl);
}

export function latestOrders(db: Db, limit: number, publicUrl: string) {
  return ordersOut(db, db.all<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT ?', limit), publicUrl);
}

export interface OrderQuery {
  kind?: OrderKind;
  status?: OrderStatus;
  q?: string;
  userId?: number;
  page: number;
  pageSize: number;
}

function where(q: Omit<OrderQuery, 'page' | 'pageSize'>) {
  const w: string[] = [];
  const p: (string | number)[] = [];
  if (q.kind) {
    w.push('kind = ?');
    p.push(q.kind);
  }
  if (q.status) {
    w.push('status = ?');
    p.push(q.status);
  }
  if (q.userId) {
    w.push('user_id = ?');
    p.push(q.userId);
  }
  const text = (q.q ?? '').trim();
  if (text) {
    const digits = text.replace(/\D/g, '');
    const like = `%${text.replace(/[%_]/g, '')}%`;
    const parts = ['number LIKE ?', 'customer_name LIKE ?'];
    p.push(like, like);
    if (digits.length >= 3) {
      parts.push('customer_phone LIKE ?');
      p.push(`%${digits}%`);
    }
    w.push(`(${parts.join(' OR ')})`);
  }
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
}

export function listOrders(db: Db, q: OrderQuery, publicUrl: string) {
  const { sql, params } = where(q);
  const total = Number(db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders ${sql}`, ...params)!.n);
  const rows = db.all<OrderRow>(`SELECT * FROM orders ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, ...params, q.pageSize, (q.page - 1) * q.pageSize);
  return { items: ordersOut(db, rows, publicUrl), total, page: q.page, pageSize: q.pageSize };
}

export function getAdminOrder(db: Db, id: number, publicUrl: string) {
  const row = db.get<OrderRow>('SELECT * FROM orders WHERE id = ?', id);
  if (!row) throw notFound('Buyurtma topilmadi');
  return adminOrderOut(db, row, publicUrl);
}

/**
 * Status changes are logged as events. Cancelling a fabric order returns its metres to stock;
 * reopening a cancelled one takes them again (and fails if they are gone).
 */
export function updateOrder(db: Db, id: number, patch: { status?: OrderStatus; adminNote?: string | null; note?: string }, actor: string, publicUrl: string) {
  return db.tx(() => {
    const row = db.get<OrderRow>('SELECT * FROM orders WHERE id = ?', id);
    if (!row) throw notFound('Buyurtma topilmadi');
    const now = nowIso();
    if (patch.status && patch.status !== row.status) {
      if (!orderStatusesFor(row.kind).includes(patch.status)) {
        throw invalid({ status: `“${ORDER_STATUS_LABEL[patch.status].uz}” holati bu turdagi buyurtmaga mos emas` });
      }
      if (row.kind === 'fabric') {
        const items = db.all<{ color_id: string; meters: number }>('SELECT color_id, meters FROM order_items WHERE order_id = ?', id);
        if (patch.status === 'cancelled') {
          for (const it of items) db.run('UPDATE fabric_colors SET stock_m = ROUND(stock_m + ?, 2) WHERE id = ?', it.meters, it.color_id);
          bumpCatalog();
        } else if (row.status === 'cancelled') {
          for (const it of items) {
            const c = db.get<{ stock_m: number }>('SELECT stock_m FROM fabric_colors WHERE id = ?', it.color_id);
            if (c && c.stock_m + 1e-9 < it.meters) throw conflict(`Qayta ochib bo‘lmaydi: omborda ${round2(c.stock_m)} m qolgan`, 'out_of_stock');
            if (c) db.run('UPDATE fabric_colors SET stock_m = ROUND(stock_m - ?, 2) WHERE id = ?', it.meters, it.color_id);
          }
          bumpCatalog();
        }
      }
      db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', patch.status, now, id);
      db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)', id, patch.status, patch.note ?? null, actor, now);
    }
    if (patch.adminNote !== undefined) db.run('UPDATE orders SET admin_note = ?, updated_at = ? WHERE id = ?', patch.adminNote, now, id);
    return getAdminOrder(db, id, publicUrl);
  });
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  // Leading = + - @ would be treated as formulas by spreadsheet apps.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function exportOrdersCsv(db: Db, q: Omit<OrderQuery, 'page' | 'pageSize'>, tzOffsetMin: number) {
  const { sql, params } = where(q);
  const rows = db.all<OrderRow>(`SELECT * FROM orders ${sql} ORDER BY created_at DESC LIMIT 20000`, ...params);
  const items = itemsFor(db, rows.map((r) => r.id), '');
  const local = (iso: string) => new Date(Date.parse(iso) + tzOffsetMin * 60000).toISOString().slice(0, 16).replace('T', ' ');
  const header = ['Raqam', 'Sana', 'Holat', 'Mijoz', 'Telefon', 'Yetkazish', 'Shahar', 'Manzil', 'To‘lov', 'Mahsulotlar', 'Matolar (so‘m)', 'Yetkazish (so‘m)', 'Jami (so‘m)', 'Izoh'];
  const lines = rows.map((r) =>
    [
      r.number,
      local(r.created_at),
      ORDER_STATUS_LABEL[r.status]?.uz ?? r.status,
      r.customer_name,
      displayPhone(r.customer_phone),
      r.delivery_method === 'pickup' ? 'Olib ketish' : 'Kuryer',
      r.city ?? '',
      r.address ?? '',
      r.payment_method === 'card' ? 'Karta' : r.payment_method === 'cash' ? 'Naqd' : '',
      (items.get(r.id) ?? []).map((i) => `${i.fabricName.uz}, ${i.colorName.uz}${i.meters ? ` × ${i.meters} m` : ''}`).join('; '),
      r.subtotal_uzs,
      r.delivery_uzs,
      r.total_uzs,
      r.note ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return '﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n');
}
