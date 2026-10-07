import React, { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { displayPhone, telHref } from '../../../shared/phone';
import { findGarment } from '../../../shared/garments';
import { api, errorMessage } from '../api';
import { date, go, money, num, useDebounced, useLoad, when, type Route } from '../lib';
import { Badge, Dl, Empty, ErrorBox, OrderBadge, Overlay, PageHeader, Pager, SearchBox, Skeleton, TailorRequestBadge, useUi } from '../ui';

export function Customers({ route }: { route: Route }) {
  const page = Math.max(1, Number(route.query.get('page')) || 1);
  const [search, setSearch] = useState(route.query.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);
  const openId = route.parts[1] ? Number(route.parts[1]) : null;

  useEffect(() => {
    if (q !== (route.query.get('q') ?? '')) go('customers', { replace: true, query: { q } });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useLoad((signal) => api.customers({ q: q || undefined, page, pageSize: 25 }, signal), [q, page]);
  const data = list.data;

  return (
    <>
      <PageHeader title="Mijozlar" sub="Saytda ro‘yxatdan o‘tgan xaridorlar. Mehmon buyurtmalari “Buyurtmalar” bo‘limida." />
      <div className="mb-4 flex justify-end">
        <SearchBox value={search} onChange={setSearch} placeholder="Ism, telefon yoki email" />
      </div>
      <section className="card overflow-hidden">
        {list.error ? (
          <div className="p-4">
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : !data ? (
          <Skeleton rows={6} />
        ) : data.items.length === 0 ? (
          <Empty title={q ? 'Hech kim topilmadi' : 'Hali mijoz yo‘q'} text={q ? 'Boshqa so‘z bilan qidiring.' : 'Xaridor saytda profil ochsa, shu yerda ko‘rinadi.'} />
        ) : (
          <>
            <ul className={list.loading ? 'opacity-60' : ''}>
              {data.items.map((c) => (
                <li key={c.id} className="border-t border-line first:border-0">
                  <a href={`#/customers/${c.id}`} className="grid gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-mist sm:grid-cols-[1.3fr_1fr_auto_auto] sm:items-center">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.status === 'blocked' && <Badge tone="danger">bloklangan</Badge>}
                    </span>
                    <span className="tabular truncate text-graphite">{displayPhone(c.phone)}</span>
                    <span className="tabular text-[13px] text-graphite sm:text-right">
                      {c.ordersCount} ta buyurtma · {money(c.totalSpentUZS)}
                    </span>
                    <span className="text-[12.5px] text-muted sm:w-28 sm:text-right">{date(c.createdAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => go('customers', { replace: true, query: { q, page: p > 1 ? p : undefined } })} />
          </>
        )}
      </section>
      <CustomerDrawer id={openId} onClose={() => go('customers', { query: { q, page: page > 1 ? page : undefined } })} onChanged={list.reload} />
    </>
  );
}

function CustomerDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUi();
  const detail = useLoad(() => (id ? api.customer(id) : Promise.resolve(null)), [id]);
  const d = detail.data;

  const toggleBlock = async () => {
    if (!d) return;
    const block = d.customer.status === 'active';
    if (block && !(await confirm({ title: `${d.customer.name} bloklansinmi?`, text: 'Mijoz profilidan chiqariladi va qayta kira olmaydi. Buyurtmalari saqlanib qoladi.', confirm: 'Bloklash', danger: true }))) return;
    try {
      const c = await api.setCustomerStatus(d.customer.id, block ? 'blocked' : 'active');
      detail.setData({ ...d, customer: c });
      onChanged();
      toast(block ? 'Mijoz bloklandi' : 'Blok olib tashlandi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const m = d?.measurements;
  return (
    <Overlay
      open={!!id}
      onClose={onClose}
      side
      title={d?.customer.name ?? 'Mijoz'}
      footer={
        d && (
          <button type="button" className={`btn ${d.customer.status === 'active' ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleBlock}>
            {d.customer.status === 'active' ? 'Bloklash' : 'Blokdan chiqarish'}
          </button>
        )
      }
    >
      {detail.error ? (
        <div className="p-5">
          <ErrorBox error={detail.error} />
        </div>
      ) : !d ? (
        <Skeleton rows={6} />
      ) : (
        <div className="space-y-6 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="tabular text-[15px]">{displayPhone(d.customer.phone)}</div>
              {d.customer.email && <div className="text-graphite">{d.customer.email}</div>}
            </div>
            <a className="btn btn-primary btn-sm" href={telHref(d.customer.phone)}>
              <Phone className="h-3.5 w-3.5" /> Qo‘ng‘iroq
            </a>
          </div>
          <Dl
            rows={[
              ['Ro‘yxatdan o‘tgan', date(d.customer.createdAt)],
              ['Oxirgi kirish', d.customer.lastLoginAt ? when(d.customer.lastLoginAt) : '—'],
              ['Xaridlar', `${d.customer.ordersCount} ta · ${money(d.customer.totalSpentUZS)}`],
              ['O‘lchamlar', m ? `bo‘y ${num(m.heightCm)}, ko‘krak ${num(m.bustCm)}, bel ${num(m.waistCm)}, son ${num(m.hipsCm)} sm` : 'kiritilmagan'],
            ]}
          />
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-graphite">Buyurtmalar</h3>
            {d.orders.length === 0 ? (
              <p className="text-graphite">Buyurtma yo‘q.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {d.orders.map((o) => (
                  <li key={o.id}>
                    <a href={`#/${o.kind === 'sample' ? 'samples' : 'orders'}/${o.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-mist">
                      <span className="min-w-0">
                        <span className="font-medium">{o.number}</span>
                        <span className="ml-2 text-[12.5px] text-muted">{when(o.createdAt)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {o.kind === 'fabric' && <span className="tabular text-[13px]">{money(o.totalUZS)}</span>}
                        <OrderBadge status={o.status} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {d.tailorRequests.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-graphite">Tikuv so‘rovlari</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {d.tailorRequests.map((r) => (
                  <li key={r.id}>
                    <a href={`#/tailoring/${r.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-mist">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{r.number}</span> · {findGarment(r.garmentKey)?.name.uz} → {r.tailor.atelierName}
                      </span>
                      <TailorRequestBadge status={r.status} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Overlay>
  );
}
