import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImageUp, PersonStanding, Plus, ScanFace, ShieldCheck, Sparkles, SwitchCamera, Timer, X } from 'lucide-react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { formatMoney, pricePerUnit } from '../lib/format';
import { href } from '../lib/router';
import { DEFAULT_MEASUREMENTS, MEASURE_LIMITS } from '../lib/measure';
import {
  analyzePortrait,
  BodyShape,
  CONTRAST_LABEL,
  Issue,
  DEPTH_LABEL,
  matchFabrics,
  PortraitAnalysis,
  recommendStyles,
  Season,
  seasonFor,
  SEASONS,
  shapeFromMeasurements,
  SHAPES,
  UNDERTONE_LABEL,
} from '../lib/styleAdvisor';
import { Dialog } from './ui/Dialog';
import { FabricImage } from './ui/FabricImage';
import { GarmentIcon } from './ui/GarmentIcon';
import type { BodyMeasurements } from '../types';

type Slot = 'face' | 'body';
type Photos = Record<Slot, string | null>;

type State =
  | { phase: 'pick' }
  | { phase: 'camera'; slot: Slot }
  | { phase: 'analyzing' }
  | { phase: 'result'; analysis: PortraitAnalysis; facePhoto: boolean; bodyPhoto: boolean }
  | { phase: 'error' };

type ShapeSource = 'photo' | 'measurements' | 'manual';

const MAX_BYTES = 25 * 1024 * 1024;
const SEASON_KEYS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SHAPE_KEYS: BodyShape[] = ['hourglass', 'pear', 'inverted', 'rectangle', 'apple'];
const sameAsDefault = (m: BodyMeasurements) => m.bustCm === DEFAULT_MEASUREMENTS.bustCm && m.waistCm === DEFAULT_MEASUREMENTS.waistCm && m.hipsCm === DEFAULT_MEASUREMENTS.hipsCm;

/**
 * Colours come from the face photo (or the body photo when that is all we have);
 * the figure comes only from a full-length photo. Either photo alone is enough to start.
 */
function merge(face: PortraitAnalysis | null, body: PortraitAnalysis | null): PortraitAnalysis {
  const coloring = face?.coloring ?? body?.coloring ?? null;
  const silhouette = body?.silhouette ?? face?.silhouette ?? null;
  const issues: Issue[] = [];
  if (!coloring) issues.push('no-skin');
  if ((face ?? body)?.issues.includes('too-dark') && !coloring) issues.push('too-dark');
  // a missing figure is only a problem when the shopper actually gave us a full-length photo
  if (body && !silhouette) issues.push(...body.issues.filter((i) => i === 'busy-background' || i === 'not-full-body'));
  return { coloring, silhouette, issues };
}

