import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useApp } from '../state/app';
import { href, Route } from '../lib/router';
import { L, UI } from '../lib/i18n';
import { asset, formatMoney, formatNumber, pricePerUnit } from '../lib/format';
import { ProductCard } from '../components/ProductCard';
import { FabricImage } from '../components/ui/FabricImage';
import { specialtyFor } from '../data/tailors';
import { GARMENTS } from '../data/garments';
import { ColorOption, Fabric } from '../types';

/** Hero: a fabric sample book — real colourways as strips you can open. */
function SwatchBook() {
  const { t, lang, currency, unit, fabrics } = useApp();
  const strips = useMemo(() => {
    const pick: { f: Fabric; c: ColorOption }[] = [];
    const order = ['ol-navy', 'wl-cinnamon', 'ol-blush', 'sc-emerald', 'ad-terracotta', 'ol-glacier', 'wl-white', 'mj-camel', 'ol-daffodil', 'sc-ruby', 'ct-olive', 'ol-slate', 'gl-navy', 'wl-apple'];
    for (const id of order) {
      const f = fabrics.find((x) => x.colors.some((c) => c.id === id));
      if (f) pick.push({ f, c: f.colors.find((c) => c.id === id)! });
    }
    // Fill up with other colourways when the seller changed the range.
    for (const f of fabrics) {
      for (const c of f.colors) {
        if (pick.length >= order.length) break;
        if (!pick.some((p) => p.c.id === c.id)) pick.push({ f, c });
      }
    }
    return pick;
  }, [fabrics]);
  const [activeRaw, setActive] = useState(3);
  const active = Math.min(activeRaw, Math.max(0, strips.length - 1));

  return (
    <div className="flex h-[420px] gap-[3px] sm:h-[520px] lg:h-[600px]" role="list" aria-label={t(L('Matolar namunasi', 'Образцы тканей', 'Fabric samples'))}>
      {strips.map(({ f, c }, i) => {
        const on = i === active;
        return (
          <a
            role="listitem"
            key={c.id}
            href={href('fabric', { id: f.id, query: { color: c.id } })}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            aria-label={`${t(f.name)}, ${t(c.name)}`}
            className={`relative block min-w-0 overflow-hidden bg-well animate-rise ${i > 7 ? 'max-sm:hidden' : ''}`}
            style={{ flex: on ? '11 1 0' : '1 1 0', transition: 'flex 0.55s cubic-bezier(0.2,0.7,0.2,1)', animationDelay: `${i * 28}ms`, borderRadius: 3 }}
          >
            <span className="absolute inset-0">
              <FabricImage fabric={f} color={c} kind={on ? 'swatch' : 'tile'} alt="" eager={i < 6} />
            </span>
            <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-16 text-white transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-0'}`}>
              <span className="block text-[15px] font-medium">{t(f.name)}</span>
              <span className="block text-[13px] opacity-90">
                {t(c.name)} · {formatMoney(pricePerUnit(f, currency, unit), currency, lang)}
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

export function HomePage({ route }: { route: Route }) {
  const { t, lang, fabrics, open, tailors: allTailors, settings } = useApp();
  const tailors = useMemo(() => {
    const rated = allTailors.filter((x) => x.rating);
    return (rated.length >= 3 ? rated : allTailors).slice(0, 3);
  }, [allTailors]);
  const colorways = fabrics.reduce((n, f) => n + f.colors.length, 0);

  useEffect(() => {
    const s = route.query.get('section');
    if (s) document.getElementById(s)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo(0, 0);
  }, [route.query]);

  const featured = ['organic-linen', 'silk-crepe', 'margilan-adras', 'washed-linen']
    .map((id) => fabrics.find((f) => f.id === id))
    .filter(Boolean) as Fabric[];

  const steps = [
    {
      title: L('Rasm yoki katalog', 'Фото или каталог', 'Photo or catalog'),
      text: L('Instagram’da yoqqan kiyim rasmidan rang va mato turini aniqlaymiz.', 'По фото наряда из Instagram определим цвет и тип ткани.', 'We read the colour and cloth type from an outfit photo.'),
      cta: L('Rasm yuklash', 'Загрузить фото', 'Upload a photo'),
      action: () => open('search'),
    },
    {
      title: L('Bepul namuna', 'Бесплатный образец', 'Free samples'),
      text: L('5 tagacha 10×10 sm bo‘lak uyingizga keladi — ushlab, yorug‘da ko‘ring.', 'До 5 отрезов 10×10 см приедут домой — потрогайте и посмотрите при свете.', 'Up to five 10×10 cm cuttings come to your door — feel them in daylight.'),
      cta: L('Namuna tanlash', 'Выбрать образцы', 'Pick samples'),
      link: href('catalog'),
    },
    {
      title: L('3D’da kiyib ko‘ring', 'Примерьте в 3D', 'Try it on in 3D'),
      text: L(`O‘z o‘lchamingizdagi manekenda ${GARMENTS.length} ta fason va kerakli metraj.`, `${GARMENTS.length} фасонов на манекене ваших размеров и точный метраж.`, `${GARMENTS.length} styles on a mannequin with your measurements, plus exact length.`),
      cta: L('Studiyani ochish', 'Открыть студию', 'Open the studio'),
      link: href('studio'),
    },
    {
      title: L('Tikuvchiga topshiring', 'Отдайте портному', 'Hand it to a tailor'),
      text: L('Atelye buyurtmani mato va o‘lchamlaringiz bilan birga oladi.', 'Ателье получит заказ вместе с тканью и вашими мерками.', 'The atelier receives your order with the fabric and your measurements.'),
      cta: L('Tikuvchi tanlash', 'Выбрать портного', 'Choose a tailor'),
      link: href('tailors'),
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="wrap grid items-center gap-10 pt-10 sm:pt-14 lg:grid-cols-[1fr_1.25fr] lg:gap-14 lg:pt-16">
        <div className="max-w-xl">
          <h1 className="text-[46px] leading-[1.02] sm:text-[64px] lg:text-[76px]">
            {t(L('Matoni tanlang. Ushlab ko‘ring. Kiyib ko‘ring.', 'Выберите ткань. Потрогайте. Примерьте.', 'Pick the fabric. Feel it. Try it on.'))}
          </h1>
          <p className="mt-6 max-w-[52ch] text-[16.5px] leading-relaxed text-graphite">
            {t(L(
              'Ijtimoiy tarmoqda ko‘rgan kiyimingizga mos matoni rasm orqali toping, bepul namuna oling, 3D manekenda o‘z o‘lchamingizda ko‘ring va tikuvchiga topshiring.',
              'Найдите ткань по фото наряда из соцсетей, закажите бесплатный образец, примерьте в 3D по своим меркам и отдайте портному.',
              'Find the fabric from a photo of an outfit you saw online, get a free sample, try the garment on in 3D in your size, and hand it to a tailor.',
            ))}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={() => open('search')}>
              {t(UI.photoSearch)}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => open('style')}>
              {t(UI.styleAdvisor)}
            </button>
            <a className="btn btn-secondary" href={href('catalog')}>
              {t(L('Katalogni ko‘rish', 'Смотреть каталог', 'Browse the catalog'))}
            </a>
          </div>
          <p className="tabular mt-8 text-[13.5px] text-muted">
            {t(L(
              `${fabrics.length} mato · ${colorways} rang · ${formatNumber(allTailors.length, lang)} atelye`,
              `${fabrics.length} тканей · ${colorways} цветов · ${formatNumber(allTailors.length, lang)} ателье`,
              `${fabrics.length} fabrics · ${colorways} colourways · ${formatNumber(allTailors.length, lang)} ateliers`,
            ))}
          </p>
        </div>
        <SwatchBook />
      </section>

      {/* How it works */}
      <section className="wrap mt-24 sm:mt-32" aria-labelledby="how">
        <h2 id="how" className="max-w-2xl text-[34px] sm:text-[44px]">
          {t(L('Rasmdan tayyor kiyimgacha — to‘rt qadam', 'От фото до готовой вещи — четыре шага', 'From a photo to a finished garment in four steps'))}
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-col bg-paper p-6 sm:p-7">
              <span className="tabular font-display text-[40px] leading-none text-muted">{i + 1}</span>
              <h3 className="mt-6 text-[22px]">{t(s.title)}</h3>
              <p className="mt-2 flex-1 text-[14.5px] text-graphite">{t(s.text)}</p>
              {s.link ? (
                <a href={s.link} className="mt-6 self-start text-[14px] underline decoration-line underline-offset-4 hover:decoration-ink">{t(s.cta)}</a>
              ) : (
                <button type="button" onClick={s.action} className="mt-6 self-start text-[14px] underline decoration-line underline-offset-4 hover:decoration-ink">{t(s.cta)}</button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* 3D studio */}
      <section className="mt-24 bg-mist sm:mt-32" aria-labelledby="studio">
        <div className="wrap grid items-center gap-10 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <a href={href('studio')} className="block overflow-hidden rounded-[6px]" aria-hidden="true" tabIndex={-1}>
            <img src={asset('images/studio/preview.jpg')} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
          </a>
          <div className="max-w-lg">
            <h2 id="studio" className="text-[34px] sm:text-[44px]">{t(L('Tikishdan oldin kiyib ko‘ring', 'Примерьте до пошива', 'Try it on before it’s sewn'))}</h2>
            <p className="mt-4 text-graphite">
              {t(L(
                'Bo‘y, ko‘krak, bel va son o‘lchamingizni kiriting — maneken siz bo‘ladi. Mato fotosuratdan olingan teksturada, haqiqiy tushishi bilan ko‘rinadi: ipak oqadi, kanvas shaklni ushlaydi. Har bir fason uchun kerakli metr ham hisoblanadi.',
                'Введите рост, грудь, талию и бёдра — манекен станет вашим. Ткань показана с фотофактурой и реальной драпировкой: шёлк струится, канвас держит форму. Для каждого фасона считается нужный метраж.',
                'Enter height, bust, waist and hips and the mannequin becomes you. Fabric is shown with its photographed texture and real drape: silk flows, canvas holds its shape. Each style also tells you how much cloth to buy.',
              ))}
            </p>
            <a className="btn btn-primary mt-8" href={href('studio')}>{t(L('3D studiyani ochish', 'Открыть 3D-студию', 'Open the 3D studio'))}</a>
          </div>
        </div>
      </section>

      {/* Catalog preview */}
      <section className="wrap mt-24 sm:mt-32" aria-labelledby="fabrics">
        <div className="flex items-end justify-between gap-6">
          <h2 id="fabrics" className="text-[34px] sm:text-[44px]">{t(L('Katalogdan', 'Из каталога', 'From the catalog'))}</h2>
          <a href={href('catalog')} className="shrink-0 text-[14px] underline decoration-line underline-offset-4 hover:decoration-ink">{t(L('Barcha matolar', 'Все ткани', 'All fabrics'))}</a>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {featured.map((f) => (
            <ProductCard key={f.id} fabric={f} />
          ))}
        </div>
      </section>

      {/* Samples */}
      <section id="samples" className="wrap mt-24 scroll-mt-24 sm:mt-32" aria-labelledby="samples-h">
        <div className="grid items-center gap-12 rounded-2xl bg-tape-soft px-6 py-12 sm:px-10 lg:grid-cols-2 lg:px-14 lg:py-16">
          <div>
            <h2 id="samples-h" className="text-[34px] sm:text-[44px]">{t(L('Avval namuna, keyin xarid', 'Сначала образец, потом покупка', 'Sample first, then buy'))}</h2>
            <ul className="mt-6 space-y-3 text-[15.5px]">
              <li>{t(L('5 tagacha 10×10 sm bo‘lak — bepul.', 'До 5 отрезов 10×10 см — бесплатно.', 'Up to five 10×10 cm cuttings — free.'))}</li>
              <li>{t(L('Toshkent bo‘ylab 1–2 kunda, viloyatlarga 3–4 kunda.', 'По Ташкенту за 1–2 дня, в регионы за 3–4 дня.', 'Tashkent in 1–2 days, other regions in 3–4.'))}</li>
              {settings.freeDeliveryFromUZS > 0 && (
                <li>
                  {t(L(
                    `${formatMoney(settings.freeDeliveryFromUZS, 'UZS', 'uz')}dan ortiq xaridda mato yetkazish ham bepul.`,
                    `При покупке от ${formatMoney(settings.freeDeliveryFromUZS, 'UZS', 'ru')} доставка ткани тоже бесплатна.`,
                    `Fabric delivery is free on orders over ${formatMoney(settings.freeDeliveryFromUZS, 'UZS', 'en')}.`,
                  ))}
                </li>
              )}
            </ul>
            <a className="btn btn-primary mt-8" href={href('catalog')}>{t(L('Namunalarni tanlash', 'Выбрать образцы', 'Choose samples'))}</a>
          </div>
          <div className="relative mx-auto h-[260px] w-full max-w-[420px]" aria-hidden="true">
            {featured.concat(fabrics.slice(0, 1)).slice(0, 5).map((f, i) => (
              <div
                key={f.id + i}
                className="absolute top-6 h-[200px] w-[150px] overflow-hidden rounded-[4px] bg-paper p-2 pb-7 shadow-md"
                style={{ left: `calc((100% - 150px) * ${i / 4})`, transform: `rotate(${(i - 2) * 5}deg)` }}
              >
                <div className="h-full overflow-hidden rounded-[2px]">
                  <FabricImage fabric={f} color={f.colors[(i * 3) % f.colors.length]} kind="tile" alt="" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tailors */}
      <section className="wrap mt-24 sm:mt-32" aria-labelledby="tailors-h">
        <div className="flex items-end justify-between gap-6">
          <h2 id="tailors-h" className="text-[34px] sm:text-[44px]">{t(L('Ishonchli tikuvchilar', 'Проверенные портные', 'Trusted tailors'))}</h2>
          <a href={href('tailors')} className="shrink-0 text-[14px] underline decoration-line underline-offset-4 hover:decoration-ink">{t(L('Barchasi', 'Все', 'See all'))}</a>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tailors.map((x) => (
            <a key={x.id} href={href('tailors', { query: { book: x.id } })} className="rounded-xl border border-line p-6 transition-colors hover:border-ink">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[22px]">{x.atelierName}</h3>
                <span className="tabular inline-flex items-center gap-1 text-[14px]"><Star className="h-4 w-4 fill-ink" />{formatNumber(x.rating ?? 0, lang, 1)}</span>
              </div>
              <p className="mt-1 text-[14px] text-graphite">{x.name} · {x.city}</p>
              <p className="mt-4 text-[14px]">{t(specialtyFor(x.specialtyKey).label)}</p>
              <p className="tabular mt-1 text-[13.5px] text-graphite">{formatMoney(x.priceStartingUZS, 'UZS', lang)} {t(L('dan', 'и выше', 'and up'))}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
