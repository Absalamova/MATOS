import type {
  AdminCustomer,
  AdminFabric,
  AdminFabricInput,
  AdminOrderDTO,
  AdminStats,
  AdminTailor,
  AdminTailorRequestDTO,
  AdminUser,
  ApiErrorBody,
  BodyMeasurements,
  OrderDTO,
  OrderKind,
  OrderStatus,
  Paged,
  StoreSettings,
  TailorRequestStatus,
  TailorStatus,
} from '../../shared/types';

export const API_URL = String(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://api.matos.uz' : 'http://localhost:8080')).replace(/\/$/, '');
export const STORE_URL = String(import.meta.env.VITE_STORE_URL || (import.meta.env.PROD ? 'https://matos.uz/' : 'http://localhost:5173/')).replace(/\/?$/, '/');

const TOKEN_KEY = 'matos_admin_token';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message || 'Xatolik');
    this.status = status;
    this.code = body.code || 'error';
    this.fields = body.fields;
  }
}

let token: string | null = (() => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();
let expired: (() => void) | null = null;

export const hasToken = () => !!token;
export const onExpired = (fn: () => void) => {
  expired = fn;
};

/** "Remember me" keeps the session in localStorage; otherwise it ends with the browser tab. */
export function setToken(next: string | null, remember = false) {
  token = next;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    if (next) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, next);
  } catch {
    /* private mode — session lives in memory */
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  raw?: Blob;
  signal?: AbortSignal;
}

async function request(path: string, { method = 'GET', body, raw, signal }: Opts = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (raw) headers['Content-Type'] = raw.type || 'application/octet-stream';
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, { code: 'network', message: `Server bilan aloqa yo‘q (${API_URL}). API ishga tushganini tekshiring.` });
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: ApiErrorBody } | null;
    const e = new ApiError(res.status, data?.error ?? { code: `http_${res.status}`, message: `Server xatosi (${res.status})` });
    if (res.status === 401 && path !== '/api/admin/auth/login') expired?.();
    throw e;
  }
  return res;
}

async function json<T>(path: string, opts?: Opts): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface ListQuery {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const api = {
  login: (email: string, password: string) => json<{ token: string; admin: AdminUser }>('/api/admin/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => json<void>('/api/admin/auth/logout', { method: 'POST' }),
  me: () => json<{ admin: AdminUser }>('/api/admin/me').then((r) => r.admin),
  changePassword: (currentPassword: string, newPassword: string) => json<void>('/api/admin/me/password', { method: 'POST', body: { currentPassword, newPassword } }),

  stats: (signal?: AbortSignal) => json<AdminStats>('/api/admin/stats', { signal }),

  orders: (kind: OrderKind, q: ListQuery, signal?: AbortSignal) => json<Paged<OrderDTO>>(`/api/admin/orders${qs({ kind, ...q })}`, { signal }),
  order: (id: number) => json<{ order: AdminOrderDTO }>(`/api/admin/orders/${id}`).then((r) => r.order),
  updateOrder: (id: number, patch: { status?: OrderStatus; adminNote?: string | null; note?: string }) =>
    json<{ order: AdminOrderDTO }>(`/api/admin/orders/${id}`, { method: 'PATCH', body: patch }).then((r) => r.order),
  exportOrders: async (kind: OrderKind, q: ListQuery) => {
    const res = await request(`/api/admin/orders/export${qs({ kind, status: q.status, q: q.q })}`);
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'matos.csv';
    return { blob: await res.blob(), name };
  },

  tailorRequests: (q: ListQuery, signal?: AbortSignal) => json<Paged<AdminTailorRequestDTO>>(`/api/admin/tailor-requests${qs({ ...q })}`, { signal }),
  tailorRequest: (id: number) => json<{ request: AdminTailorRequestDTO }>(`/api/admin/tailor-requests/${id}`).then((r) => r.request),
  updateTailorRequest: (id: number, patch: { status?: TailorRequestStatus; adminNote?: string | null }) =>
    json<{ request: AdminTailorRequestDTO }>(`/api/admin/tailor-requests/${id}`, { method: 'PATCH', body: patch }).then((r) => r.request),

  tailors: (status?: TailorStatus) => json<{ tailors: AdminTailor[] }>(`/api/admin/tailors${qs({ status })}`).then((r) => r.tailors),
  saveTailor: (id: string | null, body: unknown) =>
    json<{ tailor: AdminTailor }>(id ? `/api/admin/tailors/${encodeURIComponent(id)}` : '/api/admin/tailors', { method: id ? 'PUT' : 'POST', body }).then((r) => r.tailor),
  setTailorStatus: (id: string, status: TailorStatus) =>
    json<{ tailor: AdminTailor }>(`/api/admin/tailors/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }).then((r) => r.tailor),
  deleteTailor: (id: string) => json<{ deleted: boolean; hidden: boolean }>(`/api/admin/tailors/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  fabrics: () => json<{ fabrics: AdminFabric[] }>('/api/admin/fabrics').then((r) => r.fabrics),
  fabric: (id: string) => json<{ fabric: AdminFabric }>(`/api/admin/fabrics/${encodeURIComponent(id)}`).then((r) => r.fabric),
  saveFabric: (id: string | null, body: AdminFabricInput) =>
    json<{ fabric: AdminFabric }>(id ? `/api/admin/fabrics/${encodeURIComponent(id)}` : '/api/admin/fabrics', { method: id ? 'PUT' : 'POST', body }).then((r) => r.fabric),
  archiveFabric: (id: string) => json<void>(`/api/admin/fabrics/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  upload: (file: Blob) => json<{ url: string }>('/api/admin/uploads', { method: 'POST', raw: file }).then((r) => r.url),

  customers: (q: ListQuery, signal?: AbortSignal) => json<Paged<AdminCustomer>>(`/api/admin/customers${qs({ ...q })}`, { signal }),
  customer: (id: number) =>
    json<{ customer: AdminCustomer; measurements: BodyMeasurements | null; orders: OrderDTO[]; tailorRequests: AdminTailorRequestDTO[] }>(`/api/admin/customers/${id}`),
  setCustomerStatus: (id: number, status: 'active' | 'blocked') =>
    json<{ customer: AdminCustomer }>(`/api/admin/customers/${id}`, { method: 'PATCH', body: { status } }).then((r) => r.customer),

  settings: () => json<{ settings: StoreSettings }>('/api/admin/settings').then((r) => r.settings),
  saveSettings: (s: StoreSettings) => json<{ settings: StoreSettings }>('/api/admin/settings', { method: 'PUT', body: s }).then((r) => r.settings),

  staff: () => json<{ staff: AdminUser[] }>('/api/admin/staff').then((r) => r.staff),
  addStaff: (body: { email: string; name: string; password: string; role: 'owner' | 'manager' }) =>
    json<{ admin: AdminUser }>('/api/admin/staff', { method: 'POST', body }).then((r) => r.admin),
  removeStaff: (id: number) => json<void>(`/api/admin/staff/${id}`, { method: 'DELETE' }),
};

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Kutilmagan xato. Sahifani yangilab ko‘ring.');

/** Seed photos are relative to the store site; uploads are absolute API URLs. */
export const photoUrl = (p: string | undefined) => (!p ? '' : /^(https?:|data:|blob:)/.test(p) ? p : STORE_URL + p.replace(/^\//, ''));
