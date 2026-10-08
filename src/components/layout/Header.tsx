import React, { useEffect, useRef, useState } from 'react';
import { Camera, Menu, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { useApp } from '../../state/app';
import { href, RouteName } from '../../lib/router';
import { L, UI } from '../../lib/i18n';
import { Currency, Language, UnitSystem } from '../../types';
import { Dialog } from '../ui/Dialog';

const NAV: { route: RouteName; label: typeof UI.catalog }[] = [
  { route: 'catalog', label: UI.catalog },
  { route: 'studio', label: UI.studio },
  { route: 'tailors', label: UI.tailors },
];

const LANGS: { id: Language; label: string }[] = [
  { id: 'uz', label: 'O‘zbekcha' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];
const CURRENCIES: { id: Currency; label: string }[] = [
  { id: 'UZS', label: 'so‘m' },
  { id: 'USD', label: '$' },
  { id: 'EUR', label: '€' },
];

function Settings({ compact }: { compact?: boolean }) {
  const { lang, setLang, currency, setCurrency, unit, setUnit, t } = useApp();
  const group = (title: string, children: React.ReactNode) => (
    <fieldset className="space-y-2">
      <legend className="label">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
  return (
    <div className={compact ? 'space-y-5' : 'space-y-4 p-4'}>
      {group(
        t(L('Til', 'Язык', 'Language')),
        LANGS.map((l) => (
          <button key={l.id} type="button" className="chip" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
            {l.label}
          </button>
        )),
      )}
      {group(
        t(L('Valyuta', 'Валюта', 'Currency')),
        CURRENCIES.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={currency === c.id} onClick={() => setCurrency(c.id)}>
            {c.label}
          </button>
        )),
      )}
      {group(
        t(L('O‘lchov birligi', 'Единицы', 'Units')),
        (['metric', 'imperial'] as UnitSystem[]).map((u) => (
          <button key={u} type="button" className="chip" aria-pressed={unit === u} onClick={() => setUnit(u)}>
            {u === 'metric' ? t(L('Metr', 'Метры', 'Metres')) : t(L('Yard', 'Ярды', 'Yards'))}
          </button>
        )),
      )}
    </div>
  );
}

function SettingsMenu() {
  const { lang, currency, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const cur = CURRENCIES.find((c) => c.id === currency)?.label;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-sm px-3 uppercase tracking-wide"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        aria-label={t(L('Til va valyuta', 'Язык и валюта', 'Language and currency'))}
      >
        {lang} <span className="text-muted">·</span> <span className="normal-case">{cur}</span>
      </button>
      {open && (
        <div role="dialog" className="absolute right-0 top-12 z-50 w-[300px] rounded-xl border border-line bg-paper shadow-xl animate-fade">
          <Settings />
        </div>
      )}
    </div>
  );
}

export function Header({ route }: { route: RouteName }) {
  const { t, cart, samples, user, open, overlay, close } = useApp();
  const count = cart.length + samples.length;
  const navLink = (r: RouteName, label: string, mobile = false) => {
    const active = route === r || (r === 'catalog' && route === 'fabric');
    return (
      <a
        key={r}
        href={href(r)}
        aria-current={active ? 'page' : undefined}
        onClick={mobile ? close : undefined}
        className={
          mobile
            ? `block border-b border-line py-4 font-display text-[26px] ${active ? 'text-ink' : 'text-graphite'}`
            : `relative py-5 text-[14.5px] transition-colors hover:text-ink ${active ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink' : 'text-graphite'}`
        }
      >
        {label}
      </a>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        {t(L('Asosiy qismga o‘tish', 'Перейти к содержимому', 'Skip to content'))}
      </a>
      <div className="wrap flex h-16 items-center gap-6">
        <a href="#/" className="font-display text-[28px] lowercase leading-none tracking-tight" aria-label="MATOS — bosh sahifa">
          matos
        </a>
        <nav className="ml-4 hidden items-center gap-7 lg:flex" aria-label={t(L('Asosiy menyu', 'Главное меню', 'Main menu'))}>
          {NAV.map((n) => navLink(n.route, t(n.label)))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button type="button" className="btn btn-secondary btn-sm hidden xl:inline-flex" onClick={() => open('style')}>
            <Sparkles className="h-4 w-4" strokeWidth={1.7} />
            {t(UI.styleAdvisor)}
          </button>
          <button type="button" className="icon-btn hidden md:inline-flex xl:hidden" onClick={() => open('style')} aria-label={t(UI.styleAdvisor)} title={t(UI.styleAdvisor)}>
            <Sparkles className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm hidden md:inline-flex" onClick={() => open('search')}>
            <Camera className="h-4 w-4" strokeWidth={1.7} />
            {t(UI.photoSearch)}
          </button>
          <button type="button" className="icon-btn md:hidden" onClick={() => open('search')} aria-label={t(UI.photoSearch)}>
            <Camera className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <div className="hidden sm:block">
            <SettingsMenu />
          </div>
          <button type="button" className="icon-btn" onClick={() => open(user ? 'profile' : 'auth')} aria-label={user ? t(UI.profile) : t(UI.signIn)}>
            {user ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-white">{user.name.charAt(0).toUpperCase()}</span>
            ) : (
              <UserRound className="h-5 w-5" strokeWidth={1.6} />
            )}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => open('cart')}
            aria-label={`${t(UI.bag)}${count ? `: ${count}` : ''}`}
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
            {count > 0 && (
              <span className="tabular absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-tape px-1 text-[11px] font-semibold text-ink">
                {count}
              </span>
            )}
          </button>
          <button type="button" className="icon-btn lg:hidden" onClick={() => open('menu')} aria-label={t(L('Menyu', 'Меню', 'Menu'))}>
            <Menu className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <Dialog open={overlay === 'menu'} onClose={close} title={t(L('Menyu', 'Меню', 'Menu'))} variant="drawer" closeLabel={t(UI.close)}>
        <nav className="px-5 pb-2 sm:px-6">
          {navLink('home', t(L('Bosh sahifa', 'Главная', 'Home')), true)}
          {NAV.map((n) => navLink(n.route, t(n.label), true))}
          <button type="button" className="flex w-full items-center gap-3 border-b border-line py-4 text-left font-display text-[26px] text-graphite" onClick={() => open('style')}>
            {t(UI.styleAdvisor)}
            <Sparkles className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </nav>
        <div className="px-5 py-6 sm:px-6">
          <Settings compact />
        </div>
      </Dialog>
    </header>
  );
}
