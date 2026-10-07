import { useCallback, useEffect, useRef, useState } from 'react';

/* ───────────── Formatting (Uzbek) ───────────── */

const nf = new Intl.NumberFormat('ru-RU');
export const money = (n: number) => `${nf.format(Math.round(n))} so‘m`;
export const num = (n: number, digits = 0) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const pad = (n: number) => String(n).padStart(2, '0');

export function date(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}-${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/** Today 14:05 · Kecha 09:12 · 7-okt 18:40 */
export function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return `Bugun ${time}`;
  if (diff === 1) return `Kecha ${time}`;
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''} ${time}`;
}

export const dayLabel = (isoDay: string) => {
  const d = new Date(`${isoDay}T00:00:00`);
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}`;
};

/* ───────────── Hash router ───────────── */

export interface Route {
  parts: string[];
  query: URLSearchParams;
}

const parse = (): Route => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, q = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
};

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string, opts: { replace?: boolean; query?: Record<string, string | number | undefined> } = {}) {
  const q = new URLSearchParams();
  Object.entries(opts.query ?? {}).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, String(v)));
  const next = `#/${path.replace(/^\//, '')}${q.toString() ? `?${q}` : ''}`;
  if (opts.replace) {
    history.replaceState(null, '', next);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== next) window.location.hash = next;
}

/* ───────────── Data hooks ───────────── */

/** Loads data with abort-on-change; `reload` re-runs the loader, keeping the old data on screen meanwhile. */
export function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fn = useRef(loader);
  fn.current = loader;
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fn.current(ctrl.signal)
      .then((d) => {
        if (!ctrl.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, setData, error, loading, reload };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ───────────── Files ───────────── */

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/** Shrinks photos to at most `max` px on the long side before upload (JPEG 86%). */
export async function prepareImage(file: File, max = 1600): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Faqat JPG, PNG yoki WEBP rasm tanlang');
  if (file.size > 25 * 1024 * 1024) throw new Error('Rasm juda katta (25 MB dan oshmasin)');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Rasmni o‘qib bo‘lmadi');
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Rasmni tayyorlab bo‘lmadi'))), 'image/jpeg', 0.86));
}
