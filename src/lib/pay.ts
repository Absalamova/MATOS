import type { PayInfo } from '../types';
import { api } from './api';
import { KEYS, load, save } from './storage';

/** Pay tokens kept in this browser for 7 days, so a guest who closes the tab can come back to the payment page. */
const KEEP_MS = 7 * 86400_000;
type Saved = Record<string, { token: string; at: number }>;

export function rememberPayToken(number: string, token: string) {
  const now = Date.now();
  const all = load<Saved>(KEYS.payTokens, {});
  const kept: Saved = {};
  for (const [k, v] of Object.entries(all)) if (v && now - v.at < KEEP_MS) kept[k] = v;
  kept[number] = { token, at: now };
  save(KEYS.payTokens, kept);
}

export function savedPayToken(number: string) {
  const v = load<Saved>(KEYS.payTokens, {})[number];
  return v && Date.now() - v.at < KEEP_MS ? v.token : '';
}

/** Full link to the order's payment page; the token sits after `#`, so it is never sent to any server. */
export function payPageUrl(number: string, token: string) {
  const q = token ? `?t=${encodeURIComponent(token)}` : '';
  return `${window.location.origin}${window.location.pathname}#/pay/${encodeURIComponent(number)}${q}`;
}

export const lookupPay = (number: string, token: string, signal?: AbortSignal) =>
  api<{ pay: PayInfo }>('/api/pay/lookup', { method: 'POST', body: { number, token }, signal }).then((r) => r.pay);

export const claimPay = (number: string, token: string, payerCardLast4: string) =>
  api<{ pay: PayInfo }>('/api/pay/claim', { method: 'POST', body: { number, token, payerCardLast4 } }).then((r) => r.pay);

/** Names the wallet a pay link opens, for the button label. */
export function walletName(url: string) {
  try {
    const h = new URL(url).hostname;
    if (h.endsWith('payme.uz')) return 'Payme';
    if (h.endsWith('click.uz')) return 'Click';
    if (h.includes('uzum')) return 'Uzum';
  } catch {
    /* not a URL */
  }
  return '';
}
