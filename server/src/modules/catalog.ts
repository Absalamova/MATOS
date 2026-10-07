import type { Db } from '../db.ts';
import { json, nowIso } from '../db.ts';
import type {
  AdminColor,
  AdminFabric,
  AdminFabricInput,
  ColorOption,
  Fabric,
  FabricCategory,
  FabricPhotos,
  GarmentTypeKey,
  Localized,
  StoreSettings,
  WeavePattern,
} from '../../../shared/types.ts';
import { CATEGORY_LABELS, inchesFor, ozPerSqYdFor, weightCategoryFor } from '../../../shared/catalog.ts';
import { GARMENTS } from '../../../shared/garments.ts';
import { round2 } from '../../../shared/pricing.ts';
import { v } from '../lib/validate.ts';
import { notFound } from '../lib/errors.ts';
import { randomHex } from '../lib/crypto.ts';
import { bumpCatalog } from './revision.ts';

interface FabricRow {
  id: string;
  status: string;
  sort: number;
  category: FabricCategory;
  pattern: WeavePattern;
  organic: number;
  gsm: number;
  width_cm: number;
  price_uzs: number;
  drape_factor: number;
  shrinkage_rate: number;
  seller_name: string;
  info: string;
  created_at: string;
  updated_at: string;
}

interface ColorRow {
  id: string;
  fabric_id: string;
  sort: number;
  name: string;
  hex: string;
  roughness: number;
  metalness: number;
  sheen: number | null;
  photos: string | null;
  stock_m: number;
  active: number;
}

/** Descriptive fields kept as one JSON column — they are only ever read together. */
interface FabricInfo {
  name: Localized;
  origin: Localized;
  sellerCity: Localized;
  composition: Localized;
  drapeText: Localized;
  care: Localized;
  description: Localized;
  certifications: string[];
  bestFor: GarmentTypeKey[];
}

const EMPTY_L: Localized = { uz: '', ru: '', en: '' };
const PHOTO_KEYS: (keyof FabricPhotos)[] = ['swatch', 'hang', 'roll', 'ruler', 'tile'];
const UPLOAD_RE = /(?:^|\/)uploads\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;

/** Stored form: '/uploads/<file>' for our uploads, otherwise the path as given (seed photos live on the store site). */
export function normalizePhotoPath(p: string) {
  const s = (p ?? '').trim();
  if (!s) return '';
  const m = UPLOAD_RE.exec(s);
  return m ? `/uploads/${m[1]}` : s;
}

function photosOut(raw: string | null, publicUrl: string): FabricPhotos | undefined {
  const p = json<Partial<FabricPhotos> | null>(raw, null);
  if (!p) return undefined;
  const out = {} as FabricPhotos;
  let any = false;
  for (const k of PHOTO_KEYS) {
    const val = p[k] ?? '';
    out[k] = val.startsWith('/uploads/') ? `${publicUrl}${val}` : val;
    if (val) any = true;
  }
  return any ? out : undefined;
}

/** Empty translations fall back to Uzbek so the store never shows a blank label. */
const fill = (l: Localized | undefined): Localized => {
  const x = l ?? EMPTY_L;
  return { uz: x.uz ?? '', ru: x.ru || x.uz || '', en: x.en || x.uz || '' };
};

function readInfo(row: FabricRow): FabricInfo {
  const i = json<Partial<FabricInfo>>(row.info, {});
  return {
    name: fill(i.name),
    origin: fill(i.origin),
    sellerCity: fill(i.sellerCity),
    composition: fill(i.composition),
    drapeText: fill(i.drapeText),
    care: fill(i.care),
    description: fill(i.description),
    certifications: Array.isArray(i.certifications) ? i.certifications : [],
    bestFor: Array.isArray(i.bestFor) ? i.bestFor : [],
  };
}

function colorOut(c: ColorRow, publicUrl: string): ColorOption {
  const out: ColorOption = {
    id: c.id,
    name: fill(json<Localized>(c.name, EMPTY_L)),
    hex: c.hex,
    roughness: c.roughness,
    metalness: c.metalness,
    stockM: round2(c.stock_m),
  };
  if (c.sheen !== null && c.sheen !== undefined) out.sheen = c.sheen;
  const photos = photosOut(c.photos, publicUrl);
  if (photos) out.photos = photos;
  return out;
}