export function StyleAdvisorModal() {
  const { t, lang, currency, unit, overlay, close, fabrics, hasSample, toggleSample, measurements, setMeasurements } = useApp();
  const isOpen = overlay === 'style';
  const [state, setState] = useState<State>({ phase: 'pick' });
  const [photos, setPhotos] = useState<Photos>({ face: null, body: null });
  const [badFile, setBadFile] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [shape, setShape] = useState<BodyShape | null>(null);
  const [shapeSource, setShapeSource] = useState<ShapeSource>('measurements');
  const [form, setForm] = useState({ bustCm: '', waistCm: '', hipsCm: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const camInputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<Slot>('face');
  const photosRef = useRef<Photos>(photos);
  photosRef.current = photos;
  const runId = useRef(0);

  /** Photos live only as object URLs in this window; each is released when replaced, removed or the window closes. */
  const setPhoto = useCallback((slot: Slot, blob: Blob | null) => {
    setPhotos((p) => {
      if (p[slot]) URL.revokeObjectURL(p[slot]!);
      return { ...p, [slot]: blob ? URL.createObjectURL(blob) : null };
    });
  }, []);

  const releaseAll = useCallback(() => {
    const p = photosRef.current;
    if (p.face) URL.revokeObjectURL(p.face);
    if (p.body) URL.revokeObjectURL(p.body);
    setPhotos({ face: null, body: null });
  }, []);

  useEffect(() => releaseAll, [releaseAll]);

  const analyze = useCallback(async () => {
    const { face, body } = photosRef.current;
    if (!face && !body) return;
    const id = ++runId.current;
    setState({ phase: 'analyzing' });
    setSeason(null);
    setShape(null);
    try {
      const [fa, ba] = await Promise.all([
        face ? analyzePortrait(face) : Promise.resolve(null),
        body ? analyzePortrait(body) : Promise.resolve(null),
        new Promise((r) => setTimeout(r, 500)),
      ]);
      if (id !== runId.current) return; // photos changed meanwhile
      const analysis = merge(fa, ba);
      setShapeSource(analysis.silhouette && analysis.silhouette.confidence >= 0.4 ? 'photo' : 'measurements');
      setState({ phase: 'result', analysis, facePhoto: !!face, bodyPhoto: !!body });
    } catch {
      if (id === runId.current) setState({ phase: 'error' });
    }
  }, []);

  const readFile = useCallback(
    (file: File | null | undefined, slot: Slot) => {
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > MAX_BYTES) {
        setBadFile(true);
        return;
      }
      setBadFile(false);
      setPhoto(slot, file);
    },
    [setPhoto],
  );

  const onClose = () => {
    close();
    runId.current++;
    setTimeout(() => {
      releaseAll();
      setState({ phase: 'pick' });
    }, 200);
  };

  useEffect(() => {
    if (!isOpen) return;
    setForm({ bustCm: String(measurements.bustCm), waistCm: String(measurements.waistCm), hipsCm: String(measurements.hipsCm) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const upload = (slot: Slot) => {
    slotRef.current = slot;
    fileRef.current?.click();
  };
  const openCamera = (slot: Slot) => {
    slotRef.current = slot;
    if (typeof navigator.mediaDevices?.getUserMedia === 'function' && window.isSecureContext) setState({ phase: 'camera', slot });
    else camInputRef.current?.click();
  };

  const result = state.phase === 'result' ? state.analysis : null;
  const coloring = result?.coloring ?? null;
  const detectedSeason: Season = coloring ? seasonFor(coloring.undertone, coloring.depth, coloring.contrast, coloring.hue) : 'summer';
  const activeSeason = season ?? detectedSeason;
  const measuredShape = shapeFromMeasurements(measurements);
  const activeShape: BodyShape =
    shapeSource === 'manual' && shape ? shape : shapeSource === 'photo' && result?.silhouette ? result.silhouette.shape : measuredShape;

  const colorMatches = useMemo(() => (result ? matchFabrics(fabrics, activeSeason) : []), [result, fabrics, activeSeason]);
  const styles = useMemo(() => (result ? recommendStyles(fabrics, activeShape, activeSeason) : null), [result, fabrics, activeShape, activeSeason]);

  const applyMeasurements = (e: React.FormEvent) => {
    e.preventDefault();
    const n = (v: string, k: keyof typeof MEASURE_LIMITS) => {
      const x = Number(v.replace(',', '.'));
      return Number.isFinite(x) && x > 0 ? x : measurements[k];
    };
    setMeasurements({ ...measurements, bustCm: n(form.bustCm, 'bustCm'), waistCm: n(form.waistCm, 'waistCm'), hipsCm: n(form.hipsCm, 'hipsCm') });
    setShapeSource('measurements');
    setShape(null);
  };

  const issueText = (a: PortraitAnalysis) => {
    const out: string[] = [];
    if (a.issues.includes('too-dark')) out.push(t(L('Rasm juda qorong‘i — kunduzgi yorug‘likda qayta suratga oling.', 'Фото слишком тёмное — переснимите при дневном свете.', 'The photo is too dark — retake it in daylight.')));
    if (a.issues.includes('no-skin'))
      out.push(t(L('Yuz teri rangini aniqlay olmadik. Yuzingiz yaqindan, yorug‘da tushgan rasmni qo‘shing yoki rang tipingizni quyida o‘zingiz tanlang.', 'Не удалось определить тон кожи. Добавьте светлое фото лица крупным планом или выберите цветотип ниже.', 'We couldn’t read your skin tone. Add a well-lit close-up of your face, or pick your colour type below.')));
    if (a.issues.includes('busy-background') || a.issues.includes('not-full-body'))
      out.push(
        t(L(
          'Bo‘y rasmidan qomatni o‘qib bo‘lmadi: bo‘yingiz to‘liq ko‘rinadigan, qo‘llar tanadan biroz ochiq, oddiy devor oldida tushgan rasm kerak. Hozircha o‘lchamlaringiz bo‘yicha hisobladik.',
          'По фото в рост фигуру прочитать не удалось: нужен полный рост, руки чуть в стороны, ровная стена. Пока считаем по вашим меркам.',
          'We couldn’t read your figure from the full-length photo: show your whole body, arms slightly out, against a plain wall. For now we used your measurements.',
        )),
      );
    return out;
  };

  const slotCard = (slot: Slot) => {
    const src = photos[slot];
    const face = slot === 'face';
    return (
      <div
        className="flex flex-col rounded-2xl border-2 border-dashed border-line p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files?.[0], slot); }}
      >
        <div className="flex items-start gap-4">
          <div className="flex aspect-[3/4] w-24 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-well">
            {src ? (
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : face ? (
              <ScanFace className="h-9 w-9 text-graphite" strokeWidth={1.2} />
            ) : (
              <PersonStanding className="h-10 w-10 text-graphite" strokeWidth={1.2} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium">
              {face ? t(L('Yuz rasmi', 'Фото лица', 'Face photo')) : t(L('To‘liq bo‘y rasmi', 'Фото в полный рост', 'Full-length photo'))}
              <span className="ml-1.5 text-[12.5px] font-normal text-graphite">
                {face ? t(L('— ranglar uchun', '— для цветов', '— for colours')) : t(L('— fasonlar uchun, ixtiyoriy', '— для фасонов, по желанию', '— for styles, optional'))}
              </span>
            </p>
            <p className="mt-1 text-[13px] text-graphite">
              {face
                ? t(L('Yuzingiz yaqindan, kunduzgi yorug‘likda, filtr va makiyajsiz. Sochingiz ko‘rinsa yaxshi.', 'Лицо крупно, при дневном свете, без фильтров и макияжа. Хорошо, если видны волосы.', 'A close-up in daylight, no filters or make-up. Better if your hair shows.'))
                : t(L('Boshdan oyoqqacha, oddiy devor oldida, qo‘llar biroz yonga ochiq.', 'С головы до ног, у ровной стены, руки чуть в стороны.', 'Head to toe, against a plain wall, arms slightly out.'))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={`btn btn-sm ${face && !src ? 'btn-primary' : 'btn-secondary'}`} onClick={() => openCamera(slot)} data-autofocus={face ? true : undefined}>
                <Camera className="h-4 w-4" />
                {src ? t(L('Qayta olish', 'Переснять', 'Retake')) : t(L('Suratga olish', 'Сфотографировать', 'Take photo'))}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => upload(slot)}>
                <ImageUp className="h-4 w-4" />
                {t(L('Yuklash', 'Загрузить', 'Upload'))}
              </button>
              {src && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(slot, null)} aria-label={t(UI.remove)}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title={t(L('Sizga mos uslub va ranglar', 'Ваш стиль и цвета', 'Your styles and colours'))} size="xl" closeLabel={t(UI.close)}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], slotRef.current); e.target.value = ''; }} />
      <input ref={camInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], slotRef.current); e.target.value = ''; }} />

      {state.phase === 'pick' && (
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="max-w-[66ch] text-graphite">
            {t(L(
              'Yuzingiz rasmidan teri va soch rangingizga mos ranglarni, to‘liq bo‘y rasmidan esa qomatingizga mos fasonlarni tanlaymiz. Bittasi ham yetarli.',
              'По фото лица подберём цвета под тон кожи и волос, по фото в полный рост — фасоны под фигуру. Достаточно и одного фото.',
              'From a face photo we pick colours for your skin and hair; from a full-length photo, styles for your figure. Either one is enough.',
            ))}
          </p>
          <p className="mt-3 flex items-start gap-2 text-[13.5px] text-graphite">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
            {t(L(
              'Rasmlar hech qayerga yuborilmaydi va saqlanmaydi — tahlil faqat shu qurilmada bajariladi.',
              'Фото никуда не отправляются и не сохраняются — анализ идёт только на этом устройстве.',
              'Your photos are never sent or stored — the analysis runs only on this device.',
            ))}
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {slotCard('face')}
            {slotCard('body')}
          </div>
          {badFile && <p className="mt-3 text-[13.5px] text-danger">{t(L('25 MB gacha JPG, PNG yoki WEBP rasm tanlang.', 'Выберите JPG, PNG или WEBP до 25 МБ.', 'Choose a JPG, PNG or WEBP up to 25 MB.'))}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={!photos.face && !photos.body} onClick={analyze}>
              <Sparkles className="h-4 w-4" />
              {t(L('Menga mosini ko‘rsat', 'Показать, что мне идёт', 'Show what suits me'))}
            </button>
            {!photos.face && !photos.body && (
              <span className="text-[13px] text-muted">{t(L('Avval kamida bitta rasm qo‘shing', 'Сначала добавьте хотя бы одно фото', 'Add at least one photo first'))}</span>
            )}
          </div>
        </div>
      )}

      {state.phase === 'camera' && (
        <CameraCapture
          t={t}
          mode={state.slot}
          onCapture={(b) => {
            setPhoto(state.slot, b);
            setState({ phase: 'pick' });
          }}
          onCancel={() => setState({ phase: 'pick' })}
          onFail={() => {
            setState({ phase: 'pick' });
            camInputRef.current?.click();
          }}
        />
      )}

      {state.phase === 'analyzing' && (
        <div className="flex flex-col items-center px-6 py-14 text-center" role="status">
          <div className="flex gap-3">
            {[photos.face, photos.body].filter(Boolean).map((src) => (
              <div key={src} className="relative h-64 w-48 overflow-hidden rounded-[6px] bg-well">
                <img src={src!} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 top-0 h-1 animate-[scan_1.1s_ease-in-out_infinite] bg-tape" />
              </div>
            ))}
          </div>
          <p className="mt-6 font-display text-[24px]">{t(L('Rang tipi va qomat aniqlanmoqda…', 'Определяем цветотип и фигуру…', 'Reading your colouring and figure…'))}</p>
          <style>{'@keyframes scan{0%{transform:translateY(0)}50%{transform:translateY(252px)}100%{transform:translateY(0)}}'}</style>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="px-6 py-14 text-center">
          <p className="font-display text-[24px]">{t(L('Rasmni o‘qib bo‘lmadi', 'Не удалось прочитать фото', 'Couldn’t read that photo'))}</p>
          <p className="mx-auto mt-2 max-w-md text-graphite">{t(L('25 MB gacha JPG, PNG yoki WEBP rasm tanlang.', 'Выберите JPG, PNG или WEBP до 25 МБ.', 'Choose a JPG, PNG or WEBP up to 25 MB.'))}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => setState({ phase: 'pick' })}>{t(L('Rasmlarni o‘zgartirish', 'Сменить фото', 'Change photos'))}</button>
        </div>
      )}

      {state.phase === 'result' && result && styles && (
        <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[220px_1fr] lg:gap-8">
          <div className="flex items-end gap-3 lg:block">
            <div className="flex gap-2 lg:grid lg:grid-cols-1">
              {[photos.face, photos.body].filter(Boolean).map((src) => (
                <div key={src} className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-[6px] bg-well lg:w-auto">
                  <img src={src!} alt={t(L('Sizning rasmingiz', 'Ваше фото', 'Your photo'))} className="h-full w-full object-contain" />
                </div>
              ))}
            </div>
            <div className="lg:mt-3">
              <button type="button" className="btn btn-secondary btn-sm lg:w-full" onClick={() => setState({ phase: 'pick' })}>
                {t(L('Rasmlarni o‘zgartirish', 'Сменить фото', 'Change photos'))}
              </button>
              <p className="mt-2 hidden text-[12px] text-muted lg:block">
                {t(L('Rasmlar faqat shu oynada turadi va yopilganda o‘chadi.', 'Фото хранятся только в этом окне и удаляются при закрытии.', 'Photos stay in this window and are cleared when you close it.'))}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            {issueText(result).map((m) => (
              <p key={m} className="mb-3 rounded-lg bg-tape-soft px-3 py-2 text-[13.5px]">{m}</p>
            ))}

            {/* Colouring */}
            <section aria-labelledby="sa-colors">
              <p className="label" id="sa-colors">{t(L('Rang tipingiz', 'Ваш цветотип', 'Your colour type'))}</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-display text-[30px] leading-tight">{t(SEASONS[activeSeason].name)}</h3>
                {coloring && (
                  <span className="flex items-center gap-2 text-[13px] text-graphite">
                    <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: coloring.skin }} title={t(L('Teri', 'Кожа', 'Skin'))} aria-hidden="true" />
                    {coloring.hair && <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: coloring.hair }} title={t(L('Soch', 'Волосы', 'Hair'))} aria-hidden="true" />}
                    {t(L(
                      `Teri tusi: ${UNDERTONE_LABEL[coloring.undertone].uz.toLowerCase()}, ${DEPTH_LABEL[coloring.depth].uz.toLowerCase()} · kontrast ${CONTRAST_LABEL[coloring.contrast].uz}`,
                      `Подтон: ${UNDERTONE_LABEL[coloring.undertone].ru.toLowerCase()}, кожа ${DEPTH_LABEL[coloring.depth].ru.toLowerCase()} · контраст ${CONTRAST_LABEL[coloring.contrast].ru}`,
                      `Undertone: ${UNDERTONE_LABEL[coloring.undertone].en.toLowerCase()}, ${DEPTH_LABEL[coloring.depth].en.toLowerCase()} skin · ${CONTRAST_LABEL[coloring.contrast].en} contrast`,
                    ))}
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-[70ch] text-[14px] text-graphite">{t(SEASONS[activeSeason].about)}</p>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t(L('Rang tipini o‘zgartirish', 'Сменить цветотип', 'Change colour type'))}>
                {SEASON_KEYS.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={activeSeason === s} aria-pressed={activeSeason === s} className="chip h-8" onClick={() => setSeason(s)}>
                    {t(SEASONS[s].name)}
                    {coloring && s === detectedSeason && <span className="text-[11px] opacity-70">· {t(L('aniqlandi', 'определено', 'detected'))}</span>}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[13px] font-medium">{t(L('Sizga mos ranglar', 'Ваши цвета', 'Colours that suit you'))}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {SEASONS[activeSeason].best.map((s) => (
                      <li key={s.hex} className="flex flex-col items-center gap-1 text-center text-[11.5px] text-graphite" style={{ width: 62 }}>
                        <span className="h-10 w-10 rounded-full ring-1 ring-black/10" style={{ background: s.hex }} aria-hidden="true" />
                        {t(s.name)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[13px] font-medium">{t(L('Ehtiyot bo‘ling', 'Осторожно', 'Go easy on'))}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {SEASONS[activeSeason].avoid.map((s) => (
                      <li key={s.hex} className="flex flex-col items-center gap-1 text-center text-[11.5px] text-graphite" style={{ width: 62 }}>
                        <span className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: s.hex }} aria-hidden="true">
                          <span className="absolute left-1/2 top-[-2px] h-[44px] w-[1.5px] -translate-x-1/2 rotate-45 bg-white/90 mix-blend-difference" />
                        </span>
                        {t(s.name)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Figure */}
            <section className="mt-8" aria-labelledby="sa-shape">
              <p className="label" id="sa-shape">{t(L('Qomatingiz', 'Ваша фигура', 'Your figure'))}</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-display text-[30px] leading-tight">{t(SHAPES[activeShape].name)}</h3>
                <span className="text-[13px] text-graphite">
                  {shapeSource === 'photo'
                    ? t(L('rasm bo‘yicha, taxminiy', 'по фото, примерно', 'from the photo, approximate'))
                    : shapeSource === 'manual'
                      ? t(L('o‘zingiz tanladingiz', 'выбрано вами', 'your choice'))
                      : sameAsDefault(measurements)
                        ? t(L('standart o‘lchamlar bo‘yicha — o‘zingiznikini kiriting', 'по стандартным меркам — введите свои', 'from default measurements — enter yours'))
                        : t(L('o‘lchamlaringiz bo‘yicha', 'по вашим меркам', 'from your measurements'))}
                </span>
              </div>
              {shapeSource !== 'manual' && result.silhouette && result.silhouette.confidence < 0.4 && (
                <p className="mt-2 rounded-lg bg-tape-soft px-3 py-2 text-[13px]">
                  {t(L(
                    'Rasmdan qomatni aniq o‘qib bo‘lmadi (qo‘llar tanaga tegib turibdi yoki fon notekis), shuning uchun o‘lchamlaringizdan foydalandik.',
                    'По фото фигуру не прочитать точно (руки касаются тела или фон неровный), поэтому взяли ваши мерки.',
                    'We couldn’t read your figure reliably (arms touch the body or the background is uneven), so we used your measurements.',
                  ))}
                </p>
              )}
              <p className="mt-1 max-w-[70ch] text-[14px] text-graphite">{t(SHAPES[activeShape].about)}</p>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t(L('Qomatni o‘zgartirish', 'Сменить фигуру', 'Change figure'))}>
                {SHAPE_KEYS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={activeShape === s}
                    aria-pressed={activeShape === s}
                    className="chip h-8"
                    onClick={() => { setShape(s); setShapeSource('manual'); }}
                  >
                    {t(SHAPES[s].name)}
                  </button>
                ))}
              </div>
              <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={applyMeasurements}>
                {(['bustCm', 'waistCm', 'hipsCm'] as const).map((k) => (
                  <label key={k} className="w-[104px]">
                    <span className="label">
                      {t(k === 'bustCm' ? L('Ko‘krak, sm', 'Грудь, см', 'Bust, cm') : k === 'waistCm' ? L('Bel, sm', 'Талия, см', 'Waist, cm') : L('Son, sm', 'Бёдра, см', 'Hips, cm'))}
                    </span>
                    <input
                      className="field h-10"
                      inputMode="decimal"
                      type="number"
                      min={MEASURE_LIMITS[k][0]}
                      max={MEASURE_LIMITS[k][1]}
                      value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    />
                  </label>
                ))}
                <button type="submit" className="btn btn-secondary btn-sm h-10">{t(L('O‘lchamlarim bo‘yicha', 'По моим меркам', 'Use my measurements'))}</button>
              </form>
            </section>

            {/* Styles */}
            <section className="mt-8" aria-labelledby="sa-styles">
              <h3 id="sa-styles" className="font-sans text-[15px] font-medium">{t(L('Sizga mos fasonlar', 'Ваши фасоны', 'Styles for you'))}</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {styles.good.map((r) => (
                  <li key={r.garment.id} className="flex gap-3 rounded-xl border border-line p-3">
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-well">
                      {r.fabric && r.color ? <FabricImage fabric={r.fabric} color={r.color} alt="" /> : <GarmentIcon type={r.garment.typeKey} className="h-14 w-10" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-1.5 font-medium">
                        <GarmentIcon type={r.garment.typeKey} className="h-6 w-4 shrink-0" />
                        <span className="truncate">{t(r.garment.name)}</span>
                      </div>
                      <p className="text-[12.5px] leading-snug text-graphite">{t(r.why)}</p>
                      {r.fabric && r.color && (
                        <p className="mt-1 truncate text-[12.5px]">
                          {t(r.fabric.name)} · {t(r.color.name)}
                        </p>
                      )}
                      <div className="mt-auto flex gap-1.5 pt-2">
                        <a
                          className="btn btn-primary btn-sm h-8 px-3 text-[12.5px]"
                          href={href('studio', { query: { garment: r.garment.typeKey, fabric: r.fabric?.id, color: r.color?.id } })}
                          onClick={onClose}
                        >
                          {t(UI.tryOn3D)}
                        </a>
                        {r.fabric && (
                          <a className="btn btn-secondary btn-sm h-8 px-3 text-[12.5px]" href={href('fabric', { id: r.fabric.id, query: { color: r.color?.id } })} onClick={onClose}>
                            {t(L('Mato', 'Ткань', 'Fabric'))}
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {styles.careful.length > 0 && (
                <div className="mt-4">
                  <p className="text-[13px] font-medium">{t(L('Ehtiyotkorlik bilan tanlang', 'Выбирайте осторожно', 'Choose with care'))}</p>
                  <ul className="mt-2 space-y-1.5">
                    {styles.careful.map((r) => (
                      <li key={r.garment.id} className="flex items-center gap-2 text-[13px] text-graphite">
                        <GarmentIcon type={r.garment.typeKey} className="h-6 w-4 shrink-0" />
                        <span>
                          <span className="text-ink">{t(r.garment.name)}</span> — {t(r.why)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Fabrics in the palette */}
            <section className="mt-8" aria-labelledby="sa-fabrics">
              <h3 id="sa-fabrics" className="font-sans text-[15px] font-medium">{t(L('Ranglaringizdagi matolar', 'Ткани ваших цветов', 'Fabrics in your colours'))}</h3>
              {colorMatches.length === 0 ? (
                <p className="mt-2 text-[13.5px] text-graphite">{t(L('Hozir katalogda bu palitraga yaqin rang yo‘q.', 'Сейчас в каталоге нет близких цветов.', 'Nothing in the catalogue is close to this palette right now.'))}</p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {colorMatches.map((m) => {
                    const sampled = hasSample(m.fabric.id, m.color.id);
                    return (
                      <li key={`${m.fabric.id}-${m.color.id}`} className="flex gap-3 rounded-xl border border-line p-3">
                        <a href={href('fabric', { id: m.fabric.id, query: { color: m.color.id } })} onClick={onClose} className="h-24 w-20 shrink-0 overflow-hidden rounded-[4px] bg-well">
                          <FabricImage fabric={m.fabric} color={m.color} alt="" />
                        </a>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="truncate font-medium">{t(m.fabric.name)}</div>
                          <div className="truncate text-[13px] text-graphite">
                            {t(m.color.name)} · {formatMoney(pricePerUnit(m.fabric, currency, unit), currency, lang)}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="h-1 w-16 overflow-hidden rounded-full bg-well" aria-hidden="true">
                              <span className="block h-full bg-ink" style={{ width: `${m.score}%` }} />
                            </span>
                            <span className="tabular text-[12.5px] text-graphite">{t(L(`sizga ${m.score}% mos`, `подходит на ${m.score}%`, `${m.score}% your palette`))}</span>
                          </div>
                          <div className="mt-auto flex gap-1.5 pt-2">
                            <a className="btn btn-secondary btn-sm h-8 px-3 text-[12.5px]" href={href('studio', { query: { fabric: m.fabric.id, color: m.color.id, garment: styles.good[0]?.garment.typeKey ?? m.fabric.bestFor[0] } })} onClick={onClose}>3D</a>
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
              )}
              <p className="mt-4 text-[12.5px] text-muted">
                {t(L(
                  'Bu avtomatik tavsiya: kamera va yorug‘lik rangni o‘zgartiradi. Aniq tusni bepul namunani yuzingizga tutib tekshiring.',
                  'Это автоматическая подсказка: камера и свет меняют цвет. Проверьте оттенок, приложив бесплатный образец к лицу.',
                  'This is an automatic suggestion: camera and light shift colour. Check the shade by holding a free sample to your face.',
                ))}
              </p>
            </section>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Tip({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-well/60 p-3">
      <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] text-white">{n}</span>
      <span>{text}</span>
    </div>
  );
}

/** Live camera with a face or full-body guide, and a self-timer so a full-length shot can be taken alone. */
function CameraCapture({
  t,
  mode,
  onCapture,
  onCancel,
  onFail,
}: {
  t: ReturnType<typeof useApp>['t'];
  mode: 'face' | 'body';
  onCapture: (b: Blob) => void;
  onCancel: () => void;
  onFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().then(() => setReady(true)).catch(() => setReady(true));
        }
      })
      .catch(() => !cancelled && onFailRef.current());
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const snap = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (facing === 'user') {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.9);
  }, [facing, onCapture]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      snap();
      return;
    }
    const id = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(id);
  }, [countdown, snap]);

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="relative mx-auto aspect-[3/4] max-h-[62vh] overflow-hidden rounded-xl bg-ink">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} />
        <svg viewBox="0 0 60 80" className="pointer-events-none absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {mode === 'face' ? (
            <>
              <ellipse cx="30" cy="36" rx="13" ry="17" fill="none" stroke="#fff" strokeWidth="0.5" strokeDasharray="1.4 1" />
              <path d="M14 78 Q16 60 30 58 Q44 60 46 78" fill="none" stroke="#fff" strokeWidth="0.5" strokeDasharray="1.4 1" />
            </>
          ) : (
            <path
              d="M30 6 a5 5.6 0 1 1 0 11.2 a5 5.6 0 1 1 0 -11.2 M24 19 Q30 21 36 19 L40 21 L42 36 L39 37 L37 28 L36.5 40 L38 47 L35 74 L31 74 L30 50 L29 74 L25 74 L22 47 L23.5 40 L23 28 L21 37 L18 36 L20 21 Z"
              fill="none"
              stroke="#fff"
              strokeWidth="0.5"
              strokeDasharray="1.4 1"
            />
          )}
        </svg>
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center font-display text-[96px] text-white" aria-live="assertive">
            {countdown}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-[13.5px] text-graphite">
        {mode === 'face'
          ? t(L('Yuzingizni oval ichiga joylang, deraza tomonga qarang.', 'Поместите лицо в овал, повернитесь к окну.', 'Fit your face in the oval and face the window.'))
          : t(L('Shablon ichiga to‘liq kiring, qo‘llarni biroz yonga oching.', 'Встаньте в контур целиком, руки чуть в стороны.', 'Fit your whole body in the outline, arms slightly out.'))}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{t(UI.back)}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label={t(L('Kamerani almashtirish', 'Сменить камеру', 'Switch camera'))}>
          <SwitchCamera className="h-4 w-4" />
        </button>
        <button type="button" className="btn btn-secondary" disabled={!ready || countdown !== null} onClick={() => setCountdown(5)}>
          <Timer className="h-4 w-4" />5 s
        </button>
        <button type="button" className="btn btn-primary" disabled={!ready || countdown !== null} onClick={snap} data-autofocus>
          <Camera className="h-4 w-4" />
          {t(L('Suratga olish', 'Снять', 'Take photo'))}
        </button>
      </div>
    </div>
  );
}
