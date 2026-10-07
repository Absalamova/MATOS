import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** visually hide the title (still read by screen readers) */
  hideTitle?: boolean;
  variant?: 'center' | 'drawer';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

let openCount = 0;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible modal / side drawer: Esc closes, focus is trapped and restored, page scroll is locked. */
export function Dialog({ open, onClose, title, hideTitle, variant = 'center', size = 'md', closeLabel = 'Yopish', footer, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    openCount++;
    document.documentElement.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (el ?? panel.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
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
      openCount--;
      if (openCount <= 0) document.documentElement.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };
  const isDrawer = variant === 'drawer';

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div className="absolute inset-0 bg-ink/45 animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          isDrawer
            ? 'relative ml-auto flex h-full w-full max-w-[460px] flex-col bg-paper shadow-2xl animate-slide-in outline-none'
            : `relative m-auto flex max-h-[100dvh] w-full flex-col bg-paper outline-none animate-fade sm:max-h-[92dvh] sm:rounded-2xl sm:shadow-2xl ${widths[size]} h-full sm:h-auto`
        }
      >
        <div className={`flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6`}>
          <h2 id={titleId} className={hideTitle ? 'sr-only' : 'font-display text-[22px] leading-tight'}>
            {title}
          </h2>
          <button type="button" className="icon-btn -mr-2 shrink-0" onClick={onClose} aria-label={closeLabel}>
            <X className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line bg-paper px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
