import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Star } from 'lucide-react';
import { useApp } from '../state/app';
import { href, navigate, Route } from '../lib/router';
import { L, UI } from '../lib/i18n';
import { formatLength, formatMoney, formatNumber, pricePerMeter, pricePerUnit } from '../lib/format';
import { requiredMeters, suitability } from '../lib/measure';
import { GARMENTS } from '../data/garments';
import { findColor } from '../data/fabrics';
import { loadTailors } from '../lib/tailors';
import { specialtyFor } from '../data/tailors';
import { ColorChip, FabricImage } from '../components/ui/FabricImage';
import { TapeMeasure } from '../components/ui/TapeMeasure';
import { GarmentIcon } from '../components/ui/GarmentIcon';
import { FabricPhotos } from '../types';

const VIEWS: { id: keyof FabricPhotos; label: ReturnType<typeof L> }[] = [
  { id: 'swatch', label: L('Yuzasi', 'Фактура', 'Surface') },
  { id: 'hang', label: L('Tushishi', 'Драпировка', 'Drape') },
  { id: 'roll', label: L('Rulon', 'Рулон', 'Roll') },
  { id: 'ruler', label: L('O‘lcham bilan', 'С линейкой', 'With ruler') },
];

export function ProductPage({ route }: { route: Route }) {
  const app = useApp();
  const { t, lang, currency, unit, fabricById, addToCart, hasSample, toggleSample, measurements } = app;
  const fabric = fabricById(route.id ?? '');
  const [colorId, setColorId] = useState(route.query.get('color') ?? undefined);
  const [view, setView] = useState<keyof FabricPhotos>('swatch');
  const [meters, setMeters] = useState(2);

  useEffect(() => {
    setColorId(route.query.get('color') ?? undefined);
    window.scrollTo(0, 0);
  }, [route.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const garmentsRanked = useMemo(
    () => (fabric ? [...GARMENTS].sort((a, b) => suitability(b, fabric) - suitability(a, fabric)).slice(0, 4) : []),
    [fabric],
  );
  const tailors = useMemo(() => {
    if (!fabric) return [];
    return loadTailors()
      .filter((tl) => specialtyFor(tl.specialtyKey).garments.some((g) => fabric.bestFor.includes(g)))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3);
  }, [fabric]);

  useEffect(() => {
    if (fabric && garmentsRanked[0]) setMeters(requiredMeters(garmentsRanked[0], fabric, measurements).meters);
  }, [fabric?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fabric) {
    return (
      <div className="wrap py-24 text-center">
        <h1 className="text-[36px]">{t(L('Mato topilmadi', 'Ткань не найдена', 'Fabric not found'))}</h1>
        <p className="mt-3 text-graphite">{t(L('U sotuvdan olingan bo‘lishi mumkin.', 'Возможно, её сняли с продажи.', 'It may no longer be on sale.'))}</p>
        <a className="btn btn-primary mt-8" href={href('catalog')}>{t(L('Katalogga qaytish', 'Вернуться в каталог', 'Back to catalog'))}</a>
      </div>
    );
  }

  const color = findColor(fabric, colorId);
  const hasPhotos = !!color.photos;
  const total = pricePerMeter(fabric, currency) * meters;
  const sampled = hasSample(fabric.id, color.id);
  const firstGarment = garmentsRanked[0];
  const need = firstGarment ? requiredMeters(firstGarment, fabric, measurements) : null;
  const studioLink = (g?: string) => href('studio', { query: { fabric: fabric.id, color: color.id, garment: g ?? firstGarment?.typeKey } });

  const specs: [string, string][] = [
    [t(UI.composition), t(fabric.composition)],
    [t(UI.weight), `${fabric.gsm} g/m² · ${fabric.ozPerSqYd} oz`],
    [t(UI.width), unit === 'metric' ? `${fabric.widthCm} sm` : `${fabric.widthInches}″`],
    [t(UI.drape), `${formatNumber(fabric.drapeFactor, lang, 1)} / 10 — ${t(fabric.drapeText)}`],
    [t(UI.shrinkage), `~${formatNumber(fabric.shrinkageRate, lang, 1)}%`],
    [t(UI.care), t(fabric.care)],
    [t(L('Kelib chiqishi', 'Происхождение', 'Origin')), t(fabric.origin)],
    [t(L('Sertifikatlar', 'Сертификаты', 'Certificates')), fabric.certifications.join(', ')],
  ];

  const pickColor = (id: string) => {
    setColorId(id);
    navigate('fabric', { id: fabric.id, query: { color: id }, replace: true });
  };

  return (
    <div className="pb-28 lg:pb-0">
      <div className="wrap pt-6">
        <nav aria-label={t(L('Yo‘l', 'Навигация', 'Breadcrumb'))} className="text-[13px] text-graphite">
          <a href={href('catalog')} className="hover:text-ink">{t(UI.catalog)}</a>
          <span className="mx-2 text-muted">/</span>
          <a href={href('catalog', { query: { material: fabric.category } })} className="hover:text-ink">{t(fabric.categoryLabel)}</a>
          <span className="mx-2 text-muted">/</span>
          <span className="text-ink">{t(fabric.name)}</span>
        </nav>
      </div>

      <div className="wrap mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[6px] bg-well">
            <FabricImage key={`${color.id}-${view}`} fabric={fabric} color={color} kind={view} alt={`${t(fabric.name)}, ${t(color.name)}`} eager className="animate-fade" />
          </div>
          {hasPhotos ? (
            <div className="mt-3 grid grid-cols-4 gap-3" role="tablist" aria-label={t(L('Suratlar', 'Фото', 'Photos'))}>
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={view === v.id}
                  onClick={() => setView(v.id)}
                  className={`group text-left`}
                >
                  <span className={`block aspect-square overflow-hidden rounded-[4px] bg-well ring-offset-2 transition ${view === v.id ? 'ring-2 ring-ink' : 'opacity-80 group-hover:opacity-100'}`}>
                    <FabricImage fabric={fabric} color={color} kind={v.id} alt="" />
                  </span>
                  <span className="mt-1.5 block text-[12.5px] text-graphite">{t(v.label)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-graphite">
              {t(L('Bu rang uchun surat tayyorlanmoqda. Rangni aniq ko‘rish uchun bepul namuna oling.', 'Фото этого цвета готовится. Закажите бесплатный образец, чтобы увидеть цвет вживую.', 'A photo of this colour is on its way. Order a free sample to see it in person.'))}
            </p>
          )}
        </div>

        {/* Buy box */}
        <div className="lg:pt-2">
          <p className="text-[13.5px] text-graphite">
            {fabric.seller.name}, {t(fabric.seller.city)}
          </p>
          <h1 className="mt-2 text-[38px] sm:text-[46px]">{t(fabric.name)}</h1>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="tabular text-[24px] font-medium">{formatMoney(pricePerUnit(fabric, currency, unit), currency, lang)}</span>
            <span className="text-graphite">{t(unit === 'metric' ? UI.perMeter : UI.perYard)}</span>
          </p>
          <p className="mt-4 max-w-[60ch] text-graphite">{t(fabric.description)}</p>

          <div className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="label mb-0">{t(UI.colour)}</span>
              <span className="text-[14px]">{t(color.name)}</span>
            </div>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t(UI.colour)}>
              {fabric.colors.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={c.id === color.id} aria-label={t(c.name)} title={t(c.name)} onClick={() => pickColor(c.id)} className="rounded-full p-1">
                  <ColorChip fabric={fabric} color={c} size={38} selected={c.id === color.id} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <TapeMeasure
              meters={meters}
              onChange={setMeters}
              unit={unit}
              lang={lang}
              label={t(UI.length)}
              hint={
                need && firstGarment
                  ? {
                      meters: need.meters,
                      label: t(L(
                        `${firstGarment.name.uz} uchun ${formatLength(need.meters, unit, lang)} kerak`,
                        `Для «${firstGarment.name.ru}» нужно ${formatLength(need.meters, unit, lang)}`,
                        `${firstGarment.name.en} needs ${formatLength(need.meters, unit, lang)}`,
                      )),
                    }
                  : undefined
              }
            />
          </div>

          <div className="mt-8 flex items-baseline justify-between border-t border-line pt-5">
            <span className="text-graphite">{t(UI.total)}</span>
            <span className="tabular text-[26px] font-medium">{formatMoney(total, currency, lang)}</span>
          </div>

          <div className="mt-5 hidden flex-col gap-3 lg:flex">
            <button type="button" className="btn btn-primary w-full" onClick={() => addToCart(fabric.id, color.id, meters)}>
              {t(UI.addToBag)}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={`btn ${sampled ? 'btn-tape' : 'btn-secondary'}`} aria-pressed={sampled} onClick={() => toggleSample(fabric.id, color.id)}>
                {sampled ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {sampled ? t(UI.inSamples) : t(UI.samples)}
              </button>
              <a className="btn btn-secondary" href={studioLink()}>
                {t(UI.tryOn3D)}
              </a>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-muted">
            {t(L('Bepul namuna — 10×10 sm bo‘lak, Toshkent bo‘ylab 1–2 kunda yetkaziladi.', 'Бесплатный образец — отрез 10×10 см, доставка по Ташкенту 1–2 дня.', 'A free sample is a 10×10 cm cutting, delivered in Tashkent within 1–2 days.'))}
          </p>

          <dl className="mt-10 divide-y divide-line border-y border-line">
            {specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-4 py-3.5 text-[14px] sm:grid-cols-[160px_1fr]">
                <dt className="text-graphite">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* What to sew */}
      <section className="wrap mt-20">
        <h2 className="text-[30px] sm:text-[36px]">{t(L('Bu matodan nima tikiladi', 'Что сшить из этой ткани', 'What to make with it'))}</h2>
        <p className="mt-2 max-w-[60ch] text-graphite">
          {t(L('Metraj bo‘yingiz va o‘lchamingizga qarab hisoblangan. 3D’da shu mato va rangda ko‘ring.', 'Метраж рассчитан по вашему росту и размеру. Посмотрите фасон в 3D в этой ткани.', 'Lengths are calculated for your height and size. See each one in 3D in this fabric.'))}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {garmentsRanked.map((g) => {
            const r = requiredMeters(g, fabric, measurements);
            return (
              <a key={g.id} href={studioLink(g.typeKey)} className="group rounded-xl border border-line p-5 transition-colors hover:border-ink">
                <GarmentIcon type={g.typeKey} className="h-20 w-14 text-ink" />
                <div className="mt-4 font-medium leading-snug">{t(g.name)}</div>
                <div className="tabular mt-1 text-[13.5px] text-graphite">
                  {formatLength(r.meters, unit, lang)} · {formatMoney(pricePerMeter(fabric, currency) * r.meters, currency, lang)}
                </div>
                <div className="mt-4 text-[13.5px] underline decoration-line underline-offset-4 group-hover:decoration-ink">{t(UI.tryOn3D)}</div>
              </a>
            );
          })}
        </div>
      </section>

      {tailors.length > 0 && (
        <section className="wrap mt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[30px] sm:text-[36px]">{t(L('Bu matoni tikadigan ustalar', 'Мастера для этой ткани', 'Tailors who work with it'))}</h2>
            <a href={href('tailors')} className="hidden text-[14px] underline decoration-line underline-offset-4 hover:decoration-ink sm:block">{t(L('Barcha tikuvchilar', 'Все портные', 'All tailors'))}</a>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {tailors.map((tl) => (
              <a key={tl.id} href={href('tailors', { query: { book: tl.id, fabric: fabric.id, color: color.id } })} className="rounded-xl border border-line p-5 transition-colors hover:border-ink">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{tl.atelierName}</div>
                    <div className="text-[13.5px] text-graphite">{tl.name} · {tl.city}</div>
                  </div>
                  {tl.rating ? (
                    <span className="tabular inline-flex items-center gap-1 text-[13.5px]"><Star className="h-3.5 w-3.5 fill-ink" />{formatNumber(tl.rating, lang, 1)}</span>
                  ) : (
                    <span className="text-[12.5px] text-graphite">{t(L('Yangi', 'Новый', 'New'))}</span>
                  )}
                </div>
                <div className="mt-4 text-[13.5px] text-graphite">{t(specialtyFor(tl.specialtyKey).label)}</div>
                <div className="tabular mt-1 text-[13.5px]">{t(L('Tikish', 'Пошив', 'Sewing'))}: {formatMoney(tl.priceStartingUZS, 'UZS', lang)} {t(L('dan', 'и выше', '+'))}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Mobile buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2">
          <button type="button" className={`icon-btn h-[46px] w-[46px] shrink-0 border ${sampled ? 'border-tape bg-tape' : 'border-line'}`} aria-pressed={sampled} aria-label={sampled ? t(UI.inSamples) : t(UI.samples)} onClick={() => toggleSample(fabric.id, color.id)}>
            {sampled ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
          <a className="btn btn-secondary shrink-0 px-4" href={studioLink()}>3D</a>
          <button type="button" className="btn btn-primary flex-1 px-3" onClick={() => addToCart(fabric.id, color.id, meters)}>
            <span className="truncate">{t(UI.addToBag)}</span>
            <span className="tabular opacity-80">· {formatMoney(total, currency, lang)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
