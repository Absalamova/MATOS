/** Browser storage for per-visitor conveniences only. Orders, accounts and the catalog live on the API server. */
export const KEYS = {
  token: 'matos_token',
  user: 'matos_user',
  cart: 'matos_cart',
  swatchBox: 'matos_swatch_box',
  prefs: 'matos_prefs',
  measurements: 'matos_measurements',
  catalogCache: 'matos_catalog_cache',
  tailorsCache: 'matos_tailors_cache',
} as const;

/** Keys from the old browser-only demo (it even kept passwords here). Removed on first load. */
const LEGACY = [
  'matos_users',
  'matos_current_user',
  'matos_orders',
  'matos_swatch_requests',
  'matos_tailors',
  'matos_admin_fabrics',
  'matos_admin_custom_fabrics',
  'matos_admin_auth',
];

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the app keeps working in memory */
  }
}

export function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearLegacy() {
  LEGACY.forEach(remove);
}
