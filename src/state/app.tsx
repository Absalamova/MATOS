import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BodyMeasurements, CartItem, Currency, Fabric, GarmentTypeKey, Language, SwatchItem, UnitSystem, User } from '../types';
import { useCatalog } from '../lib/catalog';
import { KEYS, load, remove, save } from '../lib/storage';
import { makeT, T } from '../lib/i18n';
import { DEFAULT_MEASUREMENTS } from '../lib/measure';
import { findColor } from '../data/fabrics';

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
  cart: CartItem[];
  addToCart: (fabricId: string, colorId: string, meters: number, garmentKey?: GarmentTypeKey) => void;
  setCartMeters: (id: string, meters: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  samples: SwatchItem[];
  hasSample: (fabricId: string, colorId: string) => boolean;
  toggleSample: (fabricId: string, colorId: string) => void;
  clearSamples: () => void;
  user: User | null;
  setUser: (u: User | null) => void;
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

const DEMO_USER: User = {
  id: 'user-default-1',
  name: 'Jamshid Davlatov',
  identifier: '+998 90 123 45 67',
  password: '123',
  registeredAt: new Date().toISOString(),
  measurements: { heightCm: 178, chestCm: 98, waistCm: 80, hipsCm: 100, sizeINT: 'M', sizeEU: 'EU 40', sizeUS: 'US 8', sizeUK: 'UK 12' },
};

function seedUsers() {
  const users = load<User[] | null>(KEYS.users, null);
  if (!users || !users.length) save(KEYS.users, [DEMO_USER]);
}

const fromUser = (u: User | null): BodyMeasurements | null =>
  u ? { heightCm: u.measurements.heightCm, bustCm: u.measurements.chestCm, waistCm: u.measurements.waistCm, hipsCm: u.measurements.hipsCm } : null;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p = load<Partial<Prefs>>(KEYS.prefs, {});
    return { lang: p.lang ?? 'uz', currency: p.currency ?? 'UZS', unit: p.unit ?? 'metric' };
  });
  const fabrics = useCatalog();
  const fabricById = useCallback((id: string) => fabrics.find((f) => f.id === id), [fabrics]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = load<CartItem[]>(KEYS.cart, []);
    // drop lines from the old catalog format
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.meters === 'number' && i.fabricId && i.colorId) : [];
  });
  const [samples, setSamples] = useState<SwatchItem[]>(() => load<SwatchItem[]>(KEYS.swatchBox, []));
  const [user, setUserState] = useState<User | null>(() => load<User | null>(KEYS.currentUser, null));
  const [measurements, setMeasurementsState] = useState<BodyMeasurements>(
    () => fromUser(load<User | null>(KEYS.currentUser, null)) ?? load<BodyMeasurements>(KEYS.measurements, DEFAULT_MEASUREMENTS),
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(seedUsers, []);
  useEffect(() => save(KEYS.prefs, prefs), [prefs]);
  useEffect(() => save(KEYS.cart, cart), [cart]);
  useEffect(() => save(KEYS.swatchBox, samples), [samples]);
  useEffect(() => {
    document.documentElement.lang = prefs.lang;
  }, [prefs.lang]);

  // Lines whose fabric was hidden by the seller disappear from the bag.
  useEffect(() => {
    setCart((c) => c.filter((i) => fabrics.some((f) => f.id === i.fabricId)));
    setSamples((s) => s.filter((i) => fabrics.some((f) => f.id === i.fabricId)));
  }, [fabrics]);

  const t = useMemo(() => makeT(prefs.lang), [prefs.lang]);

  const notify = useCallback((message: string, action?: Toast['action']) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5200 : 3200);
  }, []);

  const addToCart = useCallback(
    (fabricId: string, colorId: string, meters: number, garmentKey?: GarmentTypeKey) => {
      const m = Math.max(0.5, Math.round(meters * 10) / 10);
      setCart((c) => {
        const i = c.findIndex((x) => x.fabricId === fabricId && x.colorId === colorId);
        if (i >= 0) {
          const next = [...c];
          next[i] = { ...next[i], meters: Math.round((next[i].meters + m) * 10) / 10, garmentKey: garmentKey ?? next[i].garmentKey };
          return next;
        }
        return [...c, { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, fabricId, colorId, meters: m, garmentKey }];
      });
      const f = fabrics.find((x) => x.id === fabricId);
      const col = f ? findColor(f, colorId) : undefined;
      notify(
        f && col
          ? makeT(prefs.lang)({
              uz: `Savatga qo‘shildi: ${f.name.uz}, ${col.name.uz}`,
              ru: `Добавлено в корзину: ${f.name.ru}, ${col.name.ru}`,
              en: `Added to bag: ${f.name.en}, ${col.name.en}`,
            })
          : '',
        { label: makeT(prefs.lang)({ uz: 'Savatni ochish', ru: 'Открыть корзину', en: 'View bag' }), run: () => setOverlay('cart') },
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
        notify(tt({ uz: 'Namuna olib tashlandi', ru: 'Образец убран', en: 'Sample removed' }));
        return;
      }
      if (samples.length >= MAX_SAMPLES) {
        notify(
          tt({
            uz: `Bir buyurtmada ${MAX_SAMPLES} tagacha bepul namuna olish mumkin`,
            ru: `В одном заказе до ${MAX_SAMPLES} бесплатных образцов`,
            en: `Up to ${MAX_SAMPLES} free samples per order`,
          }),
          { label: tt({ uz: 'Savatni ochish', ru: 'Открыть корзину', en: 'View bag' }), run: () => setOverlay('cart') },
        );
        return;
      }
      setSamples([...samples, { fabricId, colorId }]);
      notify(
        tt({
          uz: `Bepul namuna qo‘shildi (${samples.length + 1}/${MAX_SAMPLES})`,
          ru: `Бесплатный образец добавлен (${samples.length + 1}/${MAX_SAMPLES})`,
          en: `Free sample added (${samples.length + 1}/${MAX_SAMPLES})`,
        }),
        { label: tt({ uz: 'Savatni ochish', ru: 'Открыть корзину', en: 'View bag' }), run: () => setOverlay('cart') },
      );
    },
    [samples, notify, prefs.lang],
  );

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) {
      save(KEYS.currentUser, u);
      const users = load<User[]>(KEYS.users, []);
      const i = users.findIndex((x) => x.id === u.id);
      if (i >= 0) users[i] = u;
      else users.push(u);
      save(KEYS.users, users);
      const m = fromUser(u);
      if (m) setMeasurementsState(m);
    } else {
      remove(KEYS.currentUser);
    }
  }, []);

  const setMeasurements = useCallback(
    (m: BodyMeasurements) => {
      setMeasurementsState(m);
      save(KEYS.measurements, m);
      if (user) {
        const next: User = { ...user, measurements: { ...user.measurements, heightCm: m.heightCm, chestCm: m.bustCm, waistCm: m.waistCm, hipsCm: m.hipsCm } };
        setUserState(next);
        save(KEYS.currentUser, next);
        const users = load<User[]>(KEYS.users, []);
        const i = users.findIndex((x) => x.id === next.id);
        if (i >= 0) {
          users[i] = next;
          save(KEYS.users, users);
        }
      }
    },
    [user],
  );

  const value: AppValue = {
    ...prefs,
    t,
    setLang: (lang) => setPrefs((p) => ({ ...p, lang })),
    setCurrency: (currency) => setPrefs((p) => ({ ...p, currency })),
    setUnit: (unit) => setPrefs((p) => ({ ...p, unit })),
    fabrics,
    fabricById,
    cart,
    addToCart,
    setCartMeters: (id, meters) => setCart((c) => c.map((x) => (x.id === id ? { ...x, meters: Math.max(0.5, Math.round(meters * 10) / 10) } : x))),
    removeFromCart: (id) => setCart((c) => c.filter((x) => x.id !== id)),
    clearCart: () => setCart([]),
    samples,
    hasSample: (f, c) => samples.some((s) => s.fabricId === f && s.colorId === c),
    toggleSample,
    clearSamples: () => setSamples([]),
    user,
    setUser,
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
