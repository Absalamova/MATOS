import React, { useMemo, useState } from 'react';
import { Camera, Search, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { navigate, Route } from '../lib/router';
import { colorFamily, COLOR_FAMILIES, ColorFamily } from '../lib/colors';
import { pricePerMeter, formatNumber } from '../lib/format';
import { ProductCard } from '../components/ProductCard';
import { FabricCategory } from '../types';

type Weight = 'all' | 'light' | 'mid' | 'heavy';
type Sort = 'featured' | 'price-asc' | 'price-desc' | 'light-first' | 'drape';

const MATERIALS: { id: FabricCategory | 'all'; label: ReturnType<typeof L> }[] = [
  { id: 'all', label: L('Barchasi', 'Все', 'All') },
  { id: 'linen', label: L('Zig‘ir', 'Лён', 'Linen') },
  { id: 'silk', label: L('Ipak', 'Шёлк', 'Silk') },
  { id: 'cotton', label: L('Paxta', 'Хлопок', 'Cotton') },
  { id: 'wool', label: L('Jun', 'Шерсть', 'Wool') },
];

const WEIGHTS: { id: Weight; label: ReturnType<typeof L> }[] = [
  { id: 'light', label: L('Yengil, 150 g gacha', 'Лёгкие, до 150 г', 'Light, under 150 g') },
  { id: 'mid', label: L('O‘rta, 150–250 g', 'Средние, 150–250 г', 'Medium, 150–250 g') },
  { id: 'heavy', label: L('Qalin, 250 g dan', 'Плотные, от 250 г', 'Heavy, over 250 g') },
];

export function CatalogPage({ route }: { route: Route }) {
  const { t, lang, fabrics, currency, unit, open } = useApp();
  const q0 = route.query;
  const [query, setQuery] = useState(q0.get('q') ?? '');
  const [material, setMaterial] = useState<FabricCategory | 'all'>((q0.get('material') as FabricCategory) || 'all');
  const [weight, setWeight] = useState<Weight>((q0.get('weight') as Weight) || 'all');
  const [family, setFamily] = useState<ColorFamily | null>((q0.get('color') as ColorFamily) || null);
  const [organic, setOrganic] = useState(q0.get('organic') === '1');
  const [sort, setSort] = useState<Sort>((q0.get('sort') as Sort) || 'featured');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sync = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string | undefined> = {
      q: query || undefined,
      material: material !== 'all' ? material : undefined,
      weight: weight !== 'all' ? weight : undefined,
      color: family ?? undefined,
      organic: organic ? '1' : undefined,
      sort: sort !== 'featured' ? sort : undefined,
      ...patch,
    };
    navigate('catalog', { query: next, replace: true });
  };

  const results = useMemo(() => {
    const qq = query.trim().toLowerCase();
    const list = fabrics
      .map((f) => {
        const colors = family ? f.colors.filter((c) => colorFamily(c.hex) === family) : f.colors;
        return { f, color: colors[0] };
      })
      .filter(({ f, color }) => {
        if (!color) return false;
        if (material !== 'all' && f.category !== material) return false;
        if (weight === 'light' && f.gsm >= 150) return false;
        if (weight === 'mid' && (f.gsm < 150 || f.gsm > 250)) return false;
        if (weight === 'heavy' && f.gsm <= 250) return false;
        if (organic && !f.organic) return false;
        if (qq) {
          const hay = [f.name[lang], f.name.en, f.categoryLabel[lang], f.composition[lang], f.origin[lang], String(f.gsm), ...f.colors.map((c) => c.name[lang])]
            .join(' ')
            .toLowerCase();
          if (!qq.split(/\s+/).every((w) => hay.includes(w))) return false;
        }
        return true;
      });
    const by = [...list];
    if (sort === 'price-asc') by.sort((a, b) => pricePerMeter(a.f, currency) - pricePerMeter(b.f, currency));
    if (sort === 'price-desc') by.sort((a, b) => pricePerMeter(b.f, currency) - pricePerMeter(a.f, currency));
    if (sort === 'light-first') by.sort((a, b) => a.f.gsm - b.f.gsm);
    if (sort === 'drape') by.sort((a, b) => b.f.drapeFactor - a.f.drapeFactor);
    return by;
  }, [fabrics, query, material, weight, family, organic, sort, lang, currency]);

  const colourways = results.reduce((n, r) => n + (family ? r.f.colors.filter((c) => colorFamily(c.hex) === family).length : r.f.colors.length), 0);
  const active = (material !== 'all' ? 1 : 0) + (weight !== 'all' ? 1 : 0) + (family ? 1 : 0) + (organic ? 1 : 0);
  const reset = () => {
    setQuery('');
    setMaterial('all');
    setWeight('all');
    setFamily(null);
    setOrganic(false);
    navigate('catalog', { replace: true });
  };

  const filterGroups = (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">{t(L('Material', 'Материал', 'Material'))}</legend>
        <div className="flex flex-wrap gap-2">
          {MATERIALS.map((m) => (
            <button key={m.id} type="button" className="chip" aria-pressed={material === m.id} onClick={() => { setMaterial(m.id); sync({ material: m.id !== 'all' ? m.id : undefined }); }}>
              {t(m.label)}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={organic} onClick={() => { setOrganic(!organic); sync({ organic: !organic ? '1' : undefined }); }}>
            {t(L('Organik', 'Органик', 'Organic'))}
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">{t(L('Rang', 'Цвет', 'Colour'))}</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_FAMILIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip pl-1.5"
              aria-pressed={family === c.id}
              onClick={() => { const next = family === c.id ? null : c.id; setFamily(next); sync({ color: next ?? undefined }); }}
            >
              <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: c.swatch }} aria-hidden="true" />
              {t(c.label)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">{t(L('Qalinligi', 'Плотность', 'Weight'))}</legend>
        <div className="flex flex-wrap gap-2">
          {WEIGHTS.map((w) => (
            <button key={w.id} type="button" className="chip" aria-pressed={weight === w.id} onClick={() => { const next = weight === w.id ? 'all' : w.id; setWeight(next); sync({ weight: next !== 'all' ? next : undefined }); }}>
              {t(w.label)}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="wrap pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[40px] sm:text-[52px]">{t(UI.catalog)}</h1>
          <p className="mt-2 text-graphite">
            {t(L(`${results.length} ta mato, ${colourways} ta rang`, `${results.length} тканей, ${colourways} цветов`, `${results.length} fabrics, ${colourways} colourways`))}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <label className="relative block flex-1 lg:w-[320px]">
            <span className="sr-only">{t(L('Qidirish', 'Поиск', 'Search'))}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="field rounded-full pl-11"
              placeholder={t(L('Zig‘ir, ipak, ko‘k…', 'Лён, шёлк, синий…', 'Linen, silk, navy…'))}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => sync({ q: query || undefined })}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => open('search')}>
            <Camera className="h-4 w-4" strokeWidth={1.7} />
            {t(UI.photoSearch)}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label={t(L('Filtrlar', 'Фильтры', 'Filters'))}>
          <div className="sticky top-24">{filterGroups}</div>
        </aside>

        <section aria-label={t(L('Natijalar', 'Результаты', 'Results'))}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <button type="button" className="btn btn-secondary btn-sm lg:hidden" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.7} />
              {t(L('Filtrlar', 'Фильтры', 'Filters'))}
              {active > 0 && <span className="tabular rounded-full bg-tape px-1.5 text-[11px] font-semibold">{active}</span>}
            </button>
            {active > 0 && (
              <button type="button" className="hidden items-center gap-1 text-[13.5px] text-graphite hover:text-ink lg:inline-flex" onClick={reset}>
                <X className="h-3.5 w-3.5" />
                {t(L('Filtrlarni tozalash', 'Сбросить фильтры', 'Clear filters'))}
              </button>
            )}
            <label className="ml-auto flex items-center gap-2 text-[13.5px] text-graphite">
              <span className="hidden sm:inline">{t(L('Saralash', 'Сортировка', 'Sort'))}</span>
              <select className="field h-10 w-auto rounded-full py-0 text-[14px]" value={sort} onChange={(e) => { setSort(e.target.value as Sort); sync({ sort: e.target.value !== 'featured' ? e.target.value : undefined }); }}>
                <option value="featured">{t(L('Tavsiya etilgan', 'Рекомендуемые', 'Recommended'))}</option>
                <option value="price-asc">{t(L('Arzonroq avval', 'Сначала дешевле', 'Price: low to high'))}</option>
                <option value="price-desc">{t(L('Qimmatroq avval', 'Сначала дороже', 'Price: high to low'))}</option>
                <option value="light-first">{t(L('Yengilroq avval', 'Сначала лёгкие', 'Lightest first'))}</option>
                <option value="drape">{t(L('Yumshoq tushadigan', 'Самые струящиеся', 'Most fluid drape'))}</option>
              </select>
            </label>
          </div>
          {filtersOpen && (
            <div className="mb-8 rounded-xl border border-line p-5 lg:hidden">
              {filterGroups}
              <div className="mt-6 flex gap-3 border-t border-line pt-5">
                {active > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                    <X className="h-4 w-4" />
                    {t(L('Tozalash', 'Сбросить', 'Clear'))}
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => setFiltersOpen(false)}>
                  {t(L(`${results.length} ta matoni ko‘rsatish`, `Показать ${results.length}`, `Show ${results.length}`))}
                </button>
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <p className="font-display text-[26px]">{t(L('Bunday mato topilmadi', 'Таких тканей нет', 'No fabrics match'))}</p>
              <p className="mx-auto mt-2 max-w-md text-graphite">
                {t(L('Filtrlardan birini olib tashlang yoki kiyim rasmi orqali qidiring.', 'Уберите один из фильтров или найдите ткань по фото одежды.', 'Remove a filter or search with a photo of the garment.'))}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" className="btn btn-primary" onClick={reset}>{t(L('Filtrlarni tozalash', 'Сбросить фильтры', 'Clear filters'))}</button>
                <button type="button" className="btn btn-secondary" onClick={() => open('search')}>{t(UI.photoSearch)}</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3">
              {results.map(({ f, color }, i) => (
                <ProductCard key={`${f.id}-${family ?? ''}`} fabric={f} initialColor={color} eager={i < 3} />
              ))}
            </div>
          )}
          <p className="mt-12 text-[13px] text-muted">
            {unit === 'metric'
              ? t(L('Narxlar 1 metr uchun.', 'Цены за 1 метр.', 'Prices per metre.'))
              : t(L('Narxlar 1 yard uchun.', 'Цены за 1 ярд.', 'Prices per yard.'))}{' '}
            {t(L(
              `Bir buyurtmada ${formatNumber(5, lang)} tagacha bepul namuna.`,
              `До ${formatNumber(5, lang)} бесплатных образцов в заказе.`,
              `Up to ${formatNumber(5, lang)} free samples per order.`,
            ))}
          </p>
        </section>
      </div>
    </div>
  );
}
