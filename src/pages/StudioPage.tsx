import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Minus, Plus, RotateCcw, Wind, Rotate3d, ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../state/app';
import { href, navigate, Route } from '../lib/router';
import { L, UI } from '../lib/i18n';
import { formatLength, formatMoney, formatNumber, pricePerMeter } from '../lib/format';
import { clampMeasurements, MEASURE_LIMITS, requiredMeters, sizeFor, suitability } from '../lib/measure';
import { GARMENTS, findGarment } from '../data/garments';
import { findColor } from '../data/fabrics';
import { BodyMeasurements, GarmentTypeKey, LightingPreset } from '../types';
import { StudioViewer, ViewerHandle } from '../components/studio/StudioViewer';
import { GarmentIcon } from '../components/ui/GarmentIcon';
import { ColorChip, FabricImage } from '../components/ui/FabricImage';

type Tab = 'garment' | 'fabric' | 'color' | 'body';

const LIGHTS: { id: LightingPreset; label: ReturnType<typeof L> }[] = [
  { id: 'daylight', label: L('Kunduz', 'День', 'Day') },
  { id: 'atelier', label: L('Atelye', 'Ателье', 'Atelier') },
  { id: 'evening', label: L('Kechki', 'Вечер', 'Evening') },
];

function MeasureField({ label, value, onChange, range }: { label: string; value: number; onChange: (v: number) => void; range: readonly [number, number] }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (v: number) => onChange(Math.min(range[1], Math.max(range[0], Math.round(v))));
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="flex items-center rounded-[10px] border border-line focus-within:border-ink">
        <button type="button" className="icon-btn h-11 w-11 shrink-0" onClick={() => commit(value - 1)} aria-label={`${label} −1`}>
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={range[0]}
          max={range[1]}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => (Number.isFinite(+draft) && draft !== '' ? commit(+draft) : setDraft(String(value)))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="tabular h-11 w-full min-w-0 bg-transparent text-center text-[16px] outline-none"
        />
        <span className="pr-1 text-[13px] text-muted">sm</span>
        <button type="button" className="icon-btn h-11 w-11 shrink-0" onClick={() => commit(value + 1)} aria-label={`${label} +1`}>
          <Plus className="h-4 w-4" />
        </button>
      </span>
    </label>
  );
}

