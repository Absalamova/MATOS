import { log } from './log.ts';

/**
 * Outgoing SMS. One small interface so the gateway can be swapped (Eskiz today, Play Mobile or
 * another later) without touching the verification logic.
 *
 *   SMS_PROVIDER=eskiz  → real SMS through notify.eskiz.uz (ESKIZ_EMAIL / ESKIZ_PASSWORD)
 *   SMS_PROVIDER=dev    → nothing is sent; the code is written to the server log and returned to the
 *                         browser. Refused in production.
 *   unset               → dev outside production, disabled in production (sign-up answers 503).
 */
export interface SmsProvider {
  readonly name: 'eskiz' | 'dev' | 'none';
  /** True when the code may be shown to the client (local development and tests only). */
  readonly exposesCode: boolean;
  /** Resolves when the gateway accepted the message; throws SmsError otherwise. */
  send(phone: string, text: string): Promise<void>;
}

export class SmsError extends Error {}

export interface SmsConfig {
  provider: string;
  eskiz: { email: string; password: string; from: string; baseUrl: string };
}

const TIMEOUT_MS = 10_000;

async function post(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Eskiz.uz: bearer token from email + password (valid ~30 days), refreshed once on 401. */
export function eskizProvider(cfg: SmsConfig['eskiz']): SmsProvider {
  let token: string | null = null;
  let pending: Promise<string> | null = null;

  const login = async () => {
    const form = new FormData();
    form.set('email', cfg.email);
    form.set('password', cfg.password);
    const r = await post(`${cfg.baseUrl}/api/auth/login`, { method: 'POST', body: form });
    const body = (await r.json().catch(() => null)) as { data?: { token?: string } } | null;
    if (!r.ok || !body?.data?.token) throw new SmsError(`Eskiz login failed (${r.status})`);
    return body.data.token;
  };
  const getToken = async (fresh = false) => {
    if (fresh) token = null;
    if (token) return token;
    pending ??= login().finally(() => (pending = null));
    token = await pending;
    return token;
  };

  const sendOnce = async (phone: string, text: string, fresh: boolean) => {
    const form = new FormData();
    form.set('mobile_phone', phone);
    form.set('message', text);
    form.set('from', cfg.from);
    return post(`${cfg.baseUrl}/api/message/sms/send`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${await getToken(fresh)}` } });
  };

  return {
    name: 'eskiz',
    exposesCode: false,
    async send(phone, text) {
      try {
        let r = await sendOnce(phone, text, false);
        if (r.status === 401) r = await sendOnce(phone, text, true);
        if (!r.ok) {
          // The phone number is not logged; Eskiz's answer explains template / balance problems.
          log.warn('SMS yuborilmadi', { provider: 'eskiz', status: r.status, body: (await r.text()).slice(0, 300) });
          throw new SmsError(`Eskiz send failed (${r.status})`);
        }
      } catch (err) {
        if (err instanceof SmsError) throw err;
        log.warn('SMS shlyuzi bilan aloqa yo‘q', { provider: 'eskiz', err: String((err as Error)?.message ?? err) });
        throw new SmsError('Eskiz unreachable');
      }
    },
  };
}

export function devProvider(): SmsProvider {
  return {
    name: 'dev',
    exposesCode: true,
    async send(phone, text) {
      log.info(`[dev SMS] +${phone}: ${text}`);
    },
  };
}

const disabled: SmsProvider = {
  name: 'none',
  exposesCode: false,
  async send() {
    throw new SmsError('SMS provider is not configured');
  },
};

export function createSms(cfg: SmsConfig, env: 'production' | 'development' | 'test'): SmsProvider {
  const prod = env === 'production';
  const choice = (cfg.provider || (prod ? 'none' : 'dev')).toLowerCase();
  if (choice === 'eskiz') {
    if (cfg.eskiz.email && cfg.eskiz.password) return eskizProvider(cfg.eskiz);
    log.error('SMS_PROVIDER=eskiz, lekin ESKIZ_EMAIL yoki ESKIZ_PASSWORD berilmagan. Ro‘yxatdan o‘tish ishlamaydi.');
    return disabled;
  }
  if (choice === 'dev') {
    if (!prod) return devProvider();
    log.error('SMS_PROVIDER=dev productionda taqiqlangan (kod brauzerga chiqib qoladi). Ro‘yxatdan o‘tish ishlamaydi.');
    return disabled;
  }
  if (prod) log.warn('SMS xizmati sozlanmagan (SMS_PROVIDER). Yangi profil ochish uchun telefonni tasdiqlab bo‘lmaydi.');
  return disabled;
}
