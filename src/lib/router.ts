import { useEffect, useState } from 'react';

export type RouteName = 'home' | 'catalog' | 'fabric' | 'studio' | 'tailors';

export interface Route {
  name: RouteName;
  id?: string;
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = new URLSearchParams(qs);
  switch (parts[0]) {
    case 'catalog':
      return { name: 'catalog', query };
    case 'fabric':
      return { name: 'fabric', id: parts[1], query };
    case 'studio':
      return { name: 'studio', query };
    case 'tailors':
      return { name: 'tailors', query };
    default:
      return { name: 'home', query };
  }
}

export function href(name: RouteName, opts: { id?: string; query?: Record<string, string | undefined> } = {}) {
  const path = name === 'home' ? '' : name === 'fabric' ? `fabric/${opts.id}` : name;
  const q = new URLSearchParams();
  Object.entries(opts.query || {}).forEach(([k, v]) => v && q.set(k, v));
  const qs = q.toString();
  return `#/${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(name: RouteName, opts: { id?: string; query?: Record<string, string | undefined>; replace?: boolean } = {}) {
  const next = href(name, opts);
  if (opts.replace) {
    history.replaceState(null, '', next);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
