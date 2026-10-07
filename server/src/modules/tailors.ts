import type { Db } from '../db.ts';
import { json, nextCounter, nowIso } from '../db.ts';
import type {
  AdminTailor,
  AdminTailorRequestDTO,
  BodyMeasurements,
  GarmentTypeKey,
  Localized,
  SpecialtyKey,
  Tailor,
  TailorRequestDTO,
  TailorRequestStatus,
  TailorStatus,
} from '../../../shared/types.ts';
import { SPECIALTIES, specialtyFor } from '../../../shared/tailors.ts';
import { GARMENTS } from '../../../shared/garments.ts';
import { TAILOR_REQUEST_STATUSES } from '../../../shared/status.ts';
import { displayPhone } from '../../../shared/phone.ts';
import { conflict, notFound } from '../lib/errors.ts';
import { v, type Infer } from '../lib/validate.ts';
import { randomHex } from '../lib/crypto.ts';
import { escapeHtml, type Notifier } from '../lib/telegram.ts';
import { slugify } from './catalog.ts';

interface TailorRow {
  id: string;
  status: TailorStatus;
  sort: number;
  name: string;
  atelier_name: string;
  city: string;
  district: string;
  address: string;
  specialty: SpecialtyKey;
  experience_years: number;
  rating: number | null;
  reviews_count: number;
  completed_orders: number;
  price_from_uzs: number;
  lead_days: number;
  phone: string;
  telegram: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface RequestRow {
  id: number;
  number: string;
  tailor_id: string;
  user_id: number | null;
  customer_name: string;
  customer_phone: string;
  garment_key: GarmentTypeKey;
  fabric_id: string | null;
  color_id: string | null;
  fabric_label: string;
  measurements: string | null;
  note: string | null;
  status: TailorRequestStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_L: Localized = { uz: '', ru: '', en: '' };
const fill = (l: Localized) => ({ uz: l.uz, ru: l.ru || l.uz, en: l.en || l.uz });

function tailorOut(r: TailorRow): Tailor {
  return {
    id: r.id,
    name: r.name,
    atelierName: r.atelier_name,
    city: r.city,
    district: r.district,
    specialtyKey: r.specialty,
    specialtyLabel: specialtyFor(r.specialty).label,
    experienceYears: r.experience_years,
    // A rating means something only after a couple of real reviews.
    rating: r.reviews_count > 1 ? r.rating : null,
    reviewsCount: r.reviews_count,
    completedOrders: r.completed_orders,
    priceStartingUZS: r.price_from_uzs,
    leadDays: r.lead_days,
    phone: displayPhone(r.phone),
    telegram: r.telegram,
    address: r.address,
    description: fill(json<Localized>(r.description, EMPTY_L)),
  };
}

const adminTailorOut = (r: TailorRow): AdminTailor => ({
  ...tailorOut(r),
  rating: r.rating,
  description: json<Localized>(r.description, EMPTY_L),
  status: r.status,
  sort: r.sort,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const listPublicTailors = (db: Db) =>
  db.all<TailorRow>("SELECT * FROM tailors WHERE status = 'approved' ORDER BY sort, COALESCE(rating, 0) DESC, created_at").map(tailorOut);

export const listAdminTailors = (db: Db, status?: TailorStatus) =>
  db
    .all<TailorRow>(
      `SELECT * FROM tailors ${status ? 'WHERE status = ?' : ''} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, sort, created_at DESC`,
      ...(status ? [status] : []),
    )
    .map(adminTailorOut);

const specialtyKeys = SPECIALTIES.map((s) => s.id);
const telegram = v.string({ min: 0, max: 40, pattern: /^@?[A-Za-z0-9_]{0,32}$/, message: 'Telegram: @username ko‘rinishida' }).default('');

export const applicationSchema = v.object({
  name: v.string({ min: 2, max: 80 }),
  atelierName: v.string({ min: 2, max: 100 }),
  city: v.string({ max: 60 }),
  district: v.string({ max: 120 }).default(''),
  specialtyKey: v.enum(specialtyKeys),
  experienceYears: v.number({ min: 0, max: 70, int: true }).default(0),
  priceStartingUZS: v.number({ min: 0, max: 100_000_000, int: true }).default(0),
  phone: v.phone(),
  telegram,
  description: v.string({ max: 600 }).default(''),
});

export const tailorAdminSchema = v.object({
  status: v.enum(['pending', 'approved', 'rejected', 'hidden'] as const),
  sort: v.number({ int: true, min: -100000, max: 100000 }).default(0),
  name: v.string({ min: 2, max: 80 }),
  atelierName: v.string({ min: 2, max: 100 }),
  city: v.string({ max: 60 }),
  district: v.string({ max: 120 }).default(''),
  address: v.string({ max: 200 }).default(''),
  specialtyKey: v.enum(specialtyKeys),
  experienceYears: v.number({ min: 0, max: 70, int: true }).default(0),
  rating: v.number({ min: 1, max: 5 }).nullable(),
  reviewsCount: v.number({ min: 0, max: 1_000_000, int: true }).default(0),
  completedOrders: v.number({ min: 0, max: 1_000_000, int: true }).default(0),
  priceStartingUZS: v.number({ min: 0, max: 100_000_000, int: true }).default(0),
  leadDays: v.number({ min: 1, max: 365, int: true }).default(14),
  phone: v.phone(),
  telegram,
  description: v.localized({ max: 600 }),
});

const tg = (s: string) => (s ? `@${s.replace(/^@/, '')}` : '');

export function applyTailor(db: Db, a: Infer<typeof applicationSchema>, notifier: Notifier, adminUrl: string) {
  const now = nowIso();
  const id = `t-${slugify(a.atelierName).slice(0, 30) || 'atelye'}-${randomHex(2)}`;
  const spec = specialtyFor(a.specialtyKey).label;
  const description = a.description
    ? { uz: a.description, ru: '', en: '' }
    : { uz: `${a.atelierName} — ${spec.uz.toLowerCase()}.`, ru: `${a.atelierName} — ${spec.ru.toLowerCase()}.`, en: `${a.atelierName} — ${spec.en.toLowerCase()}.` };
  db.run(
    `INSERT INTO tailors (id, status, name, atelier_name, city, district, address, specialty, experience_years, price_from_uzs, phone, telegram, description, created_at, updated_at)
     VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    a.name,
    a.atelierName,
    a.city,
    a.district,
    [a.city, a.district].filter(Boolean).join(', '),
    a.specialtyKey,
    a.experienceYears,
    a.priceStartingUZS,
    a.phone,
    tg(a.telegram),
    JSON.stringify(description),
    now,
    now,
  );
  notifier.send(
    `<b>🪡 Yangi atelye arizasi</b>\n${escapeHtml(a.atelierName)} — ${escapeHtml(a.name)}\n${escapeHtml(a.city)}, ${displayPhone(a.phone)}\n${adminUrl}/#/tailors`,
  );
  return { id, status: 'pending' as const };
}

export function saveTailor(db: Db, id: string | undefined, t: Infer<typeof tailorAdminSchema>) {
  const now = nowIso();
  const tid = id ?? `t-${slugify(t.atelierName).slice(0, 30) || 'atelye'}-${randomHex(2)}`;
  if (id && !db.get('SELECT 1 FROM tailors WHERE id = ?', id)) throw notFound('Atelye topilmadi');
  const args = [
    t.status,
    t.sort,
    t.name,
    t.atelierName,
    t.city,
    t.district,
    t.address || [t.city, t.district].filter(Boolean).join(', '),
    t.specialtyKey,
    t.experienceYears,
    t.rating,
    t.reviewsCount,
    t.completedOrders,
    t.priceStartingUZS,
    t.leadDays,
    t.phone,
    tg(t.telegram),
    JSON.stringify(t.description),
  ] as const;
  if (id) {
    db.run(
      `UPDATE tailors SET status = ?, sort = ?, name = ?, atelier_name = ?, city = ?, district = ?, address = ?, specialty = ?, experience_years = ?,
       rating = ?, reviews_count = ?, completed_orders = ?, price_from_uzs = ?, lead_days = ?, phone = ?, telegram = ?, description = ?, updated_at = ? WHERE id = ?`,
      ...args,
      now,
      tid,
    );
  } else {
    db.run(
      `INSERT INTO tailors (status, sort, name, atelier_name, city, district, address, specialty, experience_years, rating, reviews_count, completed_orders,
       price_from_uzs, lead_days, phone, telegram, description, created_at, updated_at, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...args,
      now,
      now,
      tid,
    );
  }
  return adminTailorOut(db.get<TailorRow>('SELECT * FROM tailors WHERE id = ?', tid)!);
}

export function setTailorStatus(db: Db, id: string, status: TailorStatus) {
  const r = db.run('UPDATE tailors SET status = ?, updated_at = ? WHERE id = ?', status, nowIso(), id);
  if (!r.changes) throw notFound('Atelye topilmadi');
  return adminTailorOut(db.get<TailorRow>('SELECT * FROM tailors WHERE id = ?', id)!);
}

/** Ateliers with requests are hidden instead of deleted so the request history stays intact. */
export function deleteTailor(db: Db, id: string) {
  if (!db.get('SELECT 1 FROM tailors WHERE id = ?', id)) throw notFound('Atelye topilmadi');
  if (db.get('SELECT 1 FROM tailor_requests WHERE tailor_id = ? LIMIT 1', id)) {
    db.run("UPDATE tailors SET status = 'hidden', updated_at = ? WHERE id = ?", nowIso(), id);
    return { deleted: false, hidden: true };
  }
  db.run('DELETE FROM tailors WHERE id = ?', id);
  return { deleted: true, hidden: false };
}

export function seedTailors(db: Db, list: Tailor[]) {
  const now = nowIso();
  db.tx(() =>
    list.forEach((t, i) =>
      db.run(
        `INSERT INTO tailors (id, status, sort, name, atelier_name, city, district, address, specialty, experience_years, rating, reviews_count, completed_orders,
         price_from_uzs, lead_days, phone, telegram, description, created_at, updated_at) VALUES (?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id,
        i * 10,
        t.name,
        t.atelierName,
        t.city,
        t.district,
        t.address,
        t.specialtyKey,
        t.experienceYears,
        t.rating,
        t.reviewsCount,
        t.completedOrders,
        t.priceStartingUZS,
        t.leadDays,
        t.phone.replace(/\D/g, ''),
        t.telegram,
        JSON.stringify(t.description),
        now,
        now,
      ),
    ),
  );
}

/* ───────────── Tailoring requests ───────────── */

export const requestSchema = v.object({
  tailorId: v.string({ max: 80 }),
  garmentKey: v.enum(GARMENTS.map((g) => g.typeKey)),
  fabricId: v.string({ max: 80 }).optional(),
  colorId: v.string({ max: 80 }).optional(),
  customer: v.object({ name: v.string({ min: 2, max: 80 }), phone: v.phone() }),
  measurements: v
    .object({
      heightCm: v.number({ min: 120, max: 220 }),
      bustCm: v.number({ min: 60, max: 160 }),
      waistCm: v.number({ min: 45, max: 150 }),
      hipsCm: v.number({ min: 60, max: 170 }),
    })
    .optional(),
  note: v.string({ max: 800 }).optional(),
});

function requestOut(db: Db, r: RequestRow): AdminTailorRequestDTO {
  const t = db.get<TailorRow>('SELECT * FROM tailors WHERE id = ?', r.tailor_id);
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    tailor: {
      id: r.tailor_id,
      name: t?.name ?? '',
      atelierName: t?.atelier_name ?? '—',
      city: t?.city ?? '',
      phone: t ? displayPhone(t.phone) : '',
      telegram: t?.telegram ?? '',
    },
    garmentKey: r.garment_key,
    fabricId: r.fabric_id,
    colorId: r.color_id,
    fabricLabel: r.fabric_label,
    measurements: json<BodyMeasurements | null>(r.measurements, null),
    note: r.note,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    userId: r.user_id,
    adminNote: r.admin_note,
  };
}

const publicRequest = (x: AdminTailorRequestDTO): TailorRequestDTO => {
  const { userId: _u, adminNote: _a, ...rest } = x;
  return rest;
};

export function createTailorRequest(db: Db, input: Infer<typeof requestSchema>, userId: number | null, notifier: Notifier, adminUrl: string) {
  const out = db.tx(() => {
    const t = db.get<TailorRow>("SELECT * FROM tailors WHERE id = ? AND status = 'approved'", input.tailorId);
    if (!t) throw conflict('Bu atelye hozir buyurtma qabul qilmayapti', 'tailor_unavailable');
    let fabricLabel = 'Mijozning o‘z matosi';
    if (input.fabricId) {
      const f = db.get<{ info: string }>("SELECT info FROM fabrics WHERE id = ? AND status != 'archived'", input.fabricId);
      const c = input.colorId ? db.get<{ name: string }>('SELECT name FROM fabric_colors WHERE id = ? AND fabric_id = ?', input.colorId, input.fabricId) : undefined;
      if (f) {
        const fname = json<{ name?: Localized }>(f.info, {}).name?.uz ?? input.fabricId;
        fabricLabel = c ? `${fname}, ${json<Localized>(c.name, EMPTY_L).uz}` : fname;
      }
    }
    const now = nowIso();
    const number = `TK-${nextCounter(db, 'tailor_TK', 1000)}`;
    const r = db.run(
      `INSERT INTO tailor_requests (number, tailor_id, user_id, customer_name, customer_phone, garment_key, fabric_id, color_id, fabric_label, measurements, note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      number,
      t.id,
      userId,
      input.customer.name,
      input.customer.phone,
      input.garmentKey,
      input.fabricId ?? null,
      input.fabricId ? (input.colorId ?? null) : null,
      fabricLabel,
      input.measurements ? JSON.stringify(input.measurements) : null,
      input.note ?? null,
      now,
      now,
    );
    return requestOut(db, db.get<RequestRow>('SELECT * FROM tailor_requests WHERE id = ?', r.lastId)!);
  });
  const g = GARMENTS.find((x) => x.typeKey === out.garmentKey);
  notifier.send(
    [
      `<b>🪡 Tikuv so‘rovi ${out.number}</b>`,
      `${escapeHtml(out.customerName)}, ${displayPhone(out.customerPhone)}`,
      `${escapeHtml(g?.name.uz ?? out.garmentKey)} — ${escapeHtml(out.tailor.atelierName)}`,
      `Mato: ${escapeHtml(out.fabricLabel)}`,
      `${adminUrl}/#/tailoring/${out.id}`,
    ].join('\n'),
  );
  return publicRequest(out);
}

export const requestsForUser = (db: Db, userId: number) =>
  db.all<RequestRow>('SELECT * FROM tailor_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId).map((r) => publicRequest(requestOut(db, r)));

export function listTailorRequests(db: Db, q: { status?: TailorRequestStatus; q?: string; userId?: number; page: number; pageSize: number }) {
  const w: string[] = [];
  const p: (string | number)[] = [];
  if (q.status) {
    w.push('r.status = ?');
    p.push(q.status);
  }
  if (q.userId) {
    w.push('r.user_id = ?');
    p.push(q.userId);
  }
  const text = (q.q ?? '').trim();
  if (text) {
    const like = `%${text.replace(/[%_]/g, '')}%`;
    const digits = text.replace(/\D/g, '');
    const parts = ['r.number LIKE ?', 'r.customer_name LIKE ?', 't.atelier_name LIKE ?'];
    p.push(like, like, like);
    if (digits.length >= 3) {
      parts.push('r.customer_phone LIKE ?');
      p.push(`%${digits}%`);
    }
    w.push(`(${parts.join(' OR ')})`);
  }
  const sql = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const from = 'FROM tailor_requests r LEFT JOIN tailors t ON t.id = r.tailor_id';
  const total = Number(db.get<{ n: number }>(`SELECT COUNT(*) AS n ${from} ${sql}`, ...p)!.n);
  const rows = db.all<RequestRow>(`SELECT r.* ${from} ${sql} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`, ...p, q.pageSize, (q.page - 1) * q.pageSize);
  return { items: rows.map((r) => requestOut(db, r)), total, page: q.page, pageSize: q.pageSize };
}

export function getTailorRequest(db: Db, id: number) {
  const r = db.get<RequestRow>('SELECT * FROM tailor_requests WHERE id = ?', id);
  if (!r) throw notFound('So‘rov topilmadi');
  return requestOut(db, r);
}

export function updateTailorRequest(db: Db, id: number, patch: { status?: TailorRequestStatus; adminNote?: string | null }) {
  const r = db.get<RequestRow>('SELECT * FROM tailor_requests WHERE id = ?', id);
  if (!r) throw notFound('So‘rov topilmadi');
  const now = nowIso();
  if (patch.status && TAILOR_REQUEST_STATUSES.includes(patch.status)) db.run('UPDATE tailor_requests SET status = ?, updated_at = ? WHERE id = ?', patch.status, now, id);
  if (patch.adminNote !== undefined) db.run('UPDATE tailor_requests SET admin_note = ?, updated_at = ? WHERE id = ?', patch.adminNote, now, id);
  return getTailorRequest(db, id);
}
