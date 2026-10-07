import React, { useEffect, useState } from 'react';
import { Copy, Download, Phone } from 'lucide-react';
import type { AdminOrderDTO, OrderDTO, OrderKind, OrderStatus } from '../../../shared/types';
import { ORDER_FLOW, ORDER_STATUS_LABEL, orderStatusesFor } from '../../../shared/status';
import { displayPhone, telHref } from '../../../shared/phone';
import { findGarment } from '../../../shared/garments';
import { api, errorMessage, photoUrl } from '../api';
import { downloadBlob, go, money, num, useDebounced, useLoad, when, type Route } from '../lib';
import { useStats } from '../Layout';
import { Chips, Dl, Empty, ErrorBox, OrderBadge, Overlay, PageHeader, Pager, SearchBox, Skeleton, useUi } from '../ui';

const COPY: Record<OrderKind, { title: string; path: string; sub: string; search: string; empty: string }> = {
  fabric: { title: 'Buyurtmalar', path: 'orders', sub: 'Saytdan kelgan mato buyurtmalari.', search: 'Raqam, ism yoki telefon', empty: 'Saytdan buyurtma kelishi bilan shu yerda ko‘rinadi.' },
  sample: { title: 'Bepul namunalar', path: 'samples', sub: '10×10 sm bo‘laklar so‘rovlari — qadoqlab, yuboring.', search: 'Raqam, ism yoki telefon', empty: 'Xaridor namuna so‘rasa, shu yerda ko‘rinadi.' },
};

const NEXT: Record<OrderKind, Partial<Record<OrderStatus, { to: OrderStatus; label: string }>>> = {
  fabric: {
    new: { to: 'confirmed', label: 'Tasdiqlash' },
    confirmed: { to: 'shipped', label: 'Kuryerga berildi' },
    shipped: { to: 'delivered', label: 'Yetkazildi' },
  },
  sample: {
    new: { to: 'packed', label: 'Qadoqlandi' },
    packed: { to: 'shipped', label: 'Yuborildi' },
    shipped: { to: 'delivered', label: 'Yetkazildi' },
  },
};

const itemsSummary = (o: OrderDTO) =>
  o.items.map((i) => `${i.fabricName.uz}, ${i.colorName.uz}${i.meters ? ` × ${num(i.meters, i.meters % 1 ? 1 : 0)} m` : ''}`).join('; ');

