import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStats } from '../Layout';
import { dayLabel, money, num, when } from '../lib';
import { Empty, OrderBadge, PageHeader, Skeleton } from '../ui';
import { displayPhone } from '../../../shared/phone';

export function Dashboard() {
  const { stats } = useStats();
  const [range, setRange] = useState<7 | 30>(7);

  const days = useMemo(() => (stats ? stats.ordersByDay.slice(-range) : []), [stats, range]);
  const max = Math.max(1, ...days.map((d) => d.totalUZS));
  const periodTotal = days.reduce((s, d) => s + d.totalUZS, 0);
  const periodCount = days.reduce((s, d) => s + d.count, 0);

  if (!stats) {
    return (
      <>
        <PageHeader title="Umumiy ko‘rinish" />
        <div className="card">
          <Skeleton rows={6} />
        </div>
      </>
    );
  }

  const c = stats.counts;
  const todo = [
    c.newOrders > 0 && { text: `${c.newOrders} ta yangi buyurtma tasdiqlashni kutmoqda`, href: '#/orders?status=new', cta: 'Ko‘rish' },
    c.newSamples > 0 && { text: `${c.newSamples} ta bepul namuna so‘rovini qadoqlash kerak`, href: '#/samples?status=new', cta: 'Ochish' },
    c.newTailorRequests > 0 && { text: `${c.newTailorRequests} ta tikuv so‘rovi bo‘yicha mijozga qo‘ng‘iroq qiling`, href: '#/tailoring?status=new', cta: 'Ochish' },
    c.pendingTailors > 0 && { text: `${c.pendingTailors} ta atelye arizasi tekshiruvni kutmoqda`, href: '#/tailors?status=pending', cta: 'Tekshirish' },
    c.lowStock > 0 && { text: `${c.lowStock} ta rang omborda kam qoldi`, href: '#/fabrics?filter=low', cta: 'Ko‘rish' },
  ].filter(Boolean) as { text: string; href: string; cta: string }[];

  const kpis = [
    { label: 'Bugungi savdo', value: money(stats.revenue.todayUZS), href: '#/orders' },
    { label: 'Oxirgi 7 kun', value: money(stats.revenue.weekUZS), href: '#/orders' },
    { label: 'Oxirgi 30 kun', value: money(stats.revenue.monthUZS), href: '#/orders' },
    { label: 'Mijozlar', value: num(c.customers), href: '#/customers' },
  ];

  return (
    <>
      <PageHeader title="Umumiy ko‘rinish" sub="Savdo bekor qilinmagan mato buyurtmalari bo‘yicha hisoblanadi." />

      {todo.length > 0 ? (
        <section className="card mb-5 border-[#efdc9b] bg-tape-soft" aria-labelledby="todo-h">
          <h2 id="todo-h" className="flex items-center gap-2 px-5 pt-4 font-sans text-[14px] font-semibold">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.8} /> Bugun e’tibor kerak
          </h2>
          <ul className="px-5 pb-2 pt-1">
            {todo.map((x) => (
              <li key={x.text} className="flex items-center justify-between gap-3 border-b border-[#f0e3b4] py-2.5 last:border-0">
                <span>{x.text}</span>
                <a href={x.href} className="shrink-0 font-medium underline underline-offset-4">
                  {x.cta}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mb-5 rounded-xl border border-line bg-paper px-5 py-3.5 text-graphite">Hamma so‘rovlarga javob berilgan. Yangi buyurtma kelsa, shu yerda ko‘rinadi.</p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <a key={k.label} href={k.href} className="card block p-4 transition-colors hover:border-ink sm:p-5">
            <div className="text-[13px] text-graphite">{k.label}</div>
            <div className="tabular mt-2 break-words font-display text-[22px] leading-tight sm:text-[26px]">{k.value}</div>
          </a>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-5" aria-labelledby="chart-h">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="chart-h" className="font-sans text-[15px] font-semibold">
                Savdo dinamikasi
              </h2>
              <p className="tabular text-[13px] text-graphite">
                {range} kunda {num(periodCount)} ta buyurtma · {money(periodTotal)}
              </p>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-line text-[13px]" role="group" aria-label="Davr">
              {([7, 30] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} className={`px-3 py-1.5 ${range === r ? 'bg-ink text-white' : 'bg-paper hover:bg-well'}`}>
                  {r} kun
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-48 items-end gap-[3px] sm:gap-1.5" role="img" aria-label={`Oxirgi ${range} kunlik savdo: jami ${money(periodTotal)}`}>
            {days.map((d, i) => {
              const today = i === days.length - 1;
              return (
                <div key={d.date} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                  <div
                    className={`w-full rounded-t-[3px] ${today ? 'bg-tape' : 'bg-ink group-hover:bg-ink-soft'}`}
                    style={{ height: `${d.totalUZS ? Math.max(3, (d.totalUZS / max) * 100) : 0}%`, minHeight: d.totalUZS ? 3 : 1, opacity: d.totalUZS ? 1 : 0.15 }}
                  />
                  {(range === 7 || i % 5 === 4 || today) && <span className="text-[10.5px] text-muted">{dayLabel(d.date)}</span>}
                  <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] text-white opacity-0 group-hover:opacity-100">
                    {dayLabel(d.date)}: {money(d.totalUZS)} · {d.count} ta
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card" aria-labelledby="stock-h">
          <div className="flex items-baseline justify-between px-5 pt-4">
            <h2 id="stock-h" className="font-sans text-[15px] font-semibold">
              Kam qolgan ranglar
            </h2>
            <a href="#/fabrics?filter=low" className="text-[13px] text-graphite underline underline-offset-4 hover:text-ink">
              Matolar
            </a>
          </div>
          {stats.lowStock.length === 0 ? (
            <Empty title="Zaxira yetarli" text="Barcha faol ranglarda kamida 20 m bor." />
          ) : (
            <ul className="px-5 pb-3 pt-2">
              {stats.lowStock.slice(0, 7).map((x) => (
                <li key={x.colorId} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                  <a href={`#/fabrics/${encodeURIComponent(x.fabricId)}`} className="min-w-0 truncate hover:underline">
                    {x.fabricName}, {x.colorName}
                  </a>
                  <span className={`tabular shrink-0 text-[13px] font-medium ${x.stockM < 1 ? 'text-danger' : ''}`}>{x.stockM < 0.5 ? 'tugagan' : `${num(x.stockM, x.stockM % 1 ? 1 : 0)} m`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-5" aria-labelledby="latest-h">
        <div className="flex items-baseline justify-between px-5 pt-4">
          <h2 id="latest-h" className="font-sans text-[15px] font-semibold">
            So‘nggi buyurtmalar
          </h2>
          <a href="#/orders" className="text-[13px] text-graphite underline underline-offset-4 hover:text-ink">
            Barchasi
          </a>
        </div>
        {stats.latest.length === 0 ? (
          <Empty title="Hali buyurtma yo‘q" text="Saytdan birinchi buyurtma kelishi bilan shu yerda paydo bo‘ladi." />
        ) : (
          <ul className="mt-2">
            {stats.latest.map((o) => (
              <li key={o.id} className={o.status === 'new' ? 'needs-action' : ''}>
                <a href={`#/${o.kind === 'sample' ? 'samples' : 'orders'}/${o.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-t border-line px-5 py-3 hover:bg-mist sm:grid-cols-[110px_1fr_auto_auto]">
                  <span className="font-medium">{o.number}</span>
                  <span className="order-3 min-w-0 truncate text-graphite sm:order-none">
                    {o.customerName} · {displayPhone(o.customerPhone)}
                  </span>
                  <span className="tabular hidden text-right sm:block">{o.kind === 'fabric' ? money(o.totalUZS) : `${o.items.length} ta namuna`}</span>
                  <span className="flex items-center justify-end gap-3">
                    <span className="hidden text-[12.5px] text-muted md:inline">{when(o.createdAt)}</span>
                    <OrderBadge status={o.status} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
