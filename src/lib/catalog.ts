import { useEffect, useState } from 'react';
import { FABRICS } from '../data/fabrics';
import { Fabric } from '../types';
import { KEYS, load } from './storage';

interface Override {
  priceUZS?: number;
  stock?: number;
  active?: boolean;
}

/** Applies the seller/admin panel edits (price, stock, visibility) to the catalog. */
export function applyOverrides(): Fabric[] {
  const ov = load<Record<string, Override>>(KEYS.fabricOverrides, {});
  return FABRICS.filter((f) => ov[f.id]?.active !== false).map((f) => {
    const o = ov[f.id];
    if (!o?.priceUZS || o.priceUZS === f.priceUZS) return f;
    const k = o.priceUZS / f.priceUZS;
    return {
      ...f,
      priceUZS: o.priceUZS,
      priceUSD: Math.round(f.priceUSD * k * 100) / 100,
      priceEUR: Math.round(f.priceEUR * k * 100) / 100,
    };
  });
}

export function stockOf(id: string) {
  const ov = load<Record<string, Override>>(KEYS.fabricOverrides, {});
  return ov[id]?.stock;
}

export function useCatalog() {
  const [fabrics, setFabrics] = useState<Fabric[]>(applyOverrides);
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (!e.key || e.key === KEYS.fabricOverrides) setFabrics(applyOverrides());
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  return fabrics;
}
