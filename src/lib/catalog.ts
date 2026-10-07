import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogResponse, Fabric, StoreSettings, Tailor } from '../types';
import { SEED_FABRICS } from '../data/fabrics';
import { SEED_TAILORS } from '../data/tailors';
import { DEFAULT_SETTINGS } from '../../shared/pricing';
import { fetchCatalog, fetchTailors } from './api';
import { KEYS, load, save } from './storage';

export type RemoteStatus = 'loading' | 'live' | 'offline';

/**
 * Stale-while-revalidate data from the API: the last good response (or the bundled seed) renders at once,
 * then fresh data replaces it. Re-checked when the tab becomes visible and every few minutes while open.
 * `live` tells callers the data really came from the server (used before pruning the bag).
 */
function useRemote<T>(cacheKey: string, initial: () => T, fetcher: (s: AbortSignal) => Promise<T>, refreshMs = 5 * 60_000) {
  const [state, setState] = useState<{ data: T; status: RemoteStatus; live: boolean }>(() => ({ data: initial(), status: 'loading', live: false }));
  const last = useRef(0);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    last.current = Date.now();
    fetcher(ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        save(cacheKey, data);
        setState({ data, status: 'live', live: true });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState((s) => ({ ...s, status: s.live ? 'live' : 'offline' }));
      });
  }, [cacheKey, fetcher]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > 30_000) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => document.visibilityState === 'visible' && refresh(), refreshMs);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      inflight.current?.abort();
    };
  }, [refresh, refreshMs]);

  return { ...state, refresh };
}

const initialCatalog = (): CatalogResponse => {
  const cached = load<CatalogResponse | null>(KEYS.catalogCache, null);
  if (cached && Array.isArray(cached.fabrics) && cached.fabrics.length) {
    return { ...cached, settings: { ...DEFAULT_SETTINGS, ...cached.settings, rates: { ...DEFAULT_SETTINGS.rates, ...cached.settings?.rates } } };
  }
  return { fabrics: SEED_FABRICS, settings: DEFAULT_SETTINGS, updatedAt: '' };
};

export function useRemoteCatalog(): { fabrics: Fabric[]; settings: StoreSettings; status: RemoteStatus; live: boolean; refresh: () => void } {
  const r = useRemote<CatalogResponse>(KEYS.catalogCache, initialCatalog, fetchCatalog);
  return { fabrics: r.data.fabrics, settings: r.data.settings, status: r.status, live: r.live, refresh: r.refresh };
}

export function useRemoteTailors(): { tailors: Tailor[]; status: RemoteStatus; refresh: () => void } {
  const r = useRemote<Tailor[]>(
    KEYS.tailorsCache,
    () => {
      const cached = load<Tailor[] | null>(KEYS.tailorsCache, null);
      return Array.isArray(cached) && cached.length ? cached : SEED_TAILORS;
    },
    fetchTailors,
    10 * 60_000,
  );
  return { tailors: r.data, status: r.status, refresh: r.refresh };
}

/** Metres available for a colour; undefined means the stock is unknown (offline catalog). */
export const stockOf = (fabric: Fabric, colorId: string) => fabric.colors.find((c) => c.id === colorId)?.stockM;
