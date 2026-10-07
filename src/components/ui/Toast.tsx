import React from 'react';
import { useApp } from '../../state/app';

export function ToastHost() {
  const { toast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-6" aria-live="polite" role="status">
      {toast?.message && (
        <div key={toast.id} className="pointer-events-auto flex max-w-[520px] items-center gap-4 rounded-full bg-ink py-2.5 pl-5 pr-2.5 text-[14px] text-white shadow-xl animate-rise">
          <span className="line-clamp-2">{toast.message}</span>
          {toast.action ? (
            <button type="button" onClick={toast.action.run} className="shrink-0 rounded-full bg-tape px-4 py-2 text-[13px] font-medium text-ink hover:bg-[#f3cf4f]">
              {toast.action.label}
            </button>
          ) : (
            <span className="w-2" />
          )}
        </div>
      )}
    </div>
  );
}
