/**
 * Small schema validator (zod-style, no dependencies). Every schema parses unknown input into a typed
 * value or records a human-readable Uzbek message under the field path. `parse()` throws a 422 HttpError
 * with all field messages at once, so forms can highlight every problem in one round trip.
 */
import { invalid } from './errors.ts';
import { normalizePhone } from '../../../shared/phone.ts';

export type Issues = Record<string, string>;

export interface Schema<T> {
  run: (value: unknown, path: string, issues: Issues) => T;
  optional: () => Schema<T | undefined>;
  nullable: () => Schema<T | null>;
  default: (fallback: T) => Schema<T>;
}

/** Placeholder returned after an issue was recorded; never reaches callers because parse() throws. */
const BAD = undefined as never;

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function schema<T>(run: Schema<T>['run']): Schema<T> {
  return {
    run,
    optional: () => schema<T | undefined>((v, p, i) => (isEmpty(v) ? undefined : run(v, p, i))),
    nullable: () => schema<T | null>((v, p, i) => (isEmpty(v) ? null : run(v, p, i))),
    default: (fallback: T) => schema<T>((v, p, i) => (isEmpty(v) ? fallback : run(v, p, i))),
  };
}

function fail(issues: Issues, path: string, message: string) {
  if (!issues[path || '_']) issues[path || '_'] = message;
  return BAD;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = Schema<any>;

export const v = {
  string(opts: { min?: number; max?: number; pattern?: RegExp; message?: string; trim?: boolean; lower?: boolean } = {}) {
    const { min = 1, max = 500, pattern, message, trim = true, lower } = opts;
    return schema<string>((value, path, issues) => {
      if (value === undefined || value === null) return fail(issues, path, 'Majburiy maydon');
      if (typeof value !== 'string' && typeof value !== 'number') return fail(issues, path, 'Matn bo‘lishi kerak');
      let s = String(value);
      if (trim) s = s.trim();
      if (lower) s = s.toLowerCase();
      if (s.length < min) return fail(issues, path, min <= 1 ? 'Majburiy maydon' : `Kamida ${min} ta belgi`);
      if (s.length > max) return fail(issues, path, `Ko‘pi bilan ${max} ta belgi`);
      if (pattern && !pattern.test(s)) return fail(issues, path, message ?? 'Noto‘g‘ri qiymat');
      return s;
    });
  },

  number(opts: { min?: number; max?: number; int?: boolean } = {}) {
    const { min = -Infinity, max = Infinity, int } = opts;
    return schema<number>((value, path, issues) => {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value.replace(',', '.')) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) return fail(issues, path, 'Son bo‘lishi kerak');
      if (int && !Number.isInteger(n)) return fail(issues, path, 'Butun son bo‘lishi kerak');
      if (n < min) return fail(issues, path, `${min} dan kam bo‘lmasin`);
      if (n > max) return fail(issues, path, `${max} dan oshmasin`);
      return n;
    });
  },

  boolean() {
    return schema<boolean>((value, path, issues) => {
      if (typeof value === 'boolean') return value;
      if (value === 1 || value === '1' || value === 'true') return true;
      if (value === 0 || value === '0' || value === 'false') return false;
      return fail(issues, path, 'Ha yoki yo‘q bo‘lishi kerak');
    });
  },

  enum<const T extends string>(values: readonly T[], message = 'Ruxsat etilmagan qiymat') {
    return schema<T>((value, path, issues) => (typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : fail(issues, path, message)));
  },

  phone() {
    return schema<string>((value, path, issues) => {
      const p = typeof value === 'string' ? normalizePhone(value) : null;
      return p ?? fail(issues, path, 'Telefon raqamini +998 XX XXX XX XX ko‘rinishida kiriting');
    });
  },

  email() {
    return v.string({ max: 160, lower: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: 'Email manzili noto‘g‘ri' });
  },

  hex() {
    return v.string({ min: 4, max: 7, pattern: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, message: 'Rang #RRGGBB ko‘rinishida bo‘lsin' });
  },

  array<T>(item: Schema<T>, opts: { min?: number; max?: number } = {}) {
    const { min = 0, max = 200 } = opts;
    return schema<T[]>((value, path, issues) => {
      if (!Array.isArray(value)) return fail(issues, path, 'Ro‘yxat bo‘lishi kerak');
      if (value.length < min) return fail(issues, path, min === 1 ? 'Kamida bitta qiymat kerak' : `Kamida ${min} ta qiymat kerak`);
      if (value.length > max) return fail(issues, path, `Ko‘pi bilan ${max} ta qiymat`);
      return value.map((x, i) => item.run(x, `${path}[${i}]`, issues));
    });
  },

  object<S extends Record<string, AnySchema>>(shape: S) {
    return schema<{ [K in keyof S]: Infer<S[K]> }>((value, path, issues) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(issues, path, 'Obyekt bo‘lishi kerak');
      const src = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        const r = shape[key].run(src[key], path ? `${path}.${key}` : key, issues);
        if (r !== undefined) out[key] = r;
      }
      return out as { [K in keyof S]: Infer<S[K]> };
    });
  },

  localized(opts: { max?: number; required?: boolean } = {}) {
    const { max = 2000, required = true } = opts;
    return v.object({
      uz: required ? v.string({ max }) : v.string({ max }).default(''),
      ru: v.string({ max }).default(''),
      en: v.string({ max }).default(''),
    });
  },
};

/** Parses or throws 422 with every field message. */
export function parse<T>(s: Schema<T>, input: unknown): T {
  const issues: Issues = {};
  const out = s.run(input, '', issues);
  if (Object.keys(issues).length) throw invalid(issues);
  return out;
}