export function StudioPage({ route }: { route: Route }) {
  const app = useApp();
  const { t, lang, currency, unit, fabrics, fabricById, measurements, setMeasurements, addToCart, hasSample, toggleSample } = app;
  const q = route.query;
  const fabric = fabricById(q.get('fabric') ?? '') ?? fabricById('silk-crepe') ?? fabrics[0];
  const color = findColor(fabric, q.get('color') ?? undefined);
  const garment = findGarment(q.get('garment') ?? '') ?? GARMENTS[0];

  const [tab, setTab] = useState<Tab>('garment');
  const [lighting, setLighting] = useState<LightingPreset>('daylight');
  const [autoRotate, setAutoRotate] = useState(false);
  const [wind, setWind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const viewer = useRef<ViewerHandle>(null);

  const set = (patch: { fabric?: string; color?: string; garment?: GarmentTypeKey }) =>
    navigate('studio', {
      query: { fabric: patch.fabric ?? fabric.id, color: patch.color ?? (patch.fabric ? undefined : color.id), garment: patch.garment ?? garment.typeKey },
      replace: true,
    });

  const need = useMemo(() => requiredMeters(garment, fabric, measurements), [garment, fabric, measurements]);
  const total = pricePerMeter(fabric, currency) * need.meters;
  const outfit = useMemo(() => ({ fabric, color, garment: garment.typeKey }), [fabric, color, garment]);
  const sampled = hasSample(fabric.id, color.id);
  const size = sizeFor(measurements);
  const backdrop = lighting === 'evening' ? 'dark' : 'light';
  const fits = suitability(garment, fabric);

  const setM = (k: keyof BodyMeasurements, v: number) => setMeasurements(clampMeasurements({ ...measurements, [k]: v }));

  const save = () => {
    const url = viewer.current?.capture();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `matos-${garment.typeKey}-${fabric.id}-${color.id}.png`;
    a.click();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'garment', label: t(L('Fason', 'Фасон', 'Style')) },
    { id: 'fabric', label: t(L('Mato', 'Ткань', 'Fabric')) },
    { id: 'color', label: t(L('Rang', 'Цвет', 'Colour')) },
    { id: 'body', label: t(L('O‘lcham', 'Мерки', 'Body')) },
  ];

  const garmentPanel = (
    <div className="grid grid-cols-3 gap-2">
      {GARMENTS.map((g) => (
        <button
          key={g.id}
          type="button"
          aria-pressed={g.id === garment.id}
          onClick={() => set({ garment: g.typeKey })}
          className={`flex flex-col items-center rounded-xl border px-2 pb-3 pt-4 text-center text-[12.5px] leading-tight transition-colors ${
            g.id === garment.id ? 'border-ink bg-mist' : 'border-line hover:border-ink'
          }`}
        >
          <GarmentIcon type={g.typeKey} className="h-12 w-9" />
          <span className="mt-2">{t(g.name)}</span>
        </button>
      ))}
    </div>
  );

  const fabricPanel = (
    <ul className="divide-y divide-line">
      {[...fabrics]
        .sort((a, b) => suitability(garment, b) - suitability(garment, a))
        .map((f) => {
          const good = suitability(garment, f) >= 0.75;
          return (
            <li key={f.id}>
              <button type="button" aria-pressed={f.id === fabric.id} onClick={() => set({ fabric: f.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className={`h-12 w-12 shrink-0 overflow-hidden rounded-[4px] bg-well ${f.id === fabric.id ? 'ring-2 ring-ink ring-offset-2' : ''}`}>
                  <FabricImage fabric={f} color={f.colors[0]} kind="swatch" alt="" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{t(f.name)}</span>
                  <span className="block text-[12.5px] text-graphite">
                    {f.gsm} g/m² · {formatMoney(pricePerMeter(f, currency), currency, lang)}
                  </span>
                </span>
                {good && <span className="shrink-0 rounded-full bg-tape-soft px-2 py-0.5 text-[11.5px]">{t(L('Mos', 'Подходит', 'Good fit'))}</span>}
              </button>
            </li>
          );
        })}
    </ul>
  );

  const colorPanel = (
    <div>
      <div className="flex flex-wrap gap-2">
        {fabric.colors.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === color.id} onClick={() => set({ color: c.id })} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-[13px] transition-colors hover:border-ink aria-pressed:border-ink aria-pressed:bg-mist">
            <ColorChip fabric={fabric} color={c} size={26} />
            {t(c.name)}
          </button>
        ))}
      </div>
    </div>
  );

  const bodyPanel = (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <MeasureField label={t(L('Bo‘y', 'Рост', 'Height'))} value={measurements.heightCm} range={MEASURE_LIMITS.heightCm} onChange={(v) => setM('heightCm', v)} />
        <MeasureField label={t(L('Ko‘krak', 'Грудь', 'Bust'))} value={measurements.bustCm} range={MEASURE_LIMITS.bustCm} onChange={(v) => setM('bustCm', v)} />
        <MeasureField label={t(L('Bel', 'Талия', 'Waist'))} value={measurements.waistCm} range={MEASURE_LIMITS.waistCm} onChange={(v) => setM('waistCm', v)} />
        <MeasureField label={t(L('Son', 'Бёдра', 'Hips'))} value={measurements.hipsCm} range={MEASURE_LIMITS.hipsCm} onChange={(v) => setM('hipsCm', v)} />
      </div>
      <p className="mt-3 text-[13px] text-graphite">
        {t(L('O‘lcham', 'Размер', 'Size'))}: {size.INT} · {size.EU} · {size.US}.{' '}
        {app.user
          ? t(L('Profilingizga saqlanadi.', 'Сохраняется в профиле.', 'Saved to your profile.'))
          : t(L('Shu qurilmada saqlanadi.', 'Сохраняется на этом устройстве.', 'Saved on this device.'))}
      </p>
    </div>
  );

  const panels: Record<Tab, React.ReactNode> = { garment: garmentPanel, fabric: fabricPanel, color: colorPanel, body: bodyPanel };

  const summary = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{t(garment.name)}</div>
          <div className="truncate text-[13px] text-graphite">
            {t(fabric.name)}, {t(color.name)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular font-medium">{formatMoney(total, currency, lang)}</div>
          <button type="button" className="text-[13px] text-graphite underline decoration-line underline-offset-4 hover:text-ink" aria-expanded={showCalc} onClick={() => setShowCalc(!showCalc)}>
            {formatLength(need.meters, unit, lang)} {t(L('kerak', 'нужно', 'needed'))}
          </button>
        </div>
      </div>
      {showCalc && (
        <dl className="tabular space-y-1 rounded-lg bg-mist p-3 text-[12.5px] text-graphite">
          <div className="flex justify-between"><dt>{t(L('Fason asosi (140 sm en)', 'База фасона (ширина 140 см)', 'Pattern base (140 cm wide)'))}</dt><dd>{formatNumber(need.base, lang, 1)} m</dd></div>
          <div className="flex justify-between"><dt>{t(L('Bo‘y va o‘lcham', 'Рост и размер', 'Height & size'))}</dt><dd>{need.heightAdd + need.sizeAdd >= 0 ? '+' : '−'}{formatNumber(Math.abs(need.heightAdd + need.sizeAdd), lang, 2)} m</dd></div>
          {need.widthFactor !== 1 && <div className="flex justify-between"><dt>{t(L(`Mato eni ${fabric.widthCm} sm`, `Ширина ${fabric.widthCm} см`, `${fabric.widthCm} cm width`))}</dt><dd>×{formatNumber(need.widthFactor, lang, 2)}</dd></div>}
          <div className="flex justify-between"><dt>{t(L('Qisqarish zaxirasi', 'Запас на усадку', 'Shrinkage allowance'))}</dt><dd>+{formatNumber(need.shrinkAdd, lang, 2)} m</dd></div>
          {need.patternAdd > 0 && <div className="flex justify-between"><dt>{t(L('Naqshni moslash', 'Подгонка рисунка', 'Pattern matching'))}</dt><dd>+{formatNumber(need.patternAdd, lang, 2)} m</dd></div>}
          <p className="pt-1">{t(L('Ortiqcha 25% ehtiyot olish shart emas — aniq shu miqdor yetadi.', 'Брать лишние 25% «про запас» не нужно — этого хватит.', 'No need to buy 25% extra “just in case” — this is enough.'))}</p>
        </dl>
      )}
      {fits < 0.55 && (
        <p className="rounded-lg bg-tape-soft p-3 text-[12.5px]">
          {t(L('Bu mato ushbu fason uchun juda qalin yoki qattiq bo‘lishi mumkin. Ro‘yxatda “Mos” belgisi bor matolarni ko‘ring.', 'Эта ткань может быть слишком плотной или жёсткой для фасона. Посмотрите ткани с отметкой «Подходит».', 'This fabric may be too heavy or stiff for the style. Try one marked “Good fit”.'))}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button type="button" className="btn btn-primary" onClick={() => addToCart(fabric.id, color.id, need.meters, garment.typeKey)}>
          {t(UI.addToBag)}
        </button>
        <button type="button" className={`btn ${sampled ? 'btn-tape' : 'btn-secondary'} px-4`} aria-pressed={sampled} onClick={() => toggleSample(fabric.id, color.id)}>
          {sampled ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span className="hidden sm:inline">{t(L('Namuna', 'Образец', 'Sample'))}</span>
        </button>
      </div>
      <a className="btn btn-secondary w-full" href={href('tailors', { query: { garment: garment.typeKey, fabric: fabric.id, color: color.id } })}>
        {t(L('Tikuvchiga buyurtma berish', 'Заказать пошив', 'Order from a tailor'))}
      </a>
    </div>
  );

  const toolBtn = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors';
  const dark = backdrop === 'dark';
  const toolIdle = dark ? 'text-white/85 hover:bg-white/10' : 'text-ink hover:bg-ink/5';
  const toolOn = dark ? 'bg-white text-ink' : 'bg-ink text-white';

  return (
    <div className="lg:grid lg:h-[calc(100dvh-64px)] lg:grid-cols-[1fr_420px]">
      <h1 className="sr-only">{t(UI.studio)}</h1>
      {/* Stage */}
      <div
        className="relative h-[62dvh] min-h-[420px] overflow-hidden lg:h-full"
        style={{
          background: dark
            ? 'radial-gradient(ellipse at 50% 35%, #3a3a40 0%, #1b1c20 60%, #121316 100%)'
            : 'radial-gradient(ellipse at 50% 38%, #ffffff 0%, #f3f2ee 55%, #e7e5df 100%)',
          transition: 'background 0.4s',
        }}
      >
        <StudioViewer
          ref={viewer}
          outfit={outfit}
          measurements={measurements}
          lighting={lighting}
          backdrop={backdrop}
          autoRotate={autoRotate}
          wind={wind}
          onBusy={setBusy}
          onInteract={() => setTouched(true)}
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="h-40 w-40 overflow-hidden rounded-full bg-well">
                <FabricImage fabric={fabric} color={color} alt="" />
              </div>
              <p className="max-w-sm text-graphite">
                {t(L('Brauzeringiz 3D grafikani (WebGL) qo‘llamaydi. Chrome, Safari yoki Edge’ning yangi versiyasida oching.', 'Ваш браузер не поддерживает 3D (WebGL). Откройте в новой версии Chrome, Safari или Edge.', 'Your browser does not support 3D (WebGL). Open this page in a recent Chrome, Safari or Edge.'))}
              </p>
            </div>
          }
        />
        {busy && (
          <div className={`pointer-events-none absolute right-4 top-4 rounded-full px-3 py-1.5 text-[12.5px] ${dark ? 'bg-white/10 text-white' : 'bg-paper/90 text-graphite'}`} role="status">
            {t(L('Mato teksturasi yuklanmoqda…', 'Загружаем текстуру ткани…', 'Loading fabric texture…'))}
          </div>
        )}
        {!touched && (
          <div className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-3 py-1.5 text-[12.5px] ${dark ? 'bg-white/10 text-white' : 'bg-paper/90 text-graphite'}`}>
            {t(L('Aylantirish uchun suring', 'Тяните, чтобы повернуть', 'Drag to turn'))}
            <span className="hidden sm:inline">{t(L(', yaqinlashtirish uchun g‘ildirak', ', колесо — приблизить', ', scroll to zoom'))}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
          <div className={`no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 shadow-sm ${dark ? 'bg-white/10 backdrop-blur' : 'bg-paper/90 backdrop-blur'}`} role="toolbar" aria-label={t(L('Ko‘rinish', 'Вид', 'View'))}>
            {(['front', 'side', 'back'] as const).map((v) => (
              <button key={v} type="button" className={`${toolBtn} ${toolIdle}`} onClick={() => viewer.current?.view(v)}>
                {v === 'front' ? t(L('Old', 'Спереди', 'Front')) : v === 'side' ? t(L('Yon', 'Сбоку', 'Side')) : t(L('Orqa', 'Сзади', 'Back'))}
              </button>
            ))}
            <span className={`mx-1 h-5 w-px ${dark ? 'bg-white/20' : 'bg-line'}`} />
            <button type="button" className={`${toolBtn} ${autoRotate ? toolOn : toolIdle}`} aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)}>
              <Rotate3d className="h-4 w-4" />
              <span className="hidden sm:inline">{t(L('Aylantirish', 'Вращение', 'Rotate'))}</span>
            </button>
            <button type="button" className={`${toolBtn} ${wind ? toolOn : toolIdle}`} aria-pressed={wind} onClick={() => setWind(!wind)}>
              <Wind className="h-4 w-4" />
              <span className="hidden sm:inline">{t(L('Shabada', 'Ветер', 'Breeze'))}</span>
            </button>
            <span className={`mx-1 h-5 w-px ${dark ? 'bg-white/20' : 'bg-line'}`} />
            {LIGHTS.map((l) => (
              <button key={l.id} type="button" className={`${toolBtn} ${lighting === l.id ? toolOn : toolIdle}`} aria-pressed={lighting === l.id} onClick={() => setLighting(l.id)}>
                {t(l.label)}
              </button>
            ))}
            <span className={`mx-1 h-5 w-px ${dark ? 'bg-white/20' : 'bg-line'}`} />
            <button type="button" className={`${toolBtn} ${toolIdle} px-2`} onClick={() => viewer.current?.zoom(0.8)} aria-label={t(L('Yaqinlashtirish', 'Приблизить', 'Zoom in'))}>
              <ZoomIn className="h-4 w-4" />
            </button>
            <button type="button" className={`${toolBtn} ${toolIdle} px-2`} onClick={() => viewer.current?.zoom(1.25)} aria-label={t(L('Uzoqlashtirish', 'Отдалить', 'Zoom out'))}>
              <ZoomOut className="h-4 w-4" />
            </button>
            <button type="button" className={`${toolBtn} ${toolIdle} px-2`} onClick={() => viewer.current?.reset()} aria-label={t(L('Boshlang‘ich ko‘rinish', 'Сбросить вид', 'Reset view'))}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" className={`${toolBtn} ${toolIdle} px-2`} onClick={save} aria-label={t(L('Rasmni saqlash', 'Сохранить изображение', 'Save image'))}>
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel */}
      <aside className="flex flex-col border-l border-line bg-paper lg:min-h-0" aria-label={t(L('Sozlamalar', 'Настройки', 'Options'))}>
        <div className="border-b border-line px-5 pt-4">
          <div className="no-scrollbar flex gap-1 overflow-x-auto" role="tablist">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={tab === tb.id}
                onClick={() => setTab(tb.id)}
                className={`relative px-3 pb-3 pt-1 text-[14.5px] transition-colors ${tab === tb.id ? 'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-ink' : 'text-graphite hover:text-ink'}`}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>
        <div className="thin-scroll px-5 py-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" role="tabpanel">
          {panels[tab]}
        </div>
        <div className="sticky bottom-0 border-t border-line bg-paper px-5 py-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {summary}
        </div>
      </aside>
    </div>
  );
}
