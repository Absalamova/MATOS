import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImageUp, Plus } from 'lucide-react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { asset, formatMoney, photoSources, pricePerUnit } from '../lib/format';
import { analyzePhoto, Analysis, rankFabrics } from '../lib/visualSearch';
import { href } from '../lib/router';
import { GARMENTS } from '../data/garments';
import { Dialog } from './ui/Dialog';
import { FabricImage } from './ui/FabricImage';
import { GarmentIcon } from './ui/GarmentIcon';
import { GarmentTypeKey } from '../types';
import { StudioViewer } from './studio/StudioViewer';

const EXAMPLES: { src: string; label: ReturnType<typeof L>; garment: GarmentTypeKey }[] = [
  { src: 'images/examples/emerald-slip.jpg', label: L('Zumrad slip ko‘ylak', 'Изумрудное платье-комбинация', 'Emerald slip dress'), garment: 'slip_dress' },
  { src: 'images/examples/adras-kimono.jpg', label: L('Adras chopon', 'Чапан из адраса', 'Adras chapan'), garment: 'kimono' },
  { src: 'images/examples/khaki-trench.jpg', label: L('Xaki trench', 'Тренч хаки', 'Khaki trench'), garment: 'trench' },
  { src: 'images/examples/blush-pleated.jpg', label: L('Pudra burmali ko‘ylak', 'Пудровое платье в складку', 'Blush pleated dress'), garment: 'pleated_dress' },
];

type State = { phase: 'pick' } | { phase: 'analyzing'; src: string } | { phase: 'result'; src: string; analysis: Analysis } | { phase: 'error'; src?: string };

