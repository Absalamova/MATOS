import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BodyMeasurements, CartItem, Currency, Fabric, GarmentTypeKey, Language, StoreSettings, SwatchItem, Tailor, UnitSystem, User } from '../types';
import { useRemoteCatalog, useRemoteTailors, type RemoteStatus } from '../lib/catalog';
import { clearLegacy, KEYS, load, remove, save } from '../lib/storage';
import { L, makeT, type T } from '../lib/i18n';
import { clampMeasurements, DEFAULT_MEASUREMENTS } from '../lib/measure';
import { findColor } from '../data/fabrics';
import * as api from '../lib/api';

/** Upper bound for free samples per order; the live limit comes from the server settings. */
export const MAX_SAMPLES = 5;

interface Prefs {
  lang: Language;
  currency: Currency;
  unit: UnitSystem;
}

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

type Overlay = 'cart' | 'search' | 'auth' | 'profile' | 'menu' | null;

interface AppValue extends Prefs {
  t: T;
  setLang: (l: Language) => void;
  setCurrency: (c: Currency) => void;
  setUnit: (u: UnitSystem) => void;
  fabrics: Fabric[];
  fabricById: (id: string) => Fabric | undefined;
  settings: StoreSettings;
  catalogStatus: RemoteStatus;
  refreshCatalog: () => void;
  tailors: Tailor[];
  refreshTailors: () => void;
  cart: CartItem[];
  addToCart: (fabricId: string, colorId: string, meters: number, garmentKey?: GarmentTypeKey) => void;
  setCartMeters: (id: string, meters: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  samples: SwatchItem[];
  maxSamples: number;
  hasSample: (fabricId: string, colorId: string) => boolean;
  toggleSample: (fabricId: string, colorId: string) => void;
  clearSamples: () => void;
  user: User | null;
  /** Saves the session returned by login/register. */
  signIn: (r: { token: string; user: User }) => void;
  signOut: () => void;
  setUser: (u: User) => void;
  measurements: BodyMeasurements;
  setMeasurements: (m: BodyMeasurements) => void;
  toast: Toast | null;
  notify: (message: string, action?: Toast['action']) => void;
  overlay: Overlay;
  open: (o: Exclude<Overlay, null>) => void;
  close: () => void;
}

const Ctx = createContext<AppValue | null>(null);

export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
};

