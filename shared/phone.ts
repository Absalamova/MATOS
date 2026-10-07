/** Uzbek phone numbers: stored as 12 digits (998901234567), shown as +998 90 123 45 67. */

/** Returns 998XXXXXXXXX or null when the input is not a full Uzbek number. */
export function normalizePhone(raw: string): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 9) d = `998${d}`;
  if (d.length === 13 && d.startsWith('9980')) d = `998${d.slice(4)}`;
  return d.length === 12 && d.startsWith('998') ? d : null;
}

export const isValidPhone = (raw: string) => normalizePhone(raw) !== null;

/** Pretty form of a stored number; falls back to the input when it is not a full number. */
export function displayPhone(raw: string) {
  const d = normalizePhone(raw);
  if (!d) return raw;
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

/** Keeps the number readable while typing: +998 90 123 45 67 */
export function formatPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw.trim().startsWith('+') ? '+' : '';
  const withCode = raw.trim().startsWith('+') || digits.length > 9;
  let d = withCode && digits.startsWith('998') ? digits.slice(3) : digits;
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+998 ${parts.join(' ')}`.trimEnd();
}

/** tel: link target */
export const telHref = (raw: string) => `tel:+${normalizePhone(raw) ?? raw.replace(/[^\d]/g, '')}`;
