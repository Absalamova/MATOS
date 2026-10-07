import type {
  ApiErrorBody,
  AuthResult,
  BodyMeasurements,
  CatalogResponse,
  CheckoutInput,
  CheckoutResult,
  MyHistory,
  Tailor,
  TailorApplication,
  TailorRequestDTO,
  TailorRequestInput,
  User,
} from '../types';
import { KEYS, load, remove, save } from './storage';
import { L, type T } from './i18n';


/** API base. Set VITE_API_URL to override (e.g. https://api.example.uz). */
export const API_URL = String(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://api.matos.uz' : 'http://localhost:8080')).replace(/\/$/, '');
/** Seller panel, linked from the footer. */
export const ADMIN_URL = String(import.meta.env.VITE_ADMIN_URL || (import.meta.env.PROD ? 'https://admin.matos.uz' : 'http://localhost:5174')).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  details?: Record<string, unknown>;
  constructor(status: number, body: Partial<ApiErrorBody> & { details?: Record<string, unknown> }) {
    super(body.message || 'Request failed');
    this.status = status;
    this.code = body.code || 'error';
    this.fields = body.fields;
    this.details = body.details;
  }
}

let token: string | null = load<string | null>(KEYS.token, null);
let onUnauthorized: (() => void) | null = null;

export const getToken = () => token;
export function setToken(next: string | null) {
  token = next;
  if (next) save(KEYS.token, next);
  else remove(KEYS.token);
}
/** Called when the server says the saved session is no longer valid. */
export const onSessionExpired = (fn: () => void) => {
  onUnauthorized = fn;
};

interface Opts {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function api<R>(path: string, { method = 'GET', body, headers = {}, signal, timeoutMs = 15000 }: Opts = {}): Promise<R> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  const h: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    const timeout = (err as DOMException)?.name === 'TimeoutError' || ctrl.signal.reason?.name === 'TimeoutError';
    throw new ApiError(0, { code: timeout ? 'timeout' : 'network', message: 'Server bilan aloqa yo‘q' });
  } finally {
    window.clearTimeout(timer);
  }
  if (res.status === 204) return undefined as R;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new ApiError(res.status, (data as { error?: ApiErrorBody } | null)?.error ?? { code: `http_${res.status}`, message: res.statusText });
    if (res.status === 401 && token && e.code !== 'invalid_credentials') onUnauthorized?.();
    throw e;
  }
  return data as R;
}

/** Shopper-facing text for an API failure, in the visitor’s language. */
export function errorText(err: unknown, t: T): string {
  if (!(err instanceof ApiError)) return t(L('Nimadir xato ketdi. Qaytadan urinib ko‘ring.', 'Что-то пошло не так. Попробуйте ещё раз.', 'Something went wrong. Please try again.'));
  switch (err.code) {
    case 'network':
      return t(L('Server bilan aloqa yo‘q. Internetni tekshirib, qaytadan urinib ko‘ring.', 'Нет связи с сервером. Проверьте интернет и попробуйте снова.', 'Can’t reach the server. Check your connection and try again.'));
    case 'timeout':
      return t(L('Server javob bermadi. Birozdan keyin qayta urinib ko‘ring.', 'Сервер не ответил. Попробуйте чуть позже.', 'The server didn’t respond. Try again shortly.'));
    case 'rate_limited':
      return t(L('Juda ko‘p urinish. Bir daqiqadan keyin qayta urinib ko‘ring.', 'Слишком много попыток. Повторите через минуту.', 'Too many attempts. Try again in a minute.'));
    case 'invalid_credentials':
      return t(L('Telefon raqami yoki parol noto‘g‘ri.', 'Неверный телефон или пароль.', 'Wrong phone number or password.'));
    case 'phone_taken':
      return t(L('Bu raqam bilan profil bor. Kirish bo‘limidan foydalaning.', 'Профиль с этим номером уже есть. Войдите.', 'An account with this number exists. Sign in instead.'));
    case 'blocked':
      return t(L('Profil vaqtincha bloklangan. Biz bilan bog‘laning.', 'Профиль временно заблокирован. Свяжитесь с нами.', 'This account is blocked. Please contact us.'));
    case 'out_of_stock': {
      const m = Number(err.details?.availableM ?? 0);
      return t(L(`Omborda faqat ${m} m qolgan. Metrajni kamaytiring.`, `На складе осталось только ${m} м. Уменьшите метраж.`, `Only ${m} m left in stock. Reduce the length.`));
    }
    case 'unavailable':
      return t(L('Savatdagi mato sotuvdan olingan. Savatni yangilang.', 'Ткань из корзины снята с продажи. Обновите корзину.', 'A fabric in your bag is no longer on sale. Update the bag.'));
    case 'tailor_unavailable':
      return t(L('Bu atelye hozir buyurtma qabul qilmayapti.', 'Это ателье сейчас не принимает заказы.', 'This atelier isn’t taking requests right now.'));
    case 'validation':
      return t(L('Maydonlarni tekshiring.', 'Проверьте поля формы.', 'Check the highlighted fields.'));
    default:
      return err.message;
  }
}

/* ───────────── Endpoints ───────────── */

export const fetchCatalog = (signal?: AbortSignal) => api<CatalogResponse>('/api/catalog', { signal, timeoutMs: 12000 });
export const fetchTailors = (signal?: AbortSignal) => api<{ tailors: Tailor[] }>('/api/tailors', { signal }).then((r) => r.tailors);

export const register = (input: { name: string; phone: string; password: string; measurements?: BodyMeasurements }) =>
  api<AuthResult>('/api/auth/register', { method: 'POST', body: input });
export const login = (phone: string, password: string) => api<AuthResult>('/api/auth/login', { method: 'POST', body: { phone, password } });
export const logout = () => api<void>('/api/auth/logout', { method: 'POST', timeoutMs: 5000 });
export const fetchMe = () => api<{ user: User }>('/api/me').then((r) => r.user);
export const updateMe = (patch: Partial<Pick<User, 'name' | 'email'>> & { measurements?: BodyMeasurements }) =>
  api<{ user: User }>('/api/me', { method: 'PATCH', body: patch }).then((r) => r.user);
export const fetchHistory = () => api<MyHistory>('/api/me/orders');

export const placeOrder = (input: CheckoutInput, idempotencyKey: string) =>
  api<CheckoutResult>('/api/orders', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey }, timeoutMs: 20000 });

export const requestTailor = (input: TailorRequestInput) =>
  api<{ request: TailorRequestDTO }>('/api/tailor-requests', { method: 'POST', body: input }).then((r) => r.request);
export const applyAsTailor = (input: TailorApplication) => api<{ id: string; status: 'pending' }>('/api/tailors/apply', { method: 'POST', body: input });

export const newIdempotencyKey = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
