import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { AdminFabric } from '../../../shared/types';
import { CATEGORY_LABELS } from '../../../shared/catalog';
import { api, photoUrl } from '../api';
import { go, money, num, useLoad, type Route } from '../lib';
import { Badge, Chips, Empty, ErrorBox, PageHeader, SearchBox, Skeleton } from '../ui';
import { Swatch } from './FabricEditor';

type Filter = 'all' | 'active' | 'hidden' | 'low';
const LOW = 20;

export function Fabrics({ route }: { route: Route }) {
  const filter = (route.query.get('filter') as Filter | null) ?? 'all';
  const [search, setSearch] = useState('');
  const list = useLoad(() => api.fabrics(), []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((f) => {
      const low = f.colors.some((c) => c.active && c.stockM < LOW);
      if (filter === 'active' && f.status !== 'active') return false;
      if (filter === 'hidden' && f.status !== 'hidden') return false;
      if (filter === 'low' && !low) return false;
      if (q && ![f.name.uz, f.name.ru, f.name.en, f.id, f.seller.name, ...f.colors.map((c) => c.name.uz)].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list.data, filter, search]);

  const counts = useMemo(() => {
    const d = list.data ?? [];
    return {
      active: d.filter((f) => f.status === 'active').length,
      hidden: d.filter((f) => f.status === 'hidden').length,
      low: d.filter((f) => f.colors.some((c) => c.active && c.stockM < LOW)).length,
    };
  }, [list.data]);

  return (
    <>
      <PageHeader
        title="Matolar"
        sub="Saytdagi katalog. O‘zgarishlar saqlangan zahoti saytda ko‘rinadi."
        actions={
          <a href="#/fabrics/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Yangi mato
          </a>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips<Filter>
          value={filter}
          onChange={(f) => go('fabrics', { replace: true, query: { filter: f === 'all' ? undefined : f } })}
          options={[
            { id: 'all', label: 'Hammasi' },
            { id: 'active', label: 'Sotuvda', count: counts.active },
            { id: 'hidden', label: 'Yashirilgan', count: counts.hidden },
            { id: 'low', label: `Kam qolgan (< ${LOW} m)`, count: counts.low },
          ]}
          label="Filtr"
        />
        <SearchBox value={search} onChange={setSearch} placeholder="Mato yoki rang nomi" />
      </div>

      <section className="card overflow-hidden">
        {list.error ? (
          <div className="p-4">
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : !list.data ? (
          <Skeleton rows={7} />
        ) : rows.length === 0 ? (
          <Empty
            title={list.data.length ? 'Hech narsa topilmadi' : 'Katalog bo‘sh'}
            text={list.data.length ? 'Filtr yoki qidiruvni o‘zgartiring.' : 'Birinchi matoni qo‘shing — u darhol saytda chiqadi.'}
            action={
              !list.data.length && (
                <a href="#/fabrics/new" className="btn btn-primary">
                  Yangi mato
                </a>
              )
            }
          />
        ) : (
          <ul>
            {rows.map((f) => (
              <FabricRow key={f.id} f={f} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function FabricRow({ f }: { f: AdminFabric }) {
  const first = f.colors[0];
  // The seamless tile shows the cloth itself; product shots are mostly white background at this size.
  const photo = first?.photos?.tile || first?.photos?.swatch;
  const stock = f.colors.filter((c) => c.active).reduce((s, c) => s + c.stockM, 0);
  const low = f.colors.filter((c) => c.active && c.stockM < LOW);
  return (
    <li className="border-t border-line first:border-0">
      <a href={`#/fabrics/${encodeURIComponent(f.id)}`} className="flex items-center gap-4 px-4 py-3 hover:bg-mist">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-well">
          {photo ? <img src={photoUrl(photo)} alt="" className="h-full w-full object-cover" loading="lazy" /> : first ? <Swatch pattern={f.pattern} hex={first.hex} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{f.name.uz}</span>
            {f.status === 'hidden' && <Badge>Yashirilgan</Badge>}
            {f.organic && <Badge tone="ok">organik</Badge>}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-graphite">
            {CATEGORY_LABELS[f.category].uz} · {f.gsm} g/m² · eni {f.widthCm} sm · {f.seller.name}
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            {f.colors.slice(0, 12).map((c) => (
              <span key={c.id} title={`${c.name.uz}: ${num(c.stockM, c.stockM % 1 ? 1 : 0)} m`} className={`h-3.5 w-3.5 rounded-full ring-1 ring-black/10 ${c.active ? '' : 'opacity-30'}`} style={{ background: c.hex }} />
            ))}
            {f.colors.length > 12 && <span className="text-[12px] text-muted">+{f.colors.length - 12}</span>}
          </div>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="tabular font-medium">{money(f.priceUZS)}</div>
          <div className="text-[12.5px] text-graphite">1 metr</div>
        </div>
        <div className="hidden w-32 shrink-0 text-right md:block">
          <div className="tabular">{num(stock, stock % 1 ? 1 : 0)} m</div>
          <div className={`text-[12.5px] ${low.length ? 'text-danger' : 'text-graphite'}`}>{low.length ? `${low.length} ta rang kam` : `${f.colors.length} ta rang`}</div>
        </div>
      </a>
    </li>
  );
}
