import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Shirt, Users, Scissors, Package, Box, LogOut, Search, Trash2, Pencil, Check, X,
  Plus, TrendingUp, Wallet, ShoppingBag, ArrowLeft, Lock, Menu, Download, ChevronLeft, ChevronRight,
  AlertTriangle, ArrowUpDown, Phone, MapPin,
} from 'lucide-react';
import { FABRICS } from '../data/fabrics';
import { SEED_ORDERS, SEED_SWATCHES } from '../data/seed';
import { asset, formatDate } from '../lib/format';
import type { User } from '../types';

/* ═════════ Types ═════════ */
type Tab = 'dashboard' | 'orders' | 'fabrics' | 'swatches' | 'tailors' | 'users';
type OrderStatus = 'new' | 'processing' | 'shipped' | 'done' | 'cancelled';
type SwatchStatus = 'pending' | 'packed' | 'delivered';

interface Order { id: string; customer: string; phone: string; kind: 'mato' | 'tikuv'; item: string; amountUZS: number; status: OrderStatus; date: string; note?: string }
interface SwatchRequest { id: string; customer: string; city: string; fabrics: string[]; status: SwatchStatus; date: string }
interface FabricOverride { priceUZS?: number; stock?: number; active?: boolean }
interface CustomFabric { id: string; name: string; category: string; gsm: number; priceUZS: number; stock: number; active: boolean; hex: string }
interface FabricRow { id: string; name: string; category: string; gsm: number; priceUZS: number; stock: number; active: boolean; hex: string; thumb?: string; colors: number; custom: boolean }
interface AdminTailor { id: string; name: string; atelierName: string; city: string; phone: string; rating: number; completedOrders: number; priceStartingUZS: number; [k: string]: unknown }

type Notify = (msg: string, undo?: () => void) => void;
type Ask = (o: { title: string; text: string; confirmLabel: string; onConfirm: () => void }) => void;

/* ═════════ Storage & helpers ═════════ */
const K = {
  auth: 'matos_admin_auth', orders: 'matos_orders', swatches: 'matos_swatch_requests', fabrics: 'matos_admin_fabrics',
  custom: 'matos_admin_custom_fabrics', tailors: 'matos_tailors', users: 'matos_users',
};
const ADMIN_PASSWORD = 'matos-admin'; // Demo. Productionda server autentifikatsiyasi bilan almashtiring.
const COMMISSION = { mato: 0.07, tikuv: 0.09 };
const LOW_STOCK = 20;
const PAGE_SIZE = 8;

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }
function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => load(key, initial));
  const set = useCallback((n: T) => { setV(n); save(key, n); }, [key]);
  return [v, set];
}
const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' so‘m';
const dstr = (iso: string) => formatDate(iso, 'uz');
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}



const ORDER_LABEL: Record<OrderStatus, string> = { new: 'Yangi', processing: 'Jarayonda', shipped: 'Yo‘lda', done: 'Yakunlangan', cancelled: 'Bekor qilingan' };
const ORDER_COLOR: Record<OrderStatus, string> = {
  new: 'bg-[#FBF3D6] text-[#6B5200]', processing: 'bg-[#E8EEF8] text-[#2F4E80]', shipped: 'bg-[#F0EAF8] text-[#5D3F8C]',
  done: 'bg-[#E4F2E8] text-[#256B3D]', cancelled: 'bg-[#F4E8E8] text-[#8C3030]',
};
const FLOW: OrderStatus[] = ['new', 'processing', 'shipped', 'done'];
const SW_LABEL: Record<SwatchStatus, string> = { pending: 'Kutilmoqda', packed: 'Qadoqlandi', delivered: 'Yetkazildi' };
const SW_COLOR: Record<SwatchStatus, string> = { pending: 'bg-[#FBF3D6] text-[#6B5200]', packed: 'bg-[#E8EEF8] text-[#2F4E80]', delivered: 'bg-[#E4F2E8] text-[#256B3D]' };

