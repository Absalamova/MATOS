import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Box, ExternalLink, LayoutDashboard, LogOut, Menu, Package, Scissors, Settings, Shirt, Store, Users } from 'lucide-react';
import type { AdminStats } from '../../shared/types';
import { api, STORE_URL } from './api';
import { useAuth } from './auth';
import { useUi } from './ui';

/* ───────────── Live counters (polled) ───────────── */

const StatsCtx = createContext<{ stats: AdminStats | null; refresh: () => void } | null>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const prev = useRef<AdminStats['counts'] | null>(null);
  const { toast } = useUi();

  const refresh = useCallback(() => {
    api
      .stats()
      .then((s) => {
        const p = prev.current;
        if (p) {
          const fresh = s.counts.newOrders - p.newOrders + (s.counts.newSamples - p.newSamples) + (s.counts.newTailorRequests - p.newTailorRequests);
          if (fresh > 0) toast(fresh === 1 ? 'Yangi so‘rov keldi' : `${fresh} ta yangi so‘rov keldi`, 'info');
        }
        prev.current = s.counts;
        setStats(s);
      })
      .catch(() => undefined);
  }, [toast]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && refresh(), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const c = stats?.counts;
    const waiting = c ? c.newOrders + c.newSamples + c.newTailorRequests + c.pendingTailors : 0;
    document.title = `${waiting ? `(${waiting}) ` : ''}MATOS — sotuvchi paneli`;
  }, [stats]);

  return <StatsCtx.Provider value={{ stats, refresh }}>{children}</StatsCtx.Provider>;
}

export const useStats = () => {
  const v = useContext(StatsCtx);
  if (!v) throw new Error('useStats outside StatsProvider');
  return v;
};

/* ───────────── Shell ───────────── */

type NavId = 'dashboard' | 'orders' | 'samples' | 'tailoring' | 'fabrics' | 'tailors' | 'customers' | 'settings';

const NAV: { id: NavId; href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; count?: (s: AdminStats) => number; warn?: boolean }[] = [
  { id: 'dashboard', href: '#/', label: 'Umumiy ko‘rinish', icon: LayoutDashboard },
  { id: 'orders', href: '#/orders', label: 'Buyurtmalar', icon: Package, count: (s) => s.counts.newOrders },
  { id: 'samples', href: '#/samples', label: 'Bepul namunalar', icon: Box, count: (s) => s.counts.newSamples },
  { id: 'tailoring', href: '#/tailoring', label: 'Tikuv so‘rovlari', icon: Scissors, count: (s) => s.counts.newTailorRequests },
  { id: 'fabrics', href: '#/fabrics', label: 'Matolar', icon: Shirt, count: (s) => s.counts.lowStock, warn: true },
  { id: 'tailors', href: '#/tailors', label: 'Atelyelar', icon: Store, count: (s) => s.counts.pendingTailors },
  { id: 'customers', href: '#/customers', label: 'Mijozlar', icon: Users },
  { id: 'settings', href: '#/settings', label: 'Sozlamalar', icon: Settings },
];

function NavList({ active, onPick }: { active: NavId; onPick?: () => void }) {
  const { stats } = useStats();
  return (
    <nav aria-label="Bo‘limlar" className="space-y-0.5">
      {NAV.map((n) => {
        const count = stats && n.count ? n.count(stats) : 0;
        const on = n.id === active;
        return (
          <a
            key={n.id}
            href={n.href}
            onClick={onPick}
            aria-current={on ? 'page' : undefined}
            className={`flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors ${on ? 'bg-ink text-white' : 'text-ink-soft hover:bg-well'}`}
          >
            <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
            <span className="min-w-0 flex-1 truncate">{n.label}</span>
            {count > 0 && (
              <span
                className={`tabular min-w-[22px] rounded-full px-1.5 text-center text-[11.5px] font-semibold leading-5 ${on ? 'bg-white/20 text-white' : n.warn ? 'bg-well text-graphite' : 'bg-tape text-ink'}`}
                aria-label={`${count} ta`}
              >
                {count}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

export function Layout({ active, children }: { active: NavId; children: React.ReactNode }) {
  const { admin, signOut } = useAuth();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  const account = (
    <div className="border-t border-line pt-4">
      <div className="px-3 text-[13px]">
        <div className="truncate font-medium">{admin?.name}</div>
        <div className="truncate text-muted">
          {admin?.email} · {admin?.role === 'owner' ? 'ega' : 'menejer'}
        </div>
      </div>
      <a href={STORE_URL} target="_blank" rel="noopener" className="mt-3 flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] text-graphite hover:bg-well hover:text-ink">
        <ExternalLink className="h-4 w-4" strokeWidth={1.7} /> Saytni ochish
      </a>
      <button type="button" onClick={signOut} className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[13.5px] text-graphite hover:bg-well hover:text-ink">
        <LogOut className="h-4 w-4" strokeWidth={1.7} /> Chiqish
      </button>
    </div>
  );

  const brand = (
    <a href="#/" className="flex items-baseline gap-2 px-3">
      <span className="font-display text-[26px] lowercase leading-none">matos</span>
      <span className="text-[12.5px] text-muted">panel</span>
    </a>
  );

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-paper px-3 py-5 lg:flex">
        {brand}
        <div className="thin-scroll mt-7 min-h-0 flex-1 overflow-y-auto">
          <NavList active={active} />
        </div>
        {account}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-3 backdrop-blur lg:hidden">
        <button type="button" className="icon-btn" onClick={() => setMenu(true)} aria-label="Menyu" aria-expanded={menu}>
          <Menu className="h-5 w-5" />
        </button>
        {brand}
        <span className="w-9" />
      </header>

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menyu">
          <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-paper px-3 py-5 shadow-2xl">
            {brand}
            <div className="thin-scroll mt-7 min-h-0 flex-1 overflow-y-auto">
              <NavList active={active} onPick={() => setMenu(false)} />
            </div>
            {account}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