const roundM = (m: number) => Math.round(m * 10) / 10;
const sameMeasurements = (a: BodyMeasurements | null | undefined, b: BodyMeasurements | null | undefined) =>
  !!a && !!b && a.heightCm === b.heightCm && a.bustCm === b.bustCm && a.waistCm === b.waistCm && a.hipsCm === b.hipsCm;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p = load<Partial<Prefs>>(KEYS.prefs, {});
    return { lang: p.lang ?? 'uz', currency: p.currency ?? 'UZS', unit: p.unit ?? 'metric' };
  });
  const catalog = useRemoteCatalog();
  const { fabrics, settings } = catalog;
  const remoteTailors = useRemoteTailors();
  const fabricById = useCallback((id: string) => fabrics.find((f) => f.id === id), [fabrics]);
  const maxSamples = Math.min(MAX_SAMPLES, settings.maxSamples || MAX_SAMPLES);

  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = load<CartItem[]>(KEYS.cart, []);
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.meters === 'number' && i.fabricId && i.colorId) : [];
  });
  const [samples, setSamples] = useState<SwatchItem[]>(() => {
    const raw = load<SwatchItem[]>(KEYS.swatchBox, []);
    return Array.isArray(raw) ? raw.filter((s) => s && s.fabricId && s.colorId) : [];
  });
  const [user, setUserState] = useState<User | null>(() => (api.getToken() ? load<User | null>(KEYS.user, null) : null));
  const [measurements, setMeasurementsState] = useState<BodyMeasurements>(() => {
    const u = api.getToken() ? load<User | null>(KEYS.user, null) : null;
    return u?.measurements ?? load<BodyMeasurements>(KEYS.measurements, DEFAULT_MEASUREMENTS);
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const syncTimer = useRef<number | undefined>(undefined);

  const t = useMemo(() => makeT(prefs.lang), [prefs.lang]);

  const notify = useCallback((message: string, action?: Toast['action']) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5200 : 3200);
  }, []);

  useEffect(clearLegacy, []);
  useEffect(() => save(KEYS.prefs, prefs), [prefs]);
  useEffect(() => save(KEYS.cart, cart), [cart]);
  useEffect(() => save(KEYS.swatchBox, samples), [samples]);
  useEffect(() => {
    document.documentElement.lang = prefs.lang;
  }, [prefs.lang]);

  /* ── Session ── */

  const storeUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) save(KEYS.user, u);
    else remove(KEYS.user);
  }, []);

  const dropSession = useCallback(() => {
    api.setToken(null);
    storeUser(null);
  }, [storeUser]);

  useEffect(() => {
    api.onSessionExpired(() => {
      dropSession();
      notify(makeT(prefs.lang)(L('Sessiya tugadi. Qaytadan kiring.', 'Сессия истекла. Войдите снова.', 'Your session ended. Please sign in again.')));
    });
  }, [dropSession, notify, prefs.lang]);

  // Refresh the profile from the server once per visit.
  useEffect(() => {
    if (!api.getToken()) return;
    api
      .fetchMe()
      .then((u) => {
        storeUser(u);
        if (u.measurements) setMeasurementsState(u.measurements);
      })
      .catch(() => {
        /* offline: keep the cached profile; a 401 is handled by onSessionExpired */
      });
  }, [storeUser]);

  const signIn = useCallback(
    (r: { token: string; user: User }) => {
      api.setToken(r.token);
      storeUser(r.user);
      if (r.user.measurements) {
        setMeasurementsState(r.user.measurements);
        save(KEYS.measurements, r.user.measurements);
      } else {
        // First sign-in: keep what the visitor already set in the studio.
        api.updateMe({ measurements }).then(storeUser).catch(() => undefined);
      }
    },
    [measurements, storeUser],
  );

  const signOut = useCallback(() => {
    api.logout().catch(() => undefined);
    dropSession();
  }, [dropSession]);

  const setMeasurements = useCallback(
    (m: BodyMeasurements) => {
      const next = clampMeasurements(m);
      setMeasurementsState(next);
      save(KEYS.measurements, next);
      if (!user || sameMeasurements(user.measurements, next)) return;
      window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        api.updateMe({ measurements: next }).then(storeUser).catch(() => undefined);
      }, 800);
    },
    [user, storeUser],
  );

  /* ── Bag ── */

  // Once the live catalog is in, drop lines whose fabric or colour is no longer on sale.
  useEffect(() => {
    if (!catalog.live) return;
    const exists = (fid: string, cid: string) => fabrics.some((f) => f.id === fid && f.colors.some((c) => c.id === cid));
    setCart((c) => {
      const next = c.filter((i) => exists(i.fabricId, i.colorId));
      return next.length === c.length ? c : next;
    });
    setSamples((s) => {
      const next = s.filter((i) => exists(i.fabricId, i.colorId));
      return next.length === s.length ? s : next;
    });
  }, [fabrics, catalog.live]);

  const addToCart = useCallback(
    (fabricId: string, colorId: string, meters: number, garmentKey?: GarmentTypeKey) => {
      const m = Math.max(0.5, roundM(meters));
      setCart((c) => {
        const i = c.findIndex((x) => x.fabricId === fabricId && x.colorId === colorId);
        if (i >= 0) {
          const next = [...c];
          next[i] = { ...next[i], meters: Math.min(100, roundM(next[i].meters + m)), garmentKey: garmentKey ?? next[i].garmentKey };
          return next;
        }
        return [...c, { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, fabricId, colorId, meters: m, garmentKey }];
      });
      const f = fabrics.find((x) => x.id === fabricId);
      const col = f ? findColor(f, colorId) : undefined;
      const tt = makeT(prefs.lang);
      notify(
        f && col ? tt(L(`Savatga qo‘shildi: ${f.name.uz}, ${col.name.uz}`, `Добавлено в корзину: ${f.name.ru}, ${col.name.ru}`, `Added to bag: ${f.name.en}, ${col.name.en}`)) : tt(L('Savatga qo‘shildi', 'Добавлено в корзину', 'Added to bag')),
        { label: tt(L('Savatni ochish', 'Открыть корзину', 'View bag')), run: () => setOverlay('cart') },
      );
    },
    [fabrics, notify, prefs.lang],
  );

  const toggleSample = useCallback(
    (fabricId: string, colorId: string) => {
      const tt = makeT(prefs.lang);
      const exists = samples.some((s) => s.fabricId === fabricId && s.colorId === colorId);
      if (exists) {
        setSamples(samples.filter((s) => !(s.fabricId === fabricId && s.colorId === colorId)));
        notify(tt(L('Namuna olib tashlandi', 'Образец убран', 'Sample removed')));
        return;
      }
      if (samples.length >= maxSamples) {
        notify(
          tt(L(`Bir buyurtmada ${maxSamples} tagacha bepul namuna olish mumkin`, `В одном заказе до ${maxSamples} бесплатных образцов`, `Up to ${maxSamples} free samples per order`)),
          { label: tt(L('Savatni ochish', 'Открыть корзину', 'View bag')), run: () => setOverlay('cart') },
        );
        return;
      }
      setSamples([...samples, { fabricId, colorId }]);
      notify(
        tt(L(`Bepul namuna qo‘shildi (${samples.length + 1}/${maxSamples})`, `Бесплатный образец добавлен (${samples.length + 1}/${maxSamples})`, `Free sample added (${samples.length + 1}/${maxSamples})`)),
        { label: tt(L('Savatni ochish', 'Открыть корзину', 'View bag')), run: () => setOverlay('cart') },
      );
    },
    [samples, notify, prefs.lang, maxSamples],
  );

  const value: AppValue = {
    ...prefs,
    t,
    setLang: (lang) => setPrefs((p) => ({ ...p, lang })),
    setCurrency: (currency) => setPrefs((p) => ({ ...p, currency })),
    setUnit: (unit) => setPrefs((p) => ({ ...p, unit })),
    fabrics,
    fabricById,
    settings,
    catalogStatus: catalog.status,
    refreshCatalog: catalog.refresh,
    tailors: remoteTailors.tailors,
    refreshTailors: remoteTailors.refresh,
    cart,
    addToCart,
    setCartMeters: (id, meters) => setCart((c) => c.map((x) => (x.id === id ? { ...x, meters: Math.min(100, Math.max(0.5, roundM(meters))) } : x))),
    removeFromCart: (id) => setCart((c) => c.filter((x) => x.id !== id)),
    clearCart: () => setCart([]),
    samples,
    maxSamples,
    hasSample: (f, c) => samples.some((s) => s.fabricId === f && s.colorId === c),
    toggleSample,
    clearSamples: () => setSamples([]),
    user,
    signIn,
    signOut,
    setUser: storeUser,
    measurements,
    setMeasurements,
    toast,
    notify,
    overlay,
    open: (o) => setOverlay(o),
    close: () => setOverlay(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