function fabricOut(row: FabricRow, colors: ColorRow[], settings: StoreSettings, publicUrl: string): Fabric {
  const info = readInfo(row);
  return {
    id: row.id,
    name: info.name,
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] ?? fill({ uz: row.category, ru: '', en: '' }),
    organic: !!row.organic,
    pattern: row.pattern,
    origin: info.origin,
    seller: { name: row.seller_name, city: info.sellerCity },
    weightCategory: weightCategoryFor(row.gsm),
    gsm: row.gsm,
    ozPerSqYd: ozPerSqYdFor(row.gsm),
    widthCm: row.width_cm,
    widthInches: inchesFor(row.width_cm),
    composition: info.composition,
    priceUZS: row.price_uzs,
    priceUSD: round2(row.price_uzs / settings.rates.USD),
    priceEUR: round2(row.price_uzs / settings.rates.EUR),
    drapeFactor: row.drape_factor,
    drapeText: info.drapeText,
    certifications: info.certifications,
    shrinkageRate: row.shrinkage_rate,
    care: info.care,
    description: info.description,
    colors: colors.map((c) => colorOut(c, publicUrl)),
    bestFor: info.bestFor,
  };
}

function adminOut(row: FabricRow, colors: ColorRow[], publicUrl: string): AdminFabric {
  const info = readInfo(row);
  const raw = json<Partial<FabricInfo>>(row.info, {});
  const keep = (l: Localized | undefined) => ({ uz: l?.uz ?? '', ru: l?.ru ?? '', en: l?.en ?? '' });
  return {
    id: row.id,
    status: row.status === 'hidden' ? 'hidden' : 'active',
    sort: row.sort,
    name: keep(raw.name),
    category: row.category,
    organic: !!row.organic,
    pattern: row.pattern,
    origin: keep(raw.origin),
    seller: { name: row.seller_name, city: keep(raw.sellerCity) },
    gsm: row.gsm,
    widthCm: row.width_cm,
    composition: keep(raw.composition),
    priceUZS: row.price_uzs,
    drapeFactor: row.drape_factor,
    drapeText: keep(raw.drapeText),
    certifications: info.certifications,
    shrinkageRate: row.shrinkage_rate,
    care: keep(raw.care),
    description: keep(raw.description),
    bestFor: info.bestFor,
    colors: colors.map(
      (c): AdminColor => ({
        ...colorOut(c, publicUrl),
        name: keep(json<Localized>(c.name, EMPTY_L)),
        stockM: round2(c.stock_m),
        active: !!c.active,
      }),
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function colorsByFabric(db: Db, onlyActive: boolean) {
  const rows = db.all<ColorRow>(`SELECT * FROM fabric_colors ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY sort, rowid`);
  const map = new Map<string, ColorRow[]>();
  for (const c of rows) {
    const list = map.get(c.fabric_id) ?? [];
    list.push(c);
    map.set(c.fabric_id, list);
  }
  return map;
}

/** Fabrics on sale, with their visible colours. A fabric with no visible colour is left out. */
export function listPublicFabrics(db: Db, settings: StoreSettings, publicUrl: string): Fabric[] {
  const colors = colorsByFabric(db, true);
  return db
    .all<FabricRow>("SELECT * FROM fabrics WHERE status = 'active' ORDER BY sort, created_at")
    .filter((f) => (colors.get(f.id) ?? []).length > 0)
    .map((f) => fabricOut(f, colors.get(f.id)!, settings, publicUrl));
}

export function listAdminFabrics(db: Db, publicUrl: string): AdminFabric[] {
  const colors = colorsByFabric(db, false);
  return db.all<FabricRow>("SELECT * FROM fabrics WHERE status != 'archived' ORDER BY sort, created_at").map((f) => adminOut(f, colors.get(f.id) ?? [], publicUrl));
}

export function getAdminFabric(db: Db, id: string, publicUrl: string): AdminFabric {
  const row = db.get<FabricRow>("SELECT * FROM fabrics WHERE id = ? AND status != 'archived'", id);
  if (!row) throw notFound('Mato topilmadi');
  return adminOut(row, db.all<ColorRow>('SELECT * FROM fabric_colors WHERE fabric_id = ? ORDER BY sort, rowid', id), publicUrl);
}

/** Lowercase latin slug; Uzbek apostrophes dropped, Cyrillic transliterated. */
export function slugify(s: string) {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
  };
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ'`]/g, '')
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function uniqueId(db: Db, table: 'fabrics' | 'fabric_colors', base: string) {
  const root = base || `item-${randomHex(3)}`;
  let id = root;
  for (let n = 2; db.get(`SELECT 1 FROM ${table} WHERE id = ?`, id); n++) id = `${root}-${n}`;
  return id;
}

const localized = (max: number) => v.localized({ max });
const localizedOptional = (max: number) => v.localized({ max, required: false }).default({ uz: '', ru: '', en: '' });
const photoPath = v.string({ min: 0, max: 500 }).default('');

export const fabricInputSchema = v.object({
  name: localized(120),
  status: v.enum(['active', 'hidden'] as const).default('active'),
  sort: v.number({ min: -100000, max: 100000, int: true }).default(0),
  category: v.enum(['linen', 'silk', 'wool', 'cotton'] as const),
  organic: v.boolean().default(false),
  pattern: v.enum(['plain', 'gingham', 'canvas', 'ikat', 'crepe', 'jersey', 'twill'] as const),
  origin: localizedOptional(200),
  seller: v.object({ name: v.string({ max: 120 }), city: localizedOptional(80) }),
  gsm: v.number({ min: 20, max: 1000, int: true }),
  widthCm: v.number({ min: 30, max: 400, int: true }),
  composition: localized(200),
  priceUZS: v.number({ min: 0, max: 100_000_000, int: true }),
  drapeFactor: v.number({ min: 1, max: 10 }),
  drapeText: localizedOptional(160),
  certifications: v.array(v.string({ max: 60 }), { max: 12 }).default([]),
  shrinkageRate: v.number({ min: 0, max: 20 }).default(0),
  care: localizedOptional(400),
  description: localized(2000),
  bestFor: v.array(v.enum(GARMENTS.map((g) => g.typeKey)), { max: 11 }).default([]),
  colors: v.array(
    v.object({
      id: v.string({ max: 64, pattern: /^[a-z0-9][a-z0-9-]*$/, message: 'Faqat lotin harflari, raqam va -' }).optional(),
      name: localized(80),
      hex: v.hex(),
      roughness: v.number({ min: 0, max: 1 }).default(0.85),
      metalness: v.number({ min: 0, max: 1 }).default(0),
      sheen: v.number({ min: 0, max: 1 }).optional(),
      photos: v
        .object({ swatch: photoPath, hang: photoPath, roll: photoPath, ruler: photoPath, tile: photoPath })
        .optional(),
      stockM: v.number({ min: 0, max: 1_000_000 }),
      active: v.boolean().default(true),
    }),
    { min: 1, max: 60 },
  ),
});

/** Creates or replaces a fabric and its colours atomically. Colours removed in the form are deleted. */
export function saveFabric(db: Db, input: AdminFabricInput, existingId: string | undefined, publicUrl: string): AdminFabric {
  return db.tx(() => {
    const now = nowIso();
    let id = existingId;
    if (id) {
      if (!db.get("SELECT 1 FROM fabrics WHERE id = ? AND status != 'archived'", id)) throw notFound('Mato topilmadi');
    } else {
      id = uniqueId(db, 'fabrics', slugify(input.name.uz));
    }
    const info: FabricInfo = {
      name: input.name,
      origin: input.origin,
      sellerCity: input.seller.city,
      composition: input.composition,
      drapeText: input.drapeText,
      care: input.care,
      description: input.description,
      certifications: input.certifications.filter(Boolean),
      bestFor: [...new Set(input.bestFor)],
    };
    const args = [
      input.status,
      input.sort,
      input.category,
      input.pattern,
      input.organic,
      input.gsm,
      input.widthCm,
      input.priceUZS,
      input.drapeFactor,
      input.shrinkageRate,
      input.seller.name,
      JSON.stringify(info),
    ] as const;
    if (existingId) {
      db.run(
        `UPDATE fabrics SET status = ?, sort = ?, category = ?, pattern = ?, organic = ?, gsm = ?, width_cm = ?, price_uzs = ?,
         drape_factor = ?, shrinkage_rate = ?, seller_name = ?, info = ?, updated_at = ? WHERE id = ?`,
        ...args,
        now,
        id,
      );
    } else {
      db.run(
        `INSERT INTO fabrics (status, sort, category, pattern, organic, gsm, width_cm, price_uzs, drape_factor, shrinkage_rate, seller_name, info, created_at, updated_at, id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...args,
        now,
        now,
        id,
      );
    }

    const keep = new Set<string>();
    input.colors.forEach((c, i) => {
      const owned = c.id ? db.get<{ fabric_id: string }>('SELECT fabric_id FROM fabric_colors WHERE id = ?', c.id) : undefined;
      // An id that belongs to another fabric is treated as a new colour.
      const colorId = c.id && (!owned || owned.fabric_id === id) ? c.id : uniqueId(db, 'fabric_colors', `${id}-${slugify(c.name.uz) || 'rang'}`.slice(0, 60));
      keep.add(colorId);
      const photos = c.photos ? Object.fromEntries(PHOTO_KEYS.map((k) => [k, normalizePhotoPath(c.photos?.[k] ?? '')])) : null;
      const hasPhoto = photos && Object.values(photos).some(Boolean);
      db.run(
        `INSERT INTO fabric_colors (id, fabric_id, sort, name, hex, roughness, metalness, sheen, photos, stock_m, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET sort = excluded.sort, name = excluded.name, hex = excluded.hex, roughness = excluded.roughness,
           metalness = excluded.metalness, sheen = excluded.sheen, photos = excluded.photos, stock_m = excluded.stock_m, active = excluded.active`,
        colorId,
        id,
        i,
        JSON.stringify(c.name),
        c.hex.length === 4 ? `#${c.hex[1]}${c.hex[1]}${c.hex[2]}${c.hex[2]}${c.hex[3]}${c.hex[3]}`.toUpperCase() : c.hex.toUpperCase(),
        c.roughness,
        c.metalness,
        c.sheen ?? null,
        hasPhoto ? JSON.stringify(photos) : null,
        round2(c.stockM),
        c.active,
      );
    });
    for (const old of db.all<{ id: string }>('SELECT id FROM fabric_colors WHERE fabric_id = ?', id)) {
      if (!keep.has(old.id)) db.run('DELETE FROM fabric_colors WHERE id = ?', old.id);
    }
    bumpCatalog();
    return getAdminFabric(db, id, publicUrl);
  });
}

/** Archived fabrics disappear everywhere but stay in the database, so past orders keep their references. */
export function archiveFabric(db: Db, id: string) {
  const r = db.run("UPDATE fabrics SET status = 'archived', updated_at = ? WHERE id = ? AND status != 'archived'", nowIso(), id);
  if (!r.changes) throw notFound('Mato topilmadi');
  bumpCatalog();
}

/** First-run catalog import. */
export function seedFabrics(db: Db, fabrics: Fabric[]) {
  db.tx(() => {
    const now = nowIso();
    fabrics.forEach((f, i) => {
      const info: FabricInfo = {
        name: f.name,
        origin: f.origin,
        sellerCity: f.seller.city,
        composition: f.composition,
        drapeText: f.drapeText,
        care: f.care,
        description: f.description,
        certifications: f.certifications,
        bestFor: f.bestFor,
      };
      db.run(
        `INSERT INTO fabrics (id, status, sort, category, pattern, organic, gsm, width_cm, price_uzs, drape_factor, shrinkage_rate, seller_name, info, created_at, updated_at)
         VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        f.id,
        i * 10,
        f.category,
        f.pattern,
        f.organic,
        f.gsm,
        f.widthCm,
        f.priceUZS,
        f.drapeFactor,
        f.shrinkageRate,
        f.seller.name,
        JSON.stringify(info),
        now,
        now,
      );
      f.colors.forEach((c, j) => {
        db.run(
          `INSERT INTO fabric_colors (id, fabric_id, sort, name, hex, roughness, metalness, sheen, photos, stock_m, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          c.id,
          f.id,
          j,
          JSON.stringify(c.name),
          c.hex,
          c.roughness,
          c.metalness,
          c.sheen ?? null,
          c.photos ? JSON.stringify(c.photos) : null,
          120,
        );
      });
    });
    bumpCatalog();
  });
}
