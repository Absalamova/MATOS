/** localStorage keys — shared with the admin panel (src/components/AdminPanel.tsx). */
export const KEYS = {
  users: 'matos_users',
  currentUser: 'matos_current_user',
  cart: 'matos_cart',
  swatchBox: 'matos_swatch_box',
  prefs: 'matos_prefs',
  orders: 'matos_orders',
  swatchRequests: 'matos_swatch_requests',
  tailors: 'matos_tailors',
  fabricOverrides: 'matos_admin_fabrics',
  measurements: 'matos_measurements',
} as const;

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