/* ═════════ UI primitives ═════════ */
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191B20]';
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-[#E4E2DD] rounded-xl ${className}`}>{children}</div>
);
const Badge = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>
);
const Th = ({ children, onSort, active }: { children?: React.ReactNode; onSort?: () => void; active?: boolean }) => (
  <th className="text-left text-xs font-semibold text-[#5B5E66] px-4 py-3 whitespace-nowrap bg-[#FAFAF8]">
    {onSort ? (
      <button onClick={onSort} className={`inline-flex items-center gap-1 cursor-pointer hover:text-[#191B20] ${active ? 'text-[#191B20]' : ''} ${focusRing}`}>
        {children}<ArrowUpDown className="w-3 h-3" />
      </button>
    ) : children}
  </th>
);
const Td = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <td className={`px-4 py-3 text-sm text-[#191B20] align-middle ${className}`}>{children}</td>
);
const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse">{children}</table></div>
);
const Btn = ({ children, onClick, variant = 'ghost', type = 'button', disabled, className = '' }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) => {
  const v = variant === 'primary' ? 'bg-[#191B20] text-white hover:bg-[#2C2F36] border-transparent'
    : variant === 'danger' ? 'bg-[#8C3030] text-white hover:bg-[#6E2323] border-transparent'
    : 'bg-white text-[#191B20] border-[#DCDAD4] hover:bg-[#F1F0EC]';
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${v} ${focusRing} ${className}`}>
      {children}
    </button>
  );
};
const IconBtn = ({ onClick, label, danger, children }: { onClick: () => void; label: string; danger?: boolean; children: React.ReactNode }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label}
    className={`p-2 rounded-lg border border-[#E4E2DD] hover:bg-[#F1F0EC] transition cursor-pointer ${danger ? 'text-[#8C3030] hover:bg-[#F4E8E8]' : 'text-[#191B20]'} ${focusRing}`}>
    {children}
  </button>
);
const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative w-full sm:w-72">
    <Search className="w-4 h-4 text-[#8A8C92] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      className={`w-full pl-9 pr-9 py-2.5 rounded-lg border border-[#DCDAD4] bg-white text-sm outline-none focus:border-[#191B20] ${focusRing}`} />
    {value && <button onClick={() => onChange('')} aria-label="Tozalash" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8A8C92] hover:text-[#191B20] cursor-pointer"><X className="w-4 h-4" /></button>}
  </div>
);
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-[#5B5E66] mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-[#8A8C92] mt-1">{hint}</span>}
  </label>
);
const inputCls = `w-full px-3 py-2.5 rounded-lg border border-[#DCDAD4] bg-white text-sm outline-none focus:border-[#191B20] ${focusRing}`;
const Empty = ({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) => (
  <div className="py-14 px-6 text-center">
    <div className="font-semibold text-[#191B20]">{title}</div>
    {text && <p className="text-sm text-[#8A8C92] mt-1 max-w-sm mx-auto">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
const Pager = ({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) => (
  pages > 1 ? (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#EFEEEA] text-sm text-[#5B5E66]">
      <span>{total} ta natija · {page}/{pages}-sahifa</span>
      <div className="flex gap-2">
        <IconBtn label="Oldingi sahifa" onClick={() => page > 1 && onPage(page - 1)}><ChevronLeft className="w-4 h-4" /></IconBtn>
        <IconBtn label="Keyingi sahifa" onClick={() => page < pages && onPage(page + 1)}><ChevronRight className="w-4 h-4" /></IconBtn>
      </div>
    </div>
  ) : null
);
function usePaged<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const p = Math.min(page, pages);
  return { page: p, pages, setPage, slice: items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE) };
}

/* Modal / drawer: Esc yopadi, fokus ichkariga olinadi */
function Overlay({ title, onClose, side, children, footer }: { title: string; onClose: () => void; side?: boolean; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-[#121317]/45" aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`relative bg-white flex flex-col shadow-2xl ${side ? 'ml-auto h-full w-full max-w-md' : 'm-auto w-[calc(100%-2rem)] max-w-lg max-h-[90vh] rounded-2xl'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E2DD]">
          <h3 className="font-bold text-[#191B20]">{title}</h3>
          <IconBtn label="Yopish" onClick={onClose}><X className="w-4 h-4" /></IconBtn>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[#E4E2DD] flex justify-end gap-2 bg-[#FAFAF8]">{footer}</div>}
      </div>
    </div>
  );
}

/* ═════════ Login ═════════ */
function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (pw === ADMIN_PASSWORD) { save(K.auth, true); onOk(); } else setErr(true); };
  return (
    <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-[#E4E2DD] rounded-2xl p-8 shadow-lg">
        <div className="w-11 h-11 rounded-xl bg-[#191B20] text-white flex items-center justify-center font-display font-bold text-lg mb-5">M</div>
        <h1 className="text-xl font-bold text-[#191B20]">MATOS admin</h1>
        <p className="text-sm text-[#5B5E66] mt-1 mb-6">Davom etish uchun parolni kiriting.</p>
        <Field label="Parol">
          <div className="relative">
            <Lock className="w-4 h-4 text-[#8A8C92] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <input type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }} aria-invalid={err}
              className={`${inputCls} pl-9 ${err ? 'border-[#8C3030]' : ''}`} />
          </div>
        </Field>
        {err && <p role="alert" className="text-xs text-[#8C3030] mt-2">Parol noto‘g‘ri. Qaytadan kiriting.</p>}
        <Btn type="submit" variant="primary" className="w-full mt-5">Kirish</Btn>
        <a href="#/" className="block text-center text-sm text-[#5B5E66] mt-5 hover:text-[#191B20] hover:underline">Saytga qaytish</a>
        <p className="text-xs text-[#8A8C92] text-center mt-4">Demo parol: <code>{ADMIN_PASSWORD}</code></p>
      </form>
    </div>
  );
}

/* ═════════ Dashboard ═════════ */
function Dashboard({ orders, swatches, fabricRows, usersCount, tailorsCount, go }: {
  orders: Order[]; swatches: SwatchRequest[]; fabricRows: FabricRow[]; usersCount: number; tailorsCount: number; go: (t: Tab) => void;
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const valid = orders.filter((o) => o.status !== 'cancelled');
  const gmv = valid.reduce((s, o) => s + o.amountUZS, 0);
  const revenue = valid.reduce((s, o) => s + o.amountUZS * COMMISSION[o.kind], 0);
  const newOrders = orders.filter((o) => o.status === 'new').length;
  const pendingSw = swatches.filter((s) => s.status === 'pending').length;
  const lowStock = fabricRows.filter((f) => f.active && f.stock < LOW_STOCK);

  const todo = [
    newOrders > 0 && { text: `${newOrders} ta yangi buyurtma javob kutmoqda`, tab: 'orders' as Tab, cta: 'Ko‘rish' },
    pendingSw > 0 && { text: `${pendingSw} ta Swatch qutisini qadoqlash kerak`, tab: 'swatches' as Tab, cta: 'Ochish' },
    lowStock.length > 0 && { text: `${lowStock.length} ta matoning zaxirasi ${LOW_STOCK} m dan kam`, tab: 'fabrics' as Tab, cta: 'Tekshirish' },
  ].filter(Boolean) as { text: string; tab: Tab; cta: string }[];

  const buckets = useMemo(() => {
    const n = range;
    const arr = Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.now() - (n - 1 - i) * 86400000);
      return { key: d.toDateString(), label: n === 7 ? ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'][d.getDay()] : String(d.getDate()), total: 0 };
    });
    valid.forEach((o) => { const b = arr.find((x) => x.key === new Date(o.date).toDateString()); if (b) b.total += o.amountUZS; });
    return arr;
  }, [orders, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(...buckets.map((b) => b.total), 1);
  const periodTotal = buckets.reduce((s, b) => s + b.total, 0);

  const stats = [
    { label: 'Buyurtmalar', value: String(orders.length), sub: `${newOrders} ta yangi`, icon: ShoppingBag, tab: 'orders' as Tab },
    { label: 'Aylanma', value: fmt(gmv), sub: 'bekor qilinmaganlar', icon: Wallet, tab: 'orders' as Tab },
    { label: 'MATOS daromadi', value: fmt(revenue), sub: 'komissiya: mato 7%, tikuv 9%', icon: TrendingUp, tab: 'orders' as Tab },
    { label: 'Foydalanuvchilar', value: String(usersCount), sub: `${tailorsCount} ta hamkor atelye`, icon: Users, tab: 'users' as Tab },
  ];
  return (
    <div className="space-y-6">
      {todo.length > 0 && (
        <Card className="border-[#F1DE9A] bg-[#FBF3D6]">
          <div className="px-5 pt-4 pb-1 flex items-center gap-2 font-semibold text-[#191B20]"><AlertTriangle className="w-4 h-4 text-[#191B20]" />Bugun e’tibor kerak</div>
          <ul className="px-5 pb-3">
            {todo.map((t) => (
              <li key={t.text} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0 border-[#F1E5B8] text-sm">
                <span>{t.text}</span>
                <button onClick={() => go(t.tab)} className={`font-semibold text-[#191B20] underline underline-offset-4 cursor-pointer shrink-0 ${focusRing}`}>{t.cta}</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <button key={s.label} onClick={() => go(s.tab)} className={`text-left bg-white border border-[#E4E2DD] rounded-xl p-5 hover:border-[#191B20] transition cursor-pointer ${focusRing}`}>
            <div className="flex items-center justify-between text-sm text-[#5B5E66]">{s.label}<s.icon className="w-4 h-4 text-[#191B20]" aria-hidden /></div>
            <div className="text-2xl font-bold text-[#191B20] mt-2 break-words">{s.value}</div>
            <div className="text-xs text-[#8A8C92] mt-1">{s.sub}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div><h3 className="font-bold text-[#191B20]">Savdo dinamikasi</h3><p className="text-sm text-[#5B5E66]">Oxirgi {range} kunda {fmt(periodTotal)}</p></div>
            <div className="flex rounded-lg border border-[#DCDAD4] overflow-hidden text-sm" role="group" aria-label="Davr">
              {([7, 30] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} aria-pressed={range === r}
                  className={`px-3 py-1.5 cursor-pointer ${range === r ? 'bg-[#191B20] text-white' : 'bg-white hover:bg-[#F1F0EC]'} ${focusRing}`}>{r} kun</button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-1 sm:gap-1.5 h-48" role="img" aria-label={`Oxirgi ${range} kun savdosi grafigi`}>
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1.5 group relative">
                <div className="w-full rounded-t bg-[#191B20] group-hover:bg-[#C99C12] min-h-[2px]" style={{ height: `${(b.total / max) * 100}%` }} />
                {(range === 7 || i % 5 === 0) && <span className="text-[10px] text-[#8A8C92]">{b.label}</span>}
                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 bg-[#191B20] text-white text-[11px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 z-10">{fmt(b.total)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-bold text-[#191B20] mb-3">Smart Swatch</h3>
          {(['pending', 'packed', 'delivered'] as SwatchStatus[]).map((s) => (
            <div key={s} className="flex items-center justify-between py-2.5 border-b last:border-0 border-[#EFEEEA]">
              <Badge cls={SW_COLOR[s]}>{SW_LABEL[s]}</Badge><span className="font-bold">{swatches.filter((x) => x.status === s).length}</span>
            </div>
          ))}
          <button onClick={() => go('swatches')} className={`mt-3 text-sm font-semibold text-[#191B20] underline underline-offset-4 cursor-pointer ${focusRing}`}>Barcha so‘rovlar</button>
        </Card>
      </div>
    </div>
  );
}

/* ═════════ Orders ═════════ */
function OrdersTab({ orders, setOrders, notify }: { orders: Order[]; setOrders: (o: Order[]) => void; notify: Notify }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState<'all' | OrderStatus>('all');
  const [sort, setSort] = useState<{ key: 'date' | 'amountUZS'; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const open = orders.find((o) => o.id === openId) || null;

  const rows = useMemo(() => orders
    .filter((o) => (f === 'all' || o.status === f) && (o.id + o.customer + o.item + o.phone).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort.key === 'date' ? new Date(a.date).getTime() - new Date(b.date).getTime() : a.amountUZS - b.amountUZS) * sort.dir),
  [orders, q, f, sort]);
  const paged = usePaged(rows, q + f + sort.key + sort.dir);
  const toggleSort = (key: 'date' | 'amountUZS') => setSort((s) => (s.key === key ? { key, dir: (-s.dir) as 1 | -1 } : { key, dir: -1 }));

  const setStatus = (o: Order, status: OrderStatus) => {
    if (o.status === status) return;
    const prev = o.status;
    setOrders(orders.map((x) => (x.id === o.id ? { ...x, status } : x)));
    notify(`${o.id}: ${ORDER_LABEL[status]}`, () => setOrders(orders.map((x) => (x.id === o.id ? { ...x, status: prev } : x))));
  };
  const exportCSV = () => downloadCSV('matos-buyurtmalar.csv', [
    ['ID', 'Mijoz', 'Telefon', 'Turi', 'Mahsulot', 'Summa (so‘m)', 'Sana', 'Holat'],
    ...rows.map((o) => [o.id, o.customer, o.phone, o.kind, o.item, o.amountUZS, dstr(o.date), ORDER_LABEL[o.status]]),
  ]);
  const count = (s: 'all' | OrderStatus) => (s === 'all' ? orders.length : orders.filter((o) => o.status === s).length);

  return (
    <Card>
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Holat bo‘yicha filtr">
          {(['all', 'new', 'processing', 'shipped', 'done', 'cancelled'] as const).map((s) => (
            <button key={s} onClick={() => setF(s)} aria-pressed={f === s}
              className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer ${f === s ? 'bg-[#191B20] text-white border-[#191B20]' : 'bg-white border-[#DCDAD4] hover:bg-[#F1F0EC]'} ${focusRing}`}>
              {s === 'all' ? 'Barchasi' : ORDER_LABEL[s]} <span className={f === s ? 'text-white/70' : 'text-[#8A8C92]'}>{count(s)}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={q} onChange={setQ} placeholder="ID, mijoz yoki telefon" />
          <Btn onClick={exportCSV}><Download className="w-4 h-4" />CSV</Btn>
        </div>
      </div>
      <Table>
        <thead><tr><Th>ID</Th><Th>Mijoz</Th><Th>Mahsulot</Th>
          <Th onSort={() => toggleSort('amountUZS')} active={sort.key === 'amountUZS'}>Summa</Th>
          <Th onSort={() => toggleSort('date')} active={sort.key === 'date'}>Sana</Th><Th>Holat</Th></tr></thead>
        <tbody>
          {paged.slice.map((o) => (
            <tr key={o.id} tabIndex={0} onClick={() => setOpenId(o.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(o.id); }}
              className={`border-t border-[#EFEEEA] hover:bg-[#FAFAF8] cursor-pointer ${focusRing}`}>
              <Td className="font-mono text-xs">{o.id}</Td>
              <Td><div className="font-semibold">{o.customer}</div><div className="text-xs text-[#8A8C92]">{o.kind === 'mato' ? 'Mato' : 'Tikuv'}</div></Td>
              <Td className="max-w-[260px]"><span className="line-clamp-2">{o.item}</span></Td>
              <Td className="whitespace-nowrap">{fmt(o.amountUZS)}</Td>
              <Td className="whitespace-nowrap text-[#5B5E66]">{dstr(o.date)}</Td>
              <Td><Badge cls={ORDER_COLOR[o.status]}>{ORDER_LABEL[o.status]}</Badge></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty title="Buyurtma topilmadi" text="Qidiruv yoki filtrni o‘zgartirib ko‘ring." action={<Btn onClick={() => { setQ(''); setF('all'); }}>Filtrni tozalash</Btn>} />}
      <Pager page={paged.page} pages={paged.pages} total={rows.length} onPage={paged.setPage} />

      {open && (
        <Overlay side title={`Buyurtma ${open.id}`} onClose={() => setOpenId(null)}
          footer={open.status !== 'cancelled' && open.status !== 'done' ? (
            <>
              <Btn variant="ghost" onClick={() => setStatus(open, 'cancelled')}>Bekor qilish</Btn>
              <Btn variant="primary" onClick={() => setStatus(open, FLOW[FLOW.indexOf(open.status) + 1])}>
                <Check className="w-4 h-4" />{ORDER_LABEL[FLOW[FLOW.indexOf(open.status) + 1]]} deb belgilash
              </Btn>
            </>
          ) : open.status === 'cancelled' ? <Btn onClick={() => setStatus(open, 'new')}>Qayta ochish</Btn> : undefined}>
          <ol className="flex items-center gap-1 mb-6" aria-label="Buyurtma bosqichlari">
            {FLOW.map((s, i) => {
              const cur = FLOW.indexOf(open.status);
              const done = open.status !== 'cancelled' && i <= cur;
              return (
                <li key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full ${done ? 'bg-[#EDC233]' : 'bg-[#E4E2DD]'}`} />
                  <div className={`text-[11px] mt-1.5 ${done ? 'text-[#191B20] font-semibold' : 'text-[#8A8C92]'}`}>{ORDER_LABEL[s]}</div>
                </li>
              );
            })}
          </ol>
          {open.status === 'cancelled' && <p className="mb-4 text-sm text-[#8C3030] bg-[#F4E8E8] rounded-lg px-3 py-2">Bu buyurtma bekor qilingan.</p>}
          <dl className="space-y-4 text-sm">
            <div><dt className="text-xs text-[#5B5E66]">Mijoz</dt><dd className="font-semibold mt-0.5">{open.customer}</dd>
              <dd><a className="inline-flex items-center gap-1.5 text-[#191B20] underline underline-offset-4 mt-1" href={`tel:${open.phone.replace(/\s/g, '')}`}><Phone className="w-3.5 h-3.5" />{open.phone}</a></dd></div>
            <div><dt className="text-xs text-[#5B5E66]">Mahsulot</dt><dd className="mt-0.5">{open.item}</dd></div>
            <div className="grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-[#5B5E66]">Summa</dt><dd className="font-semibold mt-0.5">{fmt(open.amountUZS)}</dd></div>
              <div><dt className="text-xs text-[#5B5E66]">MATOS komissiyasi</dt><dd className="font-semibold mt-0.5">{fmt(open.amountUZS * COMMISSION[open.kind])}</dd></div>
              <div><dt className="text-xs text-[#5B5E66]">Sana</dt><dd className="mt-0.5">{dstr(open.date)}</dd></div>
              <div><dt className="text-xs text-[#5B5E66]">Turi</dt><dd className="mt-0.5">{open.kind === 'mato' ? 'Mato sotuvi' : 'Tikuv buyurtmasi'}</dd></div>
            </div>
            <div><dt className="text-xs text-[#5B5E66]">Izoh</dt><dd className="mt-0.5 text-[#5B5E66]">{open.note || 'Izoh qoldirilmagan.'}</dd></div>
          </dl>
        </Overlay>
      )}
    </Card>
  );
}

/* ═════════ Fabrics ═════════ */
type FabricDraft = { id?: string; name: string; category: string; gsm: string; price: string; stock: string; hex: string; active: boolean; custom: boolean };
function FabricsTab({ rows, ov, setOv, custom, setCustom, notify, ask }: {
  rows: FabricRow[]; ov: Record<string, FabricOverride>; setOv: (v: Record<string, FabricOverride>) => void;
  custom: CustomFabric[]; setCustom: (v: CustomFabric[]) => void; notify: Notify; ask: Ask;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'off'>('all');
  const [draft, setDraft] = useState<FabricDraft | null>(null);
  const list = rows.filter((f) => (f.name + f.category).toLowerCase().includes(q.toLowerCase())
    && (filter === 'all' || (filter === 'low' ? f.active && f.stock < LOW_STOCK : !f.active)));
  const paged = usePaged(list, q + filter);
  const lowCount = rows.filter((f) => f.active && f.stock < LOW_STOCK).length;

  const toggleActive = (f: FabricRow) => {
    const next = !f.active;
    if (f.custom) setCustom(custom.map((c) => (c.id === f.id ? { ...c, active: next } : c)));
    else setOv({ ...ov, [f.id]: { ...ov[f.id], active: next } });
    notify(`${f.name} ${next ? 'faollashtirildi' : 'o‘chirib qo‘yildi'}`, () => {
      if (f.custom) setCustom(custom);
      else setOv(ov);
    });
  };
  const openEdit = (f: FabricRow) => setDraft({ id: f.id, name: f.name, category: f.category, gsm: String(f.gsm), price: String(f.priceUZS), stock: String(f.stock), hex: f.hex, active: f.active, custom: f.custom });
  const openNew = () => setDraft({ name: '', category: '', gsm: '150', price: '', stock: '50', hex: '#B85D3B', active: true, custom: true });
  const valid = draft && draft.name.trim() && Number(draft.price) > 0 && Number(draft.stock) >= 0 && (!draft.custom || Number(draft.gsm) > 0);

  const submit = () => {
    if (!draft || !valid) return;
    const price = Math.round(Number(draft.price)); const stock = Math.round(Number(draft.stock));
    if (draft.custom) {
      const item: CustomFabric = { id: draft.id || `custom-${Date.now()}`, name: draft.name.trim(), category: draft.category.trim() || 'Boshqa', gsm: Number(draft.gsm), priceUZS: price, stock, active: draft.active, hex: draft.hex };
      setCustom(draft.id ? custom.map((c) => (c.id === item.id ? item : c)) : [item, ...custom]);
      notify(draft.id ? `${item.name} yangilandi` : `${item.name} katalogga qo‘shildi`);
    } else if (draft.id) {
      setOv({ ...ov, [draft.id]: { priceUZS: price, stock, active: draft.active } });
      notify(`${draft.name} yangilandi`);
    }
    setDraft(null);
  };
  const remove = (f: FabricRow) => ask({
    title: `"${f.name}" o‘chirilsinmi?`, text: 'Bu mato katalogdan olib tashlanadi.', confirmLabel: 'O‘chirish',
    onConfirm: () => { const prev = custom; setCustom(custom.filter((c) => c.id !== f.id)); notify(`${f.name} o‘chirildi`, () => setCustom(prev)); },
  });

  return (
    <Card>
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr">
          {([['all', `Barchasi ${rows.length}`], ['low', `Zaxira kam ${lowCount}`], ['off', 'O‘chirilgan']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer ${filter === k ? 'bg-[#191B20] text-white border-[#191B20]' : 'bg-white border-[#DCDAD4] hover:bg-[#F1F0EC]'} ${focusRing}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={q} onChange={setQ} placeholder="Mato nomi yoki turi" />
          <Btn variant="primary" onClick={openNew}><Plus className="w-4 h-4" />Mato qo‘shish</Btn>
        </div>
      </div>
      <Table>
        <thead><tr><Th>Mato</Th><Th>Turi</Th><Th>GSM</Th><Th>Narx, 1 m</Th><Th>Zaxira</Th><Th>Sotuvda</Th><Th /></tr></thead>
        <tbody>
          {paged.slice.map((f) => (
            <tr key={f.id} className={`border-t border-[#EFEEEA] ${f.active ? '' : 'opacity-60'}`}>
              <Td>
                <div className="flex items-center gap-3">
                  {f.thumb ? <img src={f.thumb} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover border border-[#E4E2DD]" />
                    : <div className="w-10 h-10 rounded-lg border border-[#E4E2DD]" style={{ background: f.hex }} aria-hidden />}
                  <div><div className="font-semibold">{f.name}</div><div className="text-xs text-[#8A8C92]">{f.custom ? 'Qo‘shilgan' : `${f.colors} rang`}</div></div>
                </div>
              </Td>
              <Td className="text-[#5B5E66]">{f.category}</Td><Td>{f.gsm}</Td><Td className="whitespace-nowrap">{fmt(f.priceUZS)}</Td>
              <Td>{f.stock < LOW_STOCK ? <Badge cls="bg-[#F4E8E8] text-[#8C3030]">{f.stock} m · kam</Badge> : `${f.stock} m`}</Td>
              <Td>
                <button role="switch" aria-checked={f.active} aria-label={`${f.name}: sotuvda`} onClick={() => toggleActive(f)}
                  className={`w-10 h-6 rounded-full relative transition cursor-pointer ${f.active ? 'bg-[#256B3D]' : 'bg-[#C8C9CD]'} ${focusRing}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${f.active ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </Td>
              <Td><div className="flex gap-2 justify-end">
                <IconBtn label="Tahrirlash" onClick={() => openEdit(f)}><Pencil className="w-4 h-4" /></IconBtn>
                {f.custom && <IconBtn label="O‘chirish" danger onClick={() => remove(f)}><Trash2 className="w-4 h-4" /></IconBtn>}
              </div></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {list.length === 0 && <Empty title="Mato topilmadi" text="Boshqa so‘z bilan qidiring yoki yangi mato qo‘shing." action={<Btn onClick={openNew}><Plus className="w-4 h-4" />Mato qo‘shish</Btn>} />}
      <Pager page={paged.page} pages={paged.pages} total={list.length} onPage={paged.setPage} />
      <p className="px-5 py-3 text-xs text-[#8A8C92] border-t border-[#EFEEEA]">O‘zgarishlar shu brauzerda saqlanadi va saytdagi katalogda darhol ko‘rinadi (narx, sotuvda/yashirin). Bir nechta qurilma uchun backend kerak bo‘ladi.</p>

      {draft && (
        <Overlay title={draft.id ? 'Matoni tahrirlash' : 'Yangi mato'} onClose={() => setDraft(null)}
          footer={<><Btn onClick={() => setDraft(null)}>Bekor qilish</Btn><Btn variant="primary" disabled={!valid} onClick={submit}>Saqlash</Btn></>}>
          <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="col-span-2"><Field label="Nomi">
              <input className={inputCls} value={draft.name} disabled={!draft.custom} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Masalan: Organic Linen — Sage" />
            </Field></div>
            {draft.custom && <>
              <Field label="Turi"><input className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Zig‘ir, ipak..." /></Field>
              <Field label="GSM"><input type="number" min={1} className={inputCls} value={draft.gsm} onChange={(e) => setDraft({ ...draft, gsm: e.target.value })} /></Field>
            </>}
            <Field label="Narx, 1 m (so‘m)"><input type="number" min={1} className={inputCls} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></Field>
            <Field label="Zaxira (m)" hint={`${LOW_STOCK} m dan kam bo‘lsa ogohlantiriladi`}><input type="number" min={0} className={inputCls} value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} /></Field>
            {draft.custom && <Field label="Rang"><input type="color" className="w-full h-[42px] rounded-lg border border-[#DCDAD4] bg-white p-1 cursor-pointer" value={draft.hex} onChange={(e) => setDraft({ ...draft, hex: e.target.value })} /></Field>}
            <label className="flex items-center gap-2 text-sm self-end pb-2.5 cursor-pointer">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="w-4 h-4 accent-[#191B20]" />Sotuvda
            </label>
            <button type="submit" className="hidden" />
          </form>
        </Overlay>
      )}
    </Card>
  );
}

/* ═════════ Swatches ═════════ */
function SwatchTab({ items, setItems, notify }: { items: SwatchRequest[]; setItems: (s: SwatchRequest[]) => void; notify: Notify }) {
  const [f, setF] = useState<'all' | SwatchStatus>('all');
  const list = items.filter((s) => f === 'all' || s.status === f);
  const change = (s: SwatchRequest, st: SwatchStatus) => {
    if (s.status === st) return;
    const prev = items;
    setItems(items.map((x) => (x.id === s.id ? { ...x, status: st } : x)));
    notify(`${s.id}: ${SW_LABEL[st]}`, () => setItems(prev));
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Holat bo‘yicha filtr">
        {(['all', 'pending', 'packed', 'delivered'] as const).map((s) => (
          <button key={s} onClick={() => setF(s)} aria-pressed={f === s}
            className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer ${f === s ? 'bg-[#191B20] text-white border-[#191B20]' : 'bg-white border-[#DCDAD4] hover:bg-[#F1F0EC]'} ${focusRing}`}>
            {s === 'all' ? 'Barchasi' : SW_LABEL[s]} <span className={f === s ? 'text-white/70' : 'text-[#8A8C92]'}>{s === 'all' ? items.length : items.filter((x) => x.status === s).length}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {list.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-[#191B20]">{s.customer}</div>
                <div className="text-sm text-[#5B5E66] flex items-center gap-1.5 mt-0.5"><MapPin className="w-3.5 h-3.5" aria-hidden />{s.city} · {dstr(s.date)}</div>
              </div>
              <Badge cls={SW_COLOR[s.status]}>{SW_LABEL[s.status]}</Badge>
            </div>
            <div className="text-xs text-[#8A8C92] mt-4 mb-2">{s.id} · {s.fabrics.length} ta namuna</div>
            <div className="flex flex-wrap gap-1.5">{s.fabrics.map((x) => <span key={x} className="px-2.5 py-1 rounded-md bg-[#F1F0EC] text-xs">{x}</span>)}</div>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Holatni o‘zgartirish">
              {(['pending', 'packed', 'delivered'] as SwatchStatus[]).map((st) => (
                <button key={st} onClick={() => change(s, st)} aria-pressed={s.status === st}
                  className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${s.status === st ? 'bg-[#191B20] text-white border-[#191B20]' : 'border-[#DCDAD4] hover:bg-[#F1F0EC]'} ${focusRing}`}>{SW_LABEL[st]}</button>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && <Card><Empty title="Bu holatda so‘rov yo‘q" /></Card>}
    </div>
  );
}

/* ═════════ Tailors ═════════ */
type TailorDraft = { id: string; name: string; atelierName: string; city: string; phone: string; price: string; rating: string };
function TailorsTab({ list, setList, notify, ask }: { list: AdminTailor[]; setList: (t: AdminTailor[]) => void; notify: Notify; ask: Ask }) {
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<TailorDraft | null>(null);
  const rows = list.filter((t) => (t.name + t.atelierName + t.city).toLowerCase().includes(q.toLowerCase()));
  const paged = usePaged(rows, q);
  const valid = draft && draft.name.trim() && draft.phone.trim() && Number(draft.price) > 0 && Number(draft.rating) >= 0 && Number(draft.rating) <= 5;
  const edit = (t: AdminTailor) => setDraft({ id: t.id, name: t.name, atelierName: t.atelierName, city: t.city, phone: t.phone, price: String(t.priceStartingUZS), rating: String(t.rating) });
  const submit = () => {
    if (!draft || !valid) return;
    setList(list.map((t) => (t.id === draft.id ? { ...t, name: draft.name.trim(), atelierName: draft.atelierName.trim(), city: draft.city.trim(), phone: draft.phone.trim(), priceStartingUZS: Number(draft.price), rating: Number(draft.rating) } : t)));
    notify(`${draft.name} yangilandi`); setDraft(null);
  };
  const remove = (t: AdminTailor) => ask({
    title: `"${t.name}" o‘chirilsinmi?`, text: 'Atelye saytdagi “Tikuvchilar” ro‘yxatidan ham yo‘qoladi.', confirmLabel: 'O‘chirish',
    onConfirm: () => { const prev = list; setList(list.filter((x) => x.id !== t.id)); notify(`${t.name} o‘chirildi`, () => setList(prev)); },
  });
  return (
    <Card>
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-[#5B5E66]">{list.length} ta hamkor atelye. Ma’lumot saytdagi “Tikuvchilar” bo‘limi bilan bir xil.</p>
        <SearchBox value={q} onChange={setQ} placeholder="Usta, atelye yoki shahar" />
      </div>
      <Table>
        <thead><tr><Th>Usta</Th><Th>Shahar</Th><Th>Telefon</Th><Th>Reyting</Th><Th>Buyurtmalar</Th><Th>Narx (dan)</Th><Th /></tr></thead>
        <tbody>
          {paged.slice.map((t) => (
            <tr key={t.id} className="border-t border-[#EFEEEA]">
              <Td><div className="font-semibold">{t.name}</div><div className="text-xs text-[#8A8C92]">{t.atelierName}</div></Td>
              <Td>{t.city}</Td>
              <Td className="whitespace-nowrap"><a className="hover:text-[#191B20] hover:underline" href={`tel:${String(t.phone).replace(/[^\d+]/g, '')}`}>{t.phone}</a></Td>
              <Td>★ {Number(t.rating).toFixed(1)}</Td><Td>{t.completedOrders}</Td><Td className="whitespace-nowrap">{fmt(t.priceStartingUZS)}</Td>
              <Td><div className="flex gap-2 justify-end">
                <IconBtn label="Tahrirlash" onClick={() => edit(t)}><Pencil className="w-4 h-4" /></IconBtn>
                <IconBtn label="O‘chirish" danger onClick={() => remove(t)}><Trash2 className="w-4 h-4" /></IconBtn>
              </div></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty title={list.length ? 'Atelye topilmadi' : 'Atelyelar hali yuklanmagan'} text={list.length ? 'Boshqa so‘z bilan qidirib ko‘ring.' : 'Saytdagi “Tikuvchilar” sahifasini bir marta oching, ro‘yxat shu yerda paydo bo‘ladi.'} />}
      <Pager page={paged.page} pages={paged.pages} total={rows.length} onPage={paged.setPage} />
      {draft && (
        <Overlay title="Atelyeni tahrirlash" onClose={() => setDraft(null)}
          footer={<><Btn onClick={() => setDraft(null)}>Bekor qilish</Btn><Btn variant="primary" disabled={!valid} onClick={submit}>Saqlash</Btn></>}>
          <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="col-span-2"><Field label="Usta ismi"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field></div>
            <div className="col-span-2"><Field label="Atelye nomi"><input className={inputCls} value={draft.atelierName} onChange={(e) => setDraft({ ...draft, atelierName: e.target.value })} /></Field></div>
            <Field label="Shahar"><input className={inputCls} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></Field>
            <Field label="Telefon"><input className={inputCls} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
            <Field label="Boshlang‘ich narx (so‘m)"><input type="number" min={1} className={inputCls} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></Field>
            <Field label="Reyting (0–5)"><input type="number" min={0} max={5} step={0.1} className={inputCls} value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: e.target.value })} /></Field>
            <button type="submit" className="hidden" />
          </form>
        </Overlay>
      )}
    </Card>
  );
}

/* ═════════ Users ═════════ */
function UsersTab({ users, setUsers, notify, ask }: { users: User[]; setUsers: (u: User[]) => void; notify: Notify; ask: Ask }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = users.find((u) => u.id === openId) || null;
  const rows = users.filter((u) => (u.name + u.identifier).toLowerCase().includes(q.toLowerCase()));
  const paged = usePaged(rows, q);
  const remove = (u: User) => ask({
    title: `"${u.name}" o‘chirilsinmi?`, text: 'Foydalanuvchi va uning saqlangan o‘lchamlari o‘chadi.', confirmLabel: 'O‘chirish',
    onConfirm: () => { const prev = users; setUsers(users.filter((x) => x.id !== u.id)); setOpenId(null); notify(`${u.name} o‘chirildi`, () => setUsers(prev)); },
  });
  const m = open?.measurements;
  return (
    <Card>
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-[#5B5E66]">{users.length} ta ro‘yxatdan o‘tgan foydalanuvchi.</p>
        <div className="flex gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="Ism yoki telefon" />
          <Btn onClick={() => downloadCSV('matos-foydalanuvchilar.csv', [['Ism', 'Aloqa', 'Bo‘y', 'Ko‘krak', 'Bel', 'Son', 'O‘lcham', 'Sana'], ...rows.map((u) => [u.name, u.identifier, u.measurements?.heightCm ?? '', u.measurements?.chestCm ?? '', u.measurements?.waistCm ?? '', u.measurements?.hipsCm ?? '', u.measurements?.sizeINT ?? '', dstr(u.registeredAt)])])}><Download className="w-4 h-4" />CSV</Btn>
        </div>
      </div>
      <Table>
        <thead><tr><Th>Ism</Th><Th>Aloqa</Th><Th>O‘lcham</Th><Th>Ro‘yxatdan o‘tgan</Th><Th /></tr></thead>
        <tbody>
          {paged.slice.map((u) => (
            <tr key={u.id} tabIndex={0} onClick={() => setOpenId(u.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(u.id); }}
              className={`border-t border-[#EFEEEA] hover:bg-[#FAFAF8] cursor-pointer ${focusRing}`}>
              <Td className="font-semibold">{u.name}</Td><Td>{u.identifier}</Td><Td>{u.measurements?.sizeINT || '—'}</Td>
              <Td className="text-[#5B5E66] whitespace-nowrap">{dstr(u.registeredAt)}</Td>
              <Td><div className="flex justify-end"><IconBtn label="O‘chirish" danger onClick={() => remove(u)}><Trash2 className="w-4 h-4" /></IconBtn></div></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty title="Foydalanuvchi topilmadi" text="Ism yoki telefon raqamini tekshirib qaytadan qidiring." />}
      <Pager page={paged.page} pages={paged.pages} total={rows.length} onPage={paged.setPage} />
      {open && (
        <Overlay side title={open.name} onClose={() => setOpenId(null)} footer={<Btn variant="ghost" onClick={() => remove(open)}><Trash2 className="w-4 h-4" />O‘chirish</Btn>}>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-xs text-[#5B5E66]">Aloqa</dt><dd className="mt-0.5">{open.identifier}</dd></div>
            <div><dt className="text-xs text-[#5B5E66]">Ro‘yxatdan o‘tgan</dt><dd className="mt-0.5">{dstr(open.registeredAt)}</dd></div>
            {m && (
              <div>
                <dt className="text-xs text-[#5B5E66] mb-2">Saqlangan o‘lchamlar</dt>
                <dd className="grid grid-cols-2 gap-2">
                  {([['Bo‘y', `${m.heightCm} sm`], ['Ko‘krak', `${m.chestCm} sm`], ['Bel', `${m.waistCm} sm`], ['Son', `${m.hipsCm} sm`], ['Xalqaro', m.sizeINT], ['Yevropa', m.sizeEU], ['AQSh', m.sizeUS], ['Britaniya', m.sizeUK]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-[#F6F5F2] px-3 py-2"><div className="text-[11px] text-[#8A8C92]">{k}</div><div className="font-semibold">{v}</div></div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </Overlay>
      )}
    </Card>
  );
}

/* ═════════ Shell ═════════ */
const NAV: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Umumiy ko‘rinish', icon: LayoutDashboard },
  { id: 'orders', label: 'Buyurtmalar', icon: Package },
  { id: 'fabrics', label: 'Matolar', icon: Shirt },
  { id: 'swatches', label: 'Smart Swatch', icon: Box },
  { id: 'tailors', label: 'Atelyelar', icon: Scissors },
  { id: 'users', label: 'Foydalanuvchilar', icon: Users },
];
const tabFromHash = (): Tab => {
  const t = window.location.hash.replace(/^#\/admin\/?/, '').split(/[/?]/)[0] as Tab;
  return NAV.some((n) => n.id === t) ? t : 'dashboard';
};

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean>(() => load(K.auth, false));
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const [menu, setMenu] = useState(false);
  const [orders, setOrders] = usePersisted<Order[]>(K.orders, SEED_ORDERS);
  const [swatches, setSwatches] = usePersisted<SwatchRequest[]>(K.swatches, SEED_SWATCHES);
  const [users, setUsers] = usePersisted<User[]>(K.users, []);
  const [ov, setOv] = usePersisted<Record<string, FabricOverride>>(K.fabrics, {});
  const [custom, setCustom] = usePersisted<CustomFabric[]>(K.custom, []);
  const [tailors, setTailors] = usePersisted<AdminTailor[]>(K.tailors, []);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; id: number } | null>(null);
  const [dialog, setDialog] = useState<Parameters<Ask>[0] | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { document.title = 'MATOS admin'; }, []);
  useEffect(() => {
    const onHash = () => { if (window.location.hash.startsWith('#/admin')) setTabState(tabFromHash()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Tailors sahifadan keyin qayta yuklanishi mumkin
  useEffect(() => { setTailors(load<AdminTailor[]>(K.tailors, [])); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((t: Tab) => {
    window.location.hash = t === 'dashboard' ? '#/admin' : `#/admin/${t}`;
    setTabState(t); setMenu(false); mainRef.current?.scrollTo?.(0, 0); window.scrollTo(0, 0);
  }, []);
  const notify: Notify = useCallback((msg, undo) => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, undo, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 3500);
  }, []);
  const ask: Ask = useCallback((o) => setDialog(o), []);

  const fabricRows: FabricRow[] = useMemo(() => [
    ...custom.map((c) => ({ id: c.id, name: c.name, category: c.category, gsm: c.gsm, priceUZS: c.priceUZS, stock: c.stock, active: c.active, hex: c.hex, colors: 1, custom: true })),
    ...FABRICS.map((f) => {
      const o = ov[f.id] || {};
      return {
        id: f.id, name: f.name.uz, category: f.categoryLabel.uz, gsm: f.gsm, priceUZS: o.priceUZS ?? f.priceUZS, stock: o.stock ?? 100,
        active: o.active ?? true, hex: f.colors[0]?.hex || '#ccc', thumb: f.colors[0]?.photos?.swatch ? asset(f.colors[0].photos.swatch) : undefined, colors: f.colors.length, custom: false,
      };
    }),
  ], [ov, custom]);

  if (!authed) return <Login onOk={() => setAuthed(true)} />;
  const current = NAV.find((n) => n.id === tab)!;
  const newCount = orders.filter((o) => o.status === 'new').length;
  const badge = (id: Tab) => id === 'orders' ? newCount : id === 'swatches' ? swatches.filter((s) => s.status === 'pending').length : 0;

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#191B20] flex">
      <a href="#admin-main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:px-3 focus:py-2 focus:rounded">Asosiy qismga o‘tish</a>
      {menu && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMenu(false)} aria-hidden />}
      <aside className={`fixed lg:sticky top-0 h-screen w-64 shrink-0 bg-[#191B20] text-[#E4E2DD] z-40 flex flex-col transition-transform ${menu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-6 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-[#EDC233] flex items-center justify-center font-display text-[20px] leading-none text-[#191B20]">m</div>
          <div className="font-bold tracking-wide">MATOS <span className="font-normal text-[#8A8C92]">admin</span></div>
        </div>
        <nav className="flex-1 p-3 space-y-1" aria-label="Asosiy menyu">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} aria-current={tab === n.id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${tab === n.id ? 'bg-white/12 text-white' : 'text-[#C8C9CD] hover:bg-white/6'} ${focusRing}`}>
              <n.icon className="w-4 h-4" />{n.label}
              {badge(n.id) > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[#EDC233] text-[#191B20] text-[11px] font-bold flex items-center justify-center">{badge(n.id)}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <a href="#/" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#C8C9CD] hover:bg-white/6 ${focusRing}`}><ArrowLeft className="w-4 h-4" />Saytga qaytish</a>
          <button onClick={() => { save(K.auth, false); setAuthed(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#C8C9CD] hover:bg-white/6 cursor-pointer ${focusRing}`}><LogOut className="w-4 h-4" />Chiqish</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-[#F6F5F2]/90 backdrop-blur border-b border-[#E4E2DD] px-4 sm:px-8 py-3.5 flex items-center gap-3">
          <button className={`lg:hidden p-2 rounded-lg border border-[#DCDAD4] bg-white cursor-pointer ${focusRing}`} onClick={() => setMenu(true)} aria-label="Menyuni ochish"><Menu className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold">{current.label}</h1>
          <Btn className="ml-auto !py-2 !text-xs" onClick={() => ask({
            title: 'Demo ma’lumotni tiklash', text: 'Buyurtmalar va Swatch so‘rovlari boshlang‘ich holatga qaytadi. Mato va atelye o‘zgarishlari saqlanib qoladi.', confirmLabel: 'Tiklash',
            onConfirm: () => { setOrders(SEED_ORDERS); setSwatches(SEED_SWATCHES); notify('Demo ma’lumot tiklandi'); },
          })}>Demo ma’lumotni tiklash</Btn>
        </header>
        <main ref={mainRef} id="admin-main" tabIndex={-1} className="p-4 sm:p-8 outline-none">
          {tab === 'dashboard' && <Dashboard orders={orders} swatches={swatches} fabricRows={fabricRows} usersCount={users.length} tailorsCount={tailors.length} go={go} />}
          {tab === 'orders' && <OrdersTab orders={orders} setOrders={setOrders} notify={notify} />}
          {tab === 'fabrics' && <FabricsTab rows={fabricRows} ov={ov} setOv={setOv} custom={custom} setCustom={setCustom} notify={notify} ask={ask} />}
          {tab === 'swatches' && <SwatchTab items={swatches} setItems={setSwatches} notify={notify} />}
          {tab === 'tailors' && <TailorsTab list={tailors} setList={setTailors} notify={notify} ask={ask} />}
          {tab === 'users' && <UsersTab users={users} setUsers={setUsers} notify={notify} ask={ask} />}
        </main>
      </div>

      {dialog && (
        <Overlay title={dialog.title} onClose={() => setDialog(null)}
          footer={<><Btn onClick={() => setDialog(null)}>Bekor qilish</Btn><Btn variant={/o‘chir/i.test(dialog.confirmLabel) ? 'danger' : 'primary'} onClick={() => { dialog.onConfirm(); setDialog(null); }}>{dialog.confirmLabel}</Btn></>}>
          <p className="text-sm text-[#5B5E66]">{dialog.text}</p>
        </Overlay>
      )}
      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toast && (
          <div key={toast.id} className="pointer-events-auto bg-[#191B20] text-white rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 text-sm">
            <span className="flex-1">{toast.msg}</span>
            {toast.undo && <button onClick={() => { toast.undo?.(); setToast(null); }} className={`font-semibold text-[#EDC233] hover:underline cursor-pointer ${focusRing}`}>Bekor qilish</button>}
            <button onClick={() => setToast(null)} aria-label="Yopish" className="text-white/60 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
