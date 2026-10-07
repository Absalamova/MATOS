import { Currency, Fabric, Language, UnitSystem } from '../types';

/** Resolves a public/ asset against the deploy base, so the site works at / and at /REPO/. */
export function asset(path: string) {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`;
}

export const M_PER_YD = 0.9144;

export const toUnit = (meters: number, unit: UnitSystem) => (unit === 'metric' ? meters : meters / M_PER_YD);
export const fromUnit = (value: number, unit: UnitSystem) => (unit === 'metric' ? value : value * M_PER_YD);

const decimal = (lang: Language) => (lang === 'en' ? 'en-US' : 'ru-RU');

export function formatNumber(n: number, lang: Language, digits = 0) {
  return new Intl.NumberFormat(decimal(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** Price of one metre in the chosen currency (USD/EUR prices come from the server’s exchange rates). */
export const pricePerMeter = (f: Pick<Fabric, 'priceUZS' | 'priceUSD' | 'priceEUR'>, c: Currency) =>
  c === 'UZS' ? f.priceUZS : c === 'USD' ? f.priceUSD : f.priceEUR;

export const pricePerUnit = (f: Pick<Fabric, 'priceUZS' | 'priceUSD' | 'priceEUR'>, c: Currency, unit: UnitSystem) =>
  pricePerMeter(f, c) * (unit === 'metric' ? 1 : M_PER_YD);

export function formatMoney(value: number, currency: Currency, lang: Language) {
  if (currency === 'UZS') {
    const rounded = Math.round(value / 100) * 100;
    const n = formatNumber(rounded, lang);
    return lang === 'ru' ? `${n} сум` : lang === 'en' ? `${n} UZS` : `${n} so‘m`;
  }
  const n = formatNumber(value, lang, 2);
  return currency === 'USD' ? `$${n}` : `€${n}`;
}

export function unitLabel(unit: UnitSystem, lang: Language) {
  if (unit === 'imperial') return lang === 'ru' ? 'ярд' : 'yd';
  return lang === 'ru' ? 'м' : 'm';
}

export function formatLength(meters: number, unit: UnitSystem, lang: Language) {
  const v = toUnit(meters, unit);
  return `${formatNumber(v, lang, v % 1 === 0 ? 0 : 1)} ${unitLabel(unit, lang)}`;
}

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Browsers format uz-UZ dates as "2026 M10 7", so Uzbek dates are built by hand: "7-oktabr, 2026". */
export function formatDate(iso: string, lang: Language) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  if (lang === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export { displayPhone, formatPhoneInput as formatPhone, isValidPhone, normalizePhone, telHref } from '../../shared/phone';
