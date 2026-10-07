import React, { useEffect, useState } from 'react';
import { Phone, Send } from 'lucide-react';
import type { AdminTailorRequestDTO, TailorRequestStatus } from '../../../shared/types';
import { TAILOR_REQUEST_FLOW, TAILOR_REQUEST_LABEL, TAILOR_REQUEST_STATUSES } from '../../../shared/status';
import { displayPhone, telHref } from '../../../shared/phone';
import { findGarment } from '../../../shared/garments';
import { api, errorMessage } from '../api';
import { go, useDebounced, useLoad, when, type Route } from '../lib';
import { useStats } from '../Layout';
import { Chips, Dl, Empty, ErrorBox, Overlay, PageHeader, Pager, SearchBox, Skeleton, TailorRequestBadge, useUi } from '../ui';

const NEXT: Partial<Record<TailorRequestStatus, { to: TailorRequestStatus; label: string }>> = {
  new: { to: 'contacted', label: 'Bog‘lanildi' },
  contacted: { to: 'in_progress', label: 'Tikishga olindi' },
  in_progress: { to: 'done', label: 'Tayyor' },
};

export function TailorRequests({ route }: { route: Route }) {
  const status = (route.query.get('status') as TailorRequestStatus | null) ?? '';
  const page = Math.max(1, Number(route.query.get('page')) || 1);
  const [search, setSearch] = useState(route.query.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);
  const openId = route.parts[1] ? Number(route.parts[1]) : null;
  const { stats } = useStats();

  const setQuery = (next: { status?: string; page?: number; q?: string }) =>
    go('tailoring', { replace: true, query: { status: next.status ?? status, q: next.q ?? q, page: next.page && next.page > 1 ? next.page : undefined } });
  useEffect(() => {
    if (q !== (route.query.get('q') ?? '')) setQuery({ q, page: 1 });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useLoad((signal) => api.tailorRequests({ status: status || undefined, q: q || undefined, page, pageSize: 20 }, signal), [status, q, page]);
  const data = list.data;

  return (
    <>
      <PageHeader title="Tikuv so‘rovlari" sub="Mijoz atelyeni tanlab, o‘lchamlari bilan yuborgan so‘rovlar. Mijozga va ustaga bog‘laning." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips
          value={status}
          onChange={(s) => setQuery({ status: s, page: 1 })}
          options={[{ id: '', label: 'Hammasi' }, ...TAILOR_REQUEST_STATUSES.map((s) => ({ id: s, label: TAILOR_REQUEST_LABEL[s].uz, count: s === 'new' ? stats?.counts.newTailorRequests : undefined }))]}
          label="Holat bo‘yicha"
        />
        <SearchBox value={search} onChange={setSearch} placeholder="Raqam, mijoz yoki atelye" />
      </div>

      <section className="card overflow-hidden">
        {list.error ? (
          <div className="p-4">
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : !data ? (
          <Skeleton rows={6} />
        ) : data.items.length === 0 ? (
          <Empty title={q || status ? 'Hech narsa topilmadi' : 'Hali so‘rov yo‘q'} text={q || status ? 'Qidiruv yoki filtrni o‘zgartiring.' : 'Xaridor “Tikuvchilar” sahifasidan so‘rov yuborsa, shu yerda ko‘rinadi.'} />
        ) : (
          <>
            <ul className={list.loading ? 'opacity-60' : ''}>
              {data.items.map((r) => (
                <li key={r.id} className={`border-t border-line first:border-0 ${r.status === 'new' ? 'needs-action' : ''}`}>
                  <a href={`#/tailoring/${r.id}`} className="grid gap-x-4 gap-y-0.5 px-4 py-3.5 hover:bg-mist sm:grid-cols-[100px_1.2fr_1.2fr_auto] sm:items-center">
                    <span className="font-medium">{r.number}</span>
                    <span className="min-w-0 truncate">
                      {r.customerName} · <span className="tabular text-graphite">{displayPhone(r.customerPhone)}</span>
                    </span>
                    <span className="min-w-0 truncate text-graphite">
                      {findGarment(r.garmentKey)?.name.uz ?? r.garmentKey} → {r.tailor.atelierName}
                    </span>
                    <span className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-[12.5px] text-muted">{when(r.createdAt)}</span>
                      <TailorRequestBadge status={r.status} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setQuery({ page: p })} />
          </>
        )}
      </section>

      <RequestDrawer
        id={openId}
        onClose={() => go('tailoring', { query: { status, q, page: page > 1 ? page : undefined } })}
        onChanged={(r) => list.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === r.id ? r : x)) } : d))}
      />
    </>
  );
}

function RequestDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: (r: AdminTailorRequestDTO) => void }) {
  const { toast, confirm } = useUi();
  const { refresh } = useStats();
  const [req, setReq] = useState<AdminTailorRequestDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setReq(null);
    setError(null);
    if (!id) return;
    api
      .tailorRequest(id)
      .then((r) => {
        setReq(r);
        setNote(r.adminNote ?? '');
      })
      .catch(setError);
  }, [id]);

  const update = async (patch: { status?: TailorRequestStatus; adminNote?: string | null }, ok: string) => {
    if (!req) return;
    setBusy(true);
    try {
      const next = await api.updateTailorRequest(req.id, patch);
      setReq(next);
      onChanged(next);
      refresh();
      toast(ok);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const step = req ? NEXT[req.status] : undefined;
  const reached = req ? TAILOR_REQUEST_FLOW.indexOf(req.status) : -1;
  const m = req?.measurements;

  return (
    <Overlay
      open={!!id}
      onClose={onClose}
      side
      title={req ? `${req.number} · tikuv so‘rovi` : 'Tikuv so‘rovi'}
      footer={
        req &&
        (req.status === 'cancelled' ? (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => update({ status: 'new' }, 'So‘rov qayta ochildi')}>
            Qayta ochish
          </button>
        ) : (
          <>
            {req.status !== 'done' && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => (await confirm({ title: 'So‘rov bekor qilinsinmi?', text: 'Keyin qayta ochish mumkin.', confirm: 'Bekor qilish', danger: true })) && update({ status: 'cancelled' }, 'So‘rov bekor qilindi')}
              >
                Bekor qilish
              </button>
            )}
            {step && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => update({ status: step.to }, `Holat: ${TAILOR_REQUEST_LABEL[step.to].uz}`)}>
                {step.label}
              </button>
            )}
          </>
        ))
      }
    >
      {error ? (
        <div className="p-5">
          <ErrorBox error={error} />
        </div>
      ) : !req ? (
        <Skeleton rows={6} />
      ) : (
        <div className="space-y-6 px-5 py-5">
          <ol className="flex items-center gap-1.5" aria-label="Holat">
            {TAILOR_REQUEST_FLOW.map((s, i) => (
              <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={`h-1.5 rounded-full ${req.status === 'cancelled' ? 'bg-well' : i <= reached ? (i === reached && s !== 'done' ? 'bg-tape' : 'bg-ink') : 'bg-well'}`} />
                <span className="truncate text-[11.5px] text-muted">{TAILOR_REQUEST_LABEL[s].uz}</span>
              </li>
            ))}
          </ol>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4">
              <div className="text-[12.5px] text-graphite">Mijoz</div>
              <div className="mt-1 font-medium">{req.customerName}</div>
              <div className="tabular text-graphite">{displayPhone(req.customerPhone)}</div>
              <a className="btn btn-primary btn-sm mt-3" href={telHref(req.customerPhone)}>
                <Phone className="h-3.5 w-3.5" /> Qo‘ng‘iroq
              </a>
            </div>
            <div className="rounded-xl border border-line p-4">
              <div className="text-[12.5px] text-graphite">Atelye</div>
              <div className="mt-1 font-medium">{req.tailor.atelierName}</div>
              <div className="text-graphite">
                {req.tailor.name}, {req.tailor.city}
              </div>
              <div className="mt-3 flex gap-2">
                {req.tailor.phone && (
                  <a className="btn btn-secondary btn-sm" href={telHref(req.tailor.phone)}>
                    <Phone className="h-3.5 w-3.5" /> Usta
                  </a>
                )}
                {req.tailor.telegram && (
                  <a className="btn btn-secondary btn-sm" href={`https://t.me/${req.tailor.telegram.replace('@', '')}`} target="_blank" rel="noreferrer">
                    <Send className="h-3.5 w-3.5" /> Telegram
                  </a>
                )}
              </div>
            </div>
          </section>

          <Dl
            rows={[
              ['Kiyim', findGarment(req.garmentKey)?.name.uz ?? req.garmentKey],
              ['Mato', req.fabricLabel],
              ['O‘lchamlar', m ? `bo‘y ${m.heightCm}, ko‘krak ${m.bustCm}, bel ${m.waistCm}, son ${m.hipsCm} sm` : 'ko‘rsatilmagan'],
              ['Izoh', req.note ?? ''],
              ['Vaqt', when(req.createdAt)],
              ['Mijoz turi', req.userId ? <a className="underline underline-offset-4" href={`#/customers/${req.userId}`}>Ro‘yxatdan o‘tgan</a> : 'Mehmon'],
            ]}
          />

          <section>
            <label className="block">
              <span className="label">Ichki izoh</span>
              <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: ustaga 12:00 da yuborildi, narx 520 000" />
            </label>
            <button type="button" className="btn btn-secondary btn-sm mt-2" disabled={busy || note === (req.adminNote ?? '')} onClick={() => update({ adminNote: note.trim() || null }, 'Izoh saqlandi')}>
              Izohni saqlash
            </button>
          </section>
        </div>
      )}
    </Overlay>
  );
}