export function Orders({ kind, route }: { kind: OrderKind; route: Route }) {
  const copy = COPY[kind];
  const status = (route.query.get('status') as OrderStatus | null) ?? '';
  const page = Math.max(1, Number(route.query.get('page')) || 1);
  const [search, setSearch] = useState(route.query.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);
  const openId = route.parts[1] ? Number(route.parts[1]) : null;
  const { stats } = useStats();
  const { toast } = useUi();
  const [exporting, setExporting] = useState(false);

  const setQuery = (next: { status?: string; page?: number; q?: string }) =>
    go(copy.path, { replace: true, query: { status: next.status ?? status, q: next.q ?? q, page: next.page && next.page > 1 ? next.page : undefined } });

  useEffect(() => {
    if (q !== (route.query.get('q') ?? '')) setQuery({ q, page: 1 });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useLoad((signal) => api.orders(kind, { status: status || undefined, q: q || undefined, page, pageSize: 20 }, signal), [kind, status, q, page]);
  const newCount = kind === 'fabric' ? stats?.counts.newOrders : stats?.counts.newSamples;

  const chips = [
    { id: '', label: 'Hammasi' },
    ...orderStatusesFor(kind).map((s) => ({ id: s, label: ORDER_STATUS_LABEL[s].uz, count: s === 'new' ? newCount : undefined })),
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, name } = await api.exportOrders(kind, { status: status || undefined, q: q || undefined });
      downloadBlob(blob, name);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const data = list.data;

  return (
    <>
      <PageHeader
        title={copy.title}
        sub={copy.sub}
        actions={
          <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? 'Tayyorlanmoqda…' : 'CSV (Excel)'}
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips value={status} onChange={(s) => setQuery({ status: s, page: 1 })} options={chips} label="Holat bo‘yicha" />
        <SearchBox value={search} onChange={setSearch} placeholder={copy.search} />
      </div>

      <section className="card overflow-hidden">
        {list.error ? (
          <div className="p-4">
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : !data ? (
          <Skeleton rows={8} />
        ) : data.items.length === 0 ? (
          <Empty title={q || status ? 'Hech narsa topilmadi' : 'Hali so‘rov yo‘q'} text={q || status ? 'Qidiruv yoki filtrni o‘zgartirib ko‘ring.' : copy.empty} />
        ) : (
          <>
            <table className="hidden w-full border-collapse text-left md:table">
              <thead className="bg-mist text-[12.5px] text-graphite">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Raqam</th>
                  <th className="px-4 py-2.5 font-medium">Mijoz</th>
                  <th className="px-4 py-2.5 font-medium">{kind === 'fabric' ? 'Matolar' : 'Namunalar'}</th>
                  {kind === 'fabric' && <th className="px-4 py-2.5 text-right font-medium">Summa</th>}
                  <th className="px-4 py-2.5 font-medium">Vaqt</th>
                  <th className="px-4 py-2.5 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody className={list.loading ? 'opacity-60' : ''}>
                {data.items.map((o) => (
                  <tr
                    key={o.id}
                    className={`cursor-pointer border-t border-line hover:bg-mist ${o.status === 'new' ? 'needs-action' : ''}`}
                    onClick={() => go(`${copy.path}/${o.id}`, { query: { status, q, page: page > 1 ? page : undefined } })}
                  >
                    <td className="px-4 py-3 font-medium">
                      <a href={`#/${copy.path}/${o.id}`} onClick={(e) => e.preventDefault()} className="outline-offset-4">
                        {o.number}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[220px] truncate">{o.customerName}</div>
                      <div className="tabular text-[12.5px] text-graphite">{displayPhone(o.customerPhone)}</div>
                    </td>
                    <td className="max-w-[360px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex shrink-0 -space-x-1.5">
                          {o.items.slice(0, 4).map((i) => (
                            <span key={`${i.fabricId}-${i.colorId}`} className="h-5 w-5 rounded-full ring-2 ring-paper" style={{ background: i.colorHex }} aria-hidden="true" />
                          ))}
                        </span>
                        <span className="truncate text-graphite">{itemsSummary(o)}</span>
                      </div>
                    </td>
                    {kind === 'fabric' && <td className="tabular whitespace-nowrap px-4 py-3 text-right">{money(o.totalUZS)}</td>}
                    <td className="whitespace-nowrap px-4 py-3 text-graphite">{when(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <OrderBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className={`md:hidden ${list.loading ? 'opacity-60' : ''}`}>
              {data.items.map((o) => (
                <li key={o.id} className={`border-t border-line first:border-0 ${o.status === 'new' ? 'needs-action' : ''}`}>
                  <a href={`#/${copy.path}/${o.id}`} className="block px-4 py-3.5 active:bg-mist">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{o.number}</span>
                      <OrderBadge status={o.status} />
                    </div>
                    <div className="mt-1 truncate">
                      {o.customerName} · <span className="tabular text-graphite">{displayPhone(o.customerPhone)}</span>
                    </div>
                    <div className="mt-1 truncate text-[13px] text-graphite">{itemsSummary(o)}</div>
                    <div className="mt-1 flex justify-between text-[12.5px] text-muted">
                      <span>{when(o.createdAt)}</span>
                      {kind === 'fabric' && <span className="tabular font-medium text-ink">{money(o.totalUZS)}</span>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setQuery({ page: p })} />
          </>
        )}
      </section>

      <OrderDrawer
        id={openId}
        kind={kind}
        onClose={() => go(copy.path, { query: { status, q, page: page > 1 ? page : undefined } })}
        onChanged={(o) => list.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === o.id ? o : x)) } : d))}
      />
    </>
  );
}

function OrderDrawer({ id, kind, onClose, onChanged }: { id: number | null; kind: OrderKind; onClose: () => void; onChanged: (o: OrderDTO) => void }) {
  const { toast, confirm } = useUi();
  const { refresh } = useStats();
  const [order, setOrder] = useState<AdminOrderDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setOrder(null);
    setError(null);
    if (!id) return;
    api
      .order(id)
      .then((o) => {
        setOrder(o);
        setNote(o.adminNote ?? '');
      })
      .catch(setError);
  }, [id]);

  const update = async (patch: { status?: OrderStatus; adminNote?: string | null }, okText: string) => {
    if (!order) return;
    setBusy(true);
    try {
      const next = await api.updateOrder(order.id, patch);
      setOrder(next);
      onChanged(next);
      refresh();
      toast(okText);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const step = order ? NEXT[order.kind][order.status] : undefined;
  const flow = order ? ORDER_FLOW[order.kind] : [];
  const reached = order ? flow.indexOf(order.status) : -1;

  const cancel = async () => {
    if (!order) return;
    const ok = await confirm({
      title: `${order.number} bekor qilinsinmi?`,
      text: order.kind === 'fabric' ? 'Buyurtmadagi metraj omborga qaytariladi. Keyin qayta ochish mumkin.' : 'So‘rov bekor qilinadi. Keyin qayta ochish mumkin.',
      confirm: 'Bekor qilish',
      danger: true,
    });
    if (ok) update({ status: 'cancelled' }, 'Buyurtma bekor qilindi');
  };

  const copyPhone = () => {
    if (!order) return;
    navigator.clipboard?.writeText(displayPhone(order.customerPhone)).then(
      () => toast('Raqam nusxalandi'),
      () => toast('Nusxalab bo‘lmadi', 'error'),
    );
  };

  return (
    <Overlay
      open={!!id}
      onClose={onClose}
      side
      wide
      title={order ? `${order.number} · ${kind === 'fabric' ? 'mato buyurtmasi' : 'bepul namuna'}` : 'Buyurtma'}
      footer={
        order && (
          <>
            {order.status === 'cancelled' ? (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => update({ status: 'new' }, 'Buyurtma qayta ochildi')}>
                Qayta ochish
              </button>
            ) : (
              <>
                {order.status !== 'delivered' && (
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={cancel}>
                    Bekor qilish
                  </button>
                )}
                {step && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => update({ status: step.to }, `Holat: ${ORDER_STATUS_LABEL[step.to].uz}`)}>
                    {step.label}
                  </button>
                )}
              </>
            )}
          </>
        )
      }
    >
      {error ? (
        <div className="p-5">
          <ErrorBox error={error} />
        </div>
      ) : !order ? (
        <Skeleton rows={6} />
      ) : (
        <div className="space-y-6 px-5 py-5">
          <ol className="flex items-center gap-1.5" aria-label="Holat">
            {flow.map((s, i) => (
              <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={`h-1.5 rounded-full ${order.status === 'cancelled' ? 'bg-well' : i <= reached ? (i === reached && s !== 'delivered' ? 'bg-tape' : 'bg-ink') : 'bg-well'}`} />
                <span className={`truncate text-[11.5px] ${i === reached && order.status !== 'cancelled' ? 'font-medium text-ink' : 'text-muted'}`}>{ORDER_STATUS_LABEL[s].uz}</span>
              </li>
            ))}
          </ol>
          {order.status === 'cancelled' && <p className="rounded-lg bg-well px-3 py-2 text-[13px] text-graphite">Bu buyurtma bekor qilingan.</p>}

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-graphite">Mijoz</h3>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
              <div className="min-w-0">
                <div className="font-medium">{order.customerName}</div>
                <div className="tabular text-graphite">{displayPhone(order.customerPhone)}</div>
                {order.userId ? (
                  <a href={`#/customers/${order.userId}`} className="text-[12.5px] text-graphite underline underline-offset-4">
                    Ro‘yxatdan o‘tgan mijoz
                  </a>
                ) : (
                  <span className="text-[12.5px] text-muted">Mehmon sifatida buyurtma bergan</span>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyPhone} aria-label="Raqamni nusxalash">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a className="btn btn-primary btn-sm" href={telHref(order.customerPhone)}>
                  <Phone className="h-3.5 w-3.5" /> Qo‘ng‘iroq
                </a>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-[13px] font-semibold text-graphite">Yetkazish</h3>
            <Dl
              rows={[
                ['Usul', order.delivery.method === 'pickup' ? 'Olib ketish (showroom)' : 'Kuryer'],
                ['Shahar', order.delivery.city ?? ''],
                ['Manzil', order.delivery.address ?? ''],
                ['To‘lov', order.payment === 'card' ? 'Karta, qabulda' : order.payment === 'cash' ? 'Naqd, qabulda' : ''],
                ['Mijoz izohi', order.note ?? ''],
                ['Vaqt', when(order.createdAt)],
              ]}
            />
          </section>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-graphite">{order.kind === 'fabric' ? 'Matolar' : 'Namunalar'}</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {order.items.map((i) => (
                <li key={`${i.fabricId}-${i.colorId}`} className="flex items-center gap-3 p-3">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-well" style={{ background: i.colorHex }}>
                    {i.photo && <img src={photoUrl(i.photo)} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{i.fabricName.uz}</div>
                    <div className="truncate text-[13px] text-graphite">
                      {i.colorName.uz}
                      {i.garmentKey ? ` · ${findGarment(i.garmentKey)?.name.uz ?? i.garmentKey}` : ''}
                    </div>
                  </div>
                  {order.kind === 'fabric' && (
                    <div className="tabular shrink-0 text-right">
                      <div>{money(i.amountUZS)}</div>
                      <div className="text-[12.5px] text-graphite">
                        {num(i.meters, i.meters % 1 ? 1 : 0)} m × {money(i.priceUZS)}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {order.kind === 'fabric' && (
              <div className="tabular mt-3 space-y-1 text-[13.5px]">
                <div className="flex justify-between text-graphite">
                  <span>Matolar</span>
                  <span>{money(order.subtotalUZS)}</span>
                </div>
                <div className="flex justify-between text-graphite">
                  <span>Yetkazish</span>
                  <span>{order.deliveryUZS ? money(order.deliveryUZS) : 'bepul'}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                  <span>Jami</span>
                  <span>{money(order.totalUZS)}</span>
                </div>
              </div>
            )}
          </section>

          <section>
            <label className="block">
              <span className="label">Ichki izoh (mijoz ko‘rmaydi)</span>
              <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: 18:00 dan keyin qo‘ng‘iroq qilishni so‘radi" />
            </label>
            <button type="button" className="btn btn-secondary btn-sm mt-2" disabled={busy || note === (order.adminNote ?? '')} onClick={() => update({ adminNote: note.trim() || null }, 'Izoh saqlandi')}>
              Izohni saqlash
            </button>
          </section>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-graphite">Tarix</h3>
            <ol className="space-y-2 border-l border-line pl-4">
              {order.events.map((e, i) => (
                <li key={i} className="relative text-[13px]">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink" aria-hidden="true" />
                  <span className="font-medium">{ORDER_STATUS_LABEL[e.status]?.uz ?? e.status}</span>
                  <span className="text-graphite"> · {e.actor} · {when(e.createdAt)}</span>
                  {e.note && <div className="text-graphite">{e.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Overlay>
  );
}
