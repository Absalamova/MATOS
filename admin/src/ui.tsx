import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { OrderStatus, TailorRequestStatus, TailorStatus } from '../../shared/types';
import { ORDER_STATUS_LABEL, TAILOR_REQUEST_LABEL, TAILOR_STATUS_LABEL } from '../../shared/status';

/* ───────────── Overlay (modal / drawer) ───────────── */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let openOverlays = 0;

export function Overlay({
  open,
  onClose,
  title,
  side,
  wide,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  side?: boolean;
  wide?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    openOverlays++;
    document.documentElement.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (el ?? panel.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      openOverlays--;
      if (openOverlays <= 0) document.documentElement.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          side
            ? `relative ml-auto flex h-full w-full flex-col bg-paper shadow-2xl outline-none animate-slide-in ${wide ? 'max-w-[680px]' : 'max-w-[520px]'}`
            : `relative m-auto flex max-h-[100dvh] w-full flex-col bg-paper outline-none animate-fade sm:max-h-[90dvh] sm:rounded-2xl sm:shadow-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} h-full sm:h-auto`
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 id={titleId} className="min-w-0 truncate font-sans text-[16px] font-semibold">
            {title}
          </h2>
          <button type="button" className="icon-btn -mr-2 shrink-0" onClick={onClose} aria-label="Yopish">
            <X className="h-5 w-5" strokeWidth={1.7} />
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── Toasts & confirm ───────────── */

interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}
interface ConfirmOpts {
  title: string;
  text: string;
  confirm: string;
  danger?: boolean;
}

const UiCtx = createContext<{ toast: (text: string, tone?: ToastItem['tone']) => void; confirm: (o: ConfirmOpts) => Promise<boolean> } | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ask, setAsk] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), []);
  const answer = (v: boolean) => {
    ask?.resolve(v);
    setAsk(null);
  };

  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-[13.5px] shadow-lg animate-fade ${t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'}`}
          >
            {t.text}
          </div>
        ))}
      </div>
      <Overlay
        open={!!ask}
        onClose={() => answer(false)}
        title={ask?.title ?? ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => answer(false)}>
              Bekor qilish
            </button>
            <button type="button" className={`btn ${ask?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => answer(true)} data-autofocus>
              {ask?.confirm}
            </button>
          </>
        }
      >
        <p className="px-5 py-5 text-graphite">{ask?.text}</p>
      </Overlay>
    </UiCtx.Provider>
  );
}

export const useUi = () => {
  const v = useContext(UiCtx);
  if (!v) throw new Error('useUi outside UiProvider');
  return v;
};

/* ───────────── Small pieces ───────────── */

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[30px] sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-1 text-graphite">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  tape: 'bg-tape-soft text-[#6b5200]',
  info: 'bg-info-soft text-info',
  plum: 'bg-plum-soft text-plum',
  ok: 'bg-ok-soft text-ok',
  muted: 'bg-well text-graphite',
  danger: 'bg-danger-soft text-danger',
};

export const Badge = ({ tone = 'muted', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) => (
  <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-[12px] font-medium ${TONES[tone]}`}>{children}</span>
);

const ORDER_TONE: Record<OrderStatus, keyof typeof TONES> = { new: 'tape', confirmed: 'info', packed: 'info', shipped: 'plum', delivered: 'ok', cancelled: 'muted' };
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL[status].uz}</Badge>;

const TREQ_TONE: Record<TailorRequestStatus, keyof typeof TONES> = { new: 'tape', contacted: 'info', in_progress: 'plum', done: 'ok', cancelled: 'muted' };
export const TailorRequestBadge = ({ status }: { status: TailorRequestStatus }) => <Badge tone={TREQ_TONE[status]}>{TAILOR_REQUEST_LABEL[status].uz}</Badge>;

const TAILOR_TONE: Record<TailorStatus, keyof typeof TONES> = { pending: 'tape', approved: 'ok', rejected: 'danger', hidden: 'muted' };
export const TailorBadge = ({ status }: { status: TailorStatus }) => <Badge tone={TAILOR_TONE[status]}>{TAILOR_STATUS_LABEL[status].uz}</Badge>;

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input type="search" className="field pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="chip shrink-0" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className="count tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-graphite">
      <span className="tabular">
        {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} / {total}
      </span>
      <div className="flex gap-1">
        <button type="button" className="icon-btn border border-line disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Oldingi sahifa">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className="icon-btn border border-line disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Keyingi sahifa">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-graphite">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Ma’lumotni yuklab bo‘lmadi';
  return (
    <div className="card border-danger-soft px-5 py-6 text-center">
      <p className="text-danger">{msg}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  );
}

export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2 p-4" aria-busy="true" aria-label="Yuklanmoqda">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-11 animate-pulse rounded-lg bg-mist" />
    ))}
  </div>
);

/** Label + control + message. The message is linked with aria-describedby so it is announced but not part of the field name. */
export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const msg = error || hint;
  const child = React.isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? React.cloneElement(children, { id: children.props.id ?? id, 'aria-describedby': msg ? msgId : undefined })
    : children;
  return (
    <div className={className}>
      <label className="label" htmlFor={React.isValidElement<{ id?: string }>(children) ? (children.props.id ?? id) : undefined}>
        {label}
      </label>
      {child}
      {error ? (
        <span id={msgId} className="mt-1 block text-[12.5px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={msgId} className="mt-1 block text-[12px] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Two-column definition list used in detail drawers. */
export const Dl = ({ rows }: { rows: [string, React.ReactNode][] }) => (
  <dl className="divide-y divide-line">
    {rows
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 text-[13.5px] sm:grid-cols-[140px_1fr]">
          <dt className="text-graphite">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
  </dl>
);