export function VisualSearchModal() {
  const { t, lang, currency, unit, overlay, close, fabrics, hasSample, toggleSample, measurements } = useApp();
  const [state, setState] = useState<State>({ phase: 'pick' });
  const [colorIdx, setColorIdx] = useState(0);
  const [garment, setGarment] = useState<GarmentTypeKey | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Garment the example photo shows; used for the 3D mannequin when the user picks none. */
  const [photoGarment, setPhotoGarment] = useState<GarmentTypeKey | null>(null);
  /** Match shown on the 3D mannequin: hovering a result previews it, tapping keeps it. */
  const [active, setActive] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const isOpen = overlay === 'search';

  const run = useCallback(async (src: string, g: GarmentTypeKey | null = null) => {
    setState({ phase: 'analyzing', src });
    setColorIdx(0);
    setGarment(g);
    setPhotoGarment(g);
    setActive(null);
    setShowPhoto(false);
    try {
      const [analysis] = await Promise.all([analyzePhoto(src), new Promise((r) => setTimeout(r, 450))]);
      if (!analysis.palette.length) throw new Error('empty');
      setState({ phase: 'result', src, analysis });
    } catch {
      setState({ phase: 'error', src });
    }
  }, []);

  const readFile = useCallback(
    (file?: File | null) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' && run(reader.result);
      reader.readAsDataURL(file);
    },
    [run],
  );

  // Paste a screenshot straight from the clipboard
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (item) readFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, readFile]);

  const onClose = () => {
    close();
    setTimeout(() => setState({ phase: 'pick' }), 200);
  };

  const matches = useMemo(() => {
    if (state.phase !== 'result') return [];
    const target = state.analysis.palette[colorIdx] ?? state.analysis.palette[0];
    return rankFabrics(fabrics, target, state.analysis, garment ? GARMENTS.find((g) => g.typeKey === garment) : undefined);
  }, [state, colorIdx, garment, fabrics]);

  const keyOf = (m: { fabric: { id: string }; color: { id: string } }) => `${m.fabric.id}-${m.color.id}`;
  const shown = matches.find((m) => keyOf(m) === active) ?? matches[0];
  const outfit = useMemo(
    () => (shown ? { fabric: shown.fabric, color: shown.color, garment: garment ?? photoGarment ?? shown.fabric.bestFor[0] ?? 'slip_dress' } : null),
    [shown, garment, photoGarment],
  );
  const pick = (key: string, delay = 0) => {
    window.clearTimeout(hoverTimer.current);
    const go = () => {
      setActive(key);
      setShowPhoto(false);
    };
    // a short delay so sweeping the mouse across the list doesn't rebuild every garment on the way
    if (delay) hoverTimer.current = window.setTimeout(go, delay);
    else go();
  };

  const surfaceLabel = (a: Analysis) =>
    a.surface === 'patterned'
      ? t(L('naqshli mato', 'ткань с рисунком', 'patterned cloth'))
      : a.surface === 'textured'
        ? t(L('teksturali mato (zig‘ir, kanvas)', 'фактурная ткань (лён, канвас)', 'textured cloth (linen, canvas)'))
        : a.sheen > 0.06
          ? t(L('silliq, jilosi bor (ipak)', 'гладкая, с блеском (шёлк)', 'smooth with sheen (silk)'))
          : t(L('silliq mato', 'гладкая ткань', 'smooth cloth'));

  return (
    <Dialog open={isOpen} onClose={onClose} title={t(L('Rasm orqali mato topish', 'Поиск ткани по фото', 'Find fabric from a photo'))} size="xl" closeLabel={t(UI.close)}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} />

      {state.phase === 'pick' && (
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="max-w-[62ch] text-graphite">
            {t(L(
              'Instagram yoki Pinterest’da ko‘rgan kiyimingiz skrinshotini yuklang. Rasm telefoningizdan chiqmaydi — ranglar va mato yuzasi shu yerning o‘zida tahlil qilinadi.',
              'Загрузите скриншот наряда из Instagram или Pinterest. Фото не покидает устройство — цвета и фактура анализируются прямо здесь.',
              'Upload a screenshot of an outfit from Instagram or Pinterest. The photo never leaves your device — colours and surface are analysed right here.',
            ))}
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); }}
            className={`mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-ink bg-mist' : 'border-line'}`}
          >
            <ImageUp className="h-8 w-8 text-graphite" strokeWidth={1.4} />
            <p className="mt-4 font-display text-[24px]">{t(L('Rasmni shu yerga tashlang', 'Перетащите фото сюда', 'Drop a photo here'))}</p>
            <p className="mt-1 text-[13.5px] text-graphite">{t(L('yoki Ctrl+V bilan skrinshotni joylang', 'или вставьте скриншот через Ctrl+V', 'or paste a screenshot with Ctrl+V'))}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} data-autofocus>
                <ImageUp className="h-4 w-4" />
                {t(L('Rasm tanlash', 'Выбрать фото', 'Choose photo'))}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => camRef.current?.click()}>
                <Camera className="h-4 w-4" />
                {t(L('Suratga olish', 'Сфотографировать', 'Take a photo'))}
              </button>
            </div>
          </div>
          <div className="mt-8">
            <p className="label">{t(L('Yoki namunani sinab ko‘ring', 'Или попробуйте на примере', 'Or try an example'))}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {EXAMPLES.map((ex) => (
                <button key={ex.src} type="button" onClick={() => run(asset(ex.src), ex.garment)} className="group text-left">
                  <span className="block aspect-[3/4] overflow-hidden rounded-[6px] bg-well">
                    <img {...photoSources(ex.src)} sizes="(min-width: 640px) 200px, 50vw" alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  </span>
                  <span className="mt-2 block text-[13.5px]">{t(ex.label)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.phase === 'analyzing' && (
        <div className="flex flex-col items-center px-6 py-14 text-center" role="status">
          <div className="relative h-64 w-48 overflow-hidden rounded-[6px] bg-well">
            <img src={state.src} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 h-1 animate-[scan_1.1s_ease-in-out_infinite] bg-tape" style={{ boxShadow: '0 0 0 1px rgba(25,27,32,.2)' }} />
          </div>
          <p className="mt-6 font-display text-[24px]">{t(L('Ranglar va yuza aniqlanmoqda…', 'Определяем цвета и фактуру…', 'Reading colours and surface…'))}</p>
          <style>{'@keyframes scan{0%{transform:translateY(0)}50%{transform:translateY(252px)}100%{transform:translateY(0)}}'}</style>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="px-6 py-14 text-center">
          <p className="font-display text-[24px]">{t(L('Rasmni o‘qib bo‘lmadi', 'Не удалось прочитать фото', 'Couldn’t read that photo'))}</p>
          <p className="mx-auto mt-2 max-w-md text-graphite">{t(L('JPG, PNG yoki WEBP rasm tanlang. Kiyim rasmning markazida bo‘lsin.', 'Выберите JPG, PNG или WEBP; одежда — в центре кадра.', 'Choose a JPG, PNG or WEBP with the garment in the centre.'))}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => setState({ phase: 'pick' })}>{t(L('Boshqa rasm', 'Другое фото', 'Try another photo'))}</button>
        </div>
      )}

      {state.phase === 'result' && (
        <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[280px_1fr] lg:gap-8">
          {/* stays in view while the results scroll, so a tap on a fabric is visible on the mannequin (phones too) */}
          <div className="sticky top-0 z-10 -mx-5 bg-paper px-5 pb-3 sm:-mx-8 sm:px-8 lg:mx-0 lg:self-start lg:px-0 lg:pb-0">
            {/* 3D mannequin wearing the hovered / tapped fabric; the uploaded photo sits in the corner */}
            <div className="relative mx-auto h-[34dvh] w-full max-w-[320px] overflow-hidden rounded-[6px] bg-well lg:aspect-[3/4] lg:h-auto" style={{ background: 'radial-gradient(ellipse at 50% 38%, #ffffff 0%, #f3f2ee 55%, #e7e5df 100%)' }}>
              {outfit && !showPhoto ? (
                <StudioViewer
                  outfit={outfit}
                  measurements={measurements}
                  lighting="daylight"
                  backdrop="light"
                  autoRotate={false}
                  wind={false}
                  fallback={<img src={state.src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                />
              ) : (
                <img src={state.src} alt={t(L('Siz yuklagan rasm', 'Ваше фото', 'Your photo'))} className="absolute inset-0 h-full w-full object-cover" />
              )}
              {outfit && (
                <button
                  type="button"
                  onClick={() => setShowPhoto(!showPhoto)}
                  className="absolute bottom-2 right-2 h-20 w-[60px] overflow-hidden rounded-[4px] bg-well shadow-md ring-2 ring-white"
                  aria-label={showPhoto ? t(L('3D modelni ko‘rsatish', 'Показать 3D-модель', 'Show 3D model')) : t(L('Siz yuklagan rasmni ko‘rsatish', 'Показать ваше фото', 'Show your photo'))}
                >
                  {showPhoto ? (
                    <span className="flex h-full w-full items-center justify-center text-[13px] font-medium">3D</span>
                  ) : (
                    <img src={state.src} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              )}
              {shown && !showPhoto && (
                <div className="pointer-events-none absolute inset-x-2 top-2 truncate rounded-full bg-paper/90 px-3 py-1 text-center text-[12px] text-graphite">
                  {t(shown.fabric.name)}, {t(shown.color.name)}
                </div>
              )}
            </div>
            <p className="mx-auto mt-2 hidden max-w-[320px] text-center text-[12px] text-muted lg:block">
              {t(L('Matoni ko‘rish uchun ustiga olib boring yoki bosing', 'Наведите или нажмите на ткань, чтобы примерить', 'Hover or tap a fabric to try it on'))}
            </p>
            <button type="button" className="btn btn-secondary btn-sm mx-auto mt-2 flex w-full max-w-[320px] lg:mt-3" onClick={() => setState({ phase: 'pick' })}>
              {t(L('Boshqa rasm', 'Другое фото', 'Another photo'))}
            </button>
          </div>
          <div className="min-w-0">
            <div>
              <p className="label">{t(L('Rasmdagi ranglar — qaysi birini qidiramiz?', 'Цвета на фото — какой ищем?', 'Colours in the photo — which one?'))}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {state.analysis.palette.map((p, i) => (
                  <button key={p.hex + i} type="button" role="radio" aria-checked={colorIdx === i} onClick={() => setColorIdx(i)} className="chip pl-1.5" aria-pressed={colorIdx === i}>
                    <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: p.hex }} aria-hidden="true" />
                    {Math.round(p.share * 100)}%
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-graphite">{t(L('Yuza', 'Поверхность', 'Surface'))}: {surfaceLabel(state.analysis)}</p>
            </div>
            <div className="mt-5">
              <p className="label">{t(L('Bu qanday kiyim? (ixtiyoriy)', 'Что это за вещь? (необязательно)', 'What kind of garment? (optional)'))}</p>
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {GARMENTS.map((g) => (
                  <button key={g.id} type="button" aria-pressed={garment === g.typeKey} onClick={() => setGarment(garment === g.typeKey ? null : g.typeKey)} className="chip h-auto shrink-0 py-1.5 pl-2">
                    <GarmentIcon type={g.typeKey} className="h-7 w-5" />
                    {t(g.name)}
                  </button>
                ))}
              </div>
            </div>

            <h3 className="mt-8 font-sans text-[15px] font-medium">{t(L('Eng mos matolar', 'Самые похожие ткани', 'Closest fabrics'))}</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {matches.map((m) => {
                const sampled = hasSample(m.fabric.id, m.color.id);
                const key = keyOf(m);
                const on = shown && keyOf(shown) === key && !showPhoto;
                return (
                  <li
                    key={key}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && pick(key, 90)}
                    onPointerLeave={(e) => e.pointerType === 'mouse' && window.clearTimeout(hoverTimer.current)}
                    onClick={(e) => {
                      // tapping the card (not its links or buttons) puts the fabric on the mannequin
                      if (!(e.target as HTMLElement).closest('a,button')) pick(key);
                    }}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${on ? 'border-ink bg-mist' : 'border-line hover:border-ink'}`}
                  >
                    <a href={href('fabric', { id: m.fabric.id, query: { color: m.color.id } })} onClick={onClose} className="h-24 w-20 shrink-0 overflow-hidden rounded-[4px] bg-well">
                      <FabricImage fabric={m.fabric} color={m.color} alt="" />
                    </a>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="truncate font-medium">{t(m.fabric.name)}</div>
                      <div className="truncate text-[13px] text-graphite">{t(m.color.name)} · {formatMoney(pricePerUnit(m.fabric, currency, unit), currency, lang)}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {m.print ? (
                          <span className="rounded-full bg-tape-soft px-2 py-0.5 text-[12px]">{t(L('naqshi o‘xshash', 'похожий рисунок', 'similar print'))}</span>
                        ) : (
                          <>
                            <span className="h-1 w-16 overflow-hidden rounded-full bg-well" aria-hidden="true">
                              <span className="block h-full bg-ink" style={{ width: `${m.colorScore}%` }} />
                            </span>
                            <span className="tabular text-[12.5px] text-graphite">{t(L(`rang ${m.colorScore}% mos`, `цвет совпадает на ${m.colorScore}%`, `${m.colorScore}% colour match`))}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-auto flex gap-1.5 pt-2">
                        <a className="btn btn-secondary btn-sm h-8 px-3 text-[12.5px]" href={href('studio', { query: { fabric: m.fabric.id, color: m.color.id, garment: garment ?? m.fabric.bestFor[0] } })} onClick={onClose}>3D</a>
                        <a className="btn btn-secondary btn-sm h-8 px-3 text-[12.5px]" href={href('fabric', { id: m.fabric.id, query: { color: m.color.id } })} onClick={onClose}>{t(L('Ko‘rish', 'Открыть', 'View'))}</a>
                        <button type="button" className={`btn btn-sm h-8 px-3 text-[12.5px] ${sampled ? 'btn-tape' : 'btn-secondary'}`} aria-pressed={sampled} onClick={() => toggleSample(m.fabric.id, m.color.id)}>
                          {sampled ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {t(L('Namuna', 'Образец', 'Sample'))}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[12.5px] text-muted">
              {t(L('Ekrandagi rang yorug‘lik va kamera sozlamasiga bog‘liq. Aniq rangni bepul namuna orqali tekshiring.', 'Цвет на экране зависит от света и камеры. Точный цвет проверьте по бесплатному образцу.', 'On-screen colour depends on light and camera. Check the exact shade with a free sample.'))}
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
