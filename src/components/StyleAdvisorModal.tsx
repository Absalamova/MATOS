import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImageUp, PersonStanding, Plus, ScanFace, ShieldCheck, Sparkles, SwitchCamera, Timer, X } from 'lucide-react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { formatMoney, pricePerUnit } from '../lib/format';
import { href } from '../lib/router';
import { DEFAULT_MEASUREMENTS, MEASURE_LIMITS } from '../lib/measure';
import {
  analyzePortrait,
  SEASON_GUIDE,
  BodyShape,
  CONTRAST_LABEL,
  Issue,
  DEPTH_LABEL,
  matchFabrics,
  PhotoKind,
  photoKind,
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
  | { phase: 'result'; analysis: PortraitAnalysis; used: Record<Slot, Use> }
  | { phase: 'error' };

/** What each photo ended up being used for. */
type Use = { colors: boolean; figure: boolean; kind: PhotoKind } | null;

type ShapeSource = 'photo' | 'measurements' | 'manual';

const MAX_BYTES = 25 * 1024 * 1024;
const SEASON_KEYS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SHAPE_KEYS: BodyShape[] = ['hourglass', 'pear', 'inverted', 'rectangle', 'apple'];
const sameAsDefault = (m: BodyMeasurements) => m.bustCm === DEFAULT_MEASUREMENTS.bustCm && m.waistCm === DEFAULT_MEASUREMENTS.waistCm && m.hipsCm === DEFAULT_MEASUREMENTS.hipsCm;

/**
 * Each photo is used for what it actually shows, whichever slot it was put in: colours come from
 * the photo with the biggest face (a close-up beats a full-length shot), the figure from any photo
 * where a whole body could be read. A face-only selfie is therefore enough on its own.
 */
function merge(face: PortraitAnalysis | null, body: PortraitAnalysis | null): { analysis: PortraitAnalysis; used: Record<Slot, Use> } {
  const shots = (
    [
      ['face', face],
      ['body', body],
    ] as const
  ).filter((x): x is readonly [Slot, PortraitAnalysis] => !!x[1]);
  const colorShot = shots.filter(([, a]) => a.coloring).sort(([, a], [, b]) => b.coloring!.faceShare - a.coloring!.faceShare)[0];
  const figureShot = shots.filter(([, a]) => a.silhouette).sort(([, a], [, b]) => b.silhouette!.confidence - a.silhouette!.confidence)[0];
  const coloring = colorShot?.[1].coloring ?? null;
  const silhouette = figureShot?.[1].silhouette ?? null;

  const issues: Issue[] = [];
  if (!coloring) issues.push('no-skin');
  // a dark photo still yields a colour, just not one to trust
  if ((colorShot?.[1] ?? face ?? body)?.issues.includes('too-dark')) issues.push('too-dark');
  // a missing figure is only a problem when the shopper meant to give us one: a close-up in the
  // full-length slot is simply a second face photo, not a failed body photo
  if (body && !silhouette && photoKind(body) !== 'face') issues.push(...body.issues.filter((i) => i === 'busy-background' || i === 'not-full-body'));

  const use = (slot: Slot, a: PortraitAnalysis | null): Use =>
    a && { colors: colorShot?.[0] === slot, figure: figureShot?.[0] === slot, kind: photoKind(a) };
  return { analysis: { coloring, silhouette, issues }, used: { face: use('face', face), body: use('body', body) } };
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
      const { analysis, used } = merge(fa, ba);
      setShapeSource(analysis.silhouette && analysis.silhouette.confidence >= 0.4 ? 'photo' : 'measurements');
      setState({ phase: 'result', analysis, used });
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
      <li
        className={`rounded-2xl border p-3.5 transition-colors sm:p-4 ${src ? 'border-ink/25 bg-mist/60' : 'border-line bg-paper'}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files?.[0], slot); }}
      >
        <div className="flex gap-3.5">
          <div className="relative w-[84px] shrink-0">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-well">
              {src ? (
                <img src={src} alt={face ? t(L('Yuz rasmingiz', 'Ваше фото лица', 'Your face photo')) : t(L('Bo‘y rasmingiz', 'Ваше фото в рост', 'Your full-length photo'))} className="h-full w-full object-cover" />
              ) : face ? (
                <ScanFace className="h-9 w-9 text-graphite" strokeWidth={1.2} />
              ) : (
                <PersonStanding className="h-10 w-10 text-graphite" strokeWidth={1.2} />
              )}
            </div>
            {src && (
              <>
                <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ok text-white ring-2 ring-paper" aria-hidden="true">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {/* the visible dot is small, the hit area is a full 44px */}
                <button
                  type="button"
                  className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center"
                  onClick={() => setPhoto(slot, null)}
                  aria-label={`${t(UI.remove)}: ${face ? t(L('yuz rasmi', 'фото лица', 'face photo')) : t(L('bo‘y rasmi', 'фото в рост', 'full-length photo'))}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white ring-2 ring-paper">
                    <X className="h-4 w-4" />
                  </span>
                </button>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="tabular flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-white" aria-hidden="true">{face ? 1 : 2}</span>
              <p className="font-medium">{face ? t(L('Yuz rasmi', 'Фото лица', 'Face photo')) : t(L('To‘liq bo‘y rasmi', 'Фото в полный рост', 'Full-length photo'))}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] ${face ? 'bg-tape-soft text-ink' : 'bg-well text-graphite'}`}>
                {face ? t(L('ranglar uchun', 'для цветов', 'for colours')) : t(L('fason uchun · ixtiyoriy', 'для фасонов · по желанию', 'for styles · optional'))}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-graphite">
              {src
                ? t(L('Rasm qo‘shildi. Kerak bo‘lsa, qayta oling.', 'Фото добавлено. Если нужно, переснимите.', 'Photo added. Retake it if you like.'))
                : face
                  ? t(L('Yaqindan, kunduzgi yorug‘da, filtr va makiyajsiz. Soch ko‘rinsa yaxshi.', 'Крупно, при дневном свете, без фильтров и макияжа. Хорошо, если видны волосы.', 'Close-up, in daylight, no filters or make-up. Better if your hair shows.'))
                  : t(L('Boshdan oyoqqacha, oddiy devor oldida, qo‘llar biroz ochiq.', 'С головы до ног, у ровной стены, руки чуть в стороны.', 'Head to toe, against a plain wall, arms slightly out.'))}
            </p>
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button type="button" className={`btn w-full px-3 ${face && !src ? 'btn-primary' : 'btn-secondary'}`} onClick={() => openCamera(slot)} data-autofocus={face ? true : undefined}>
            <Camera className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{src ? t(L('Qayta olish', 'Переснять', 'Retake')) : t(L('Suratga olish', 'Снять', 'Take photo'))}</span>
          </button>
          <button type="button" className="btn btn-secondary w-full px-3" onClick={() => upload(slot)}>
            <ImageUp className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{t(L('Galereyadan', 'Из галереи', 'From gallery'))}</span>
          </button>
        </div>
      </li>
    );
  };

  const hasPhoto = !!(photos.face || photos.body);
  const pickFooter =
    state.phase === 'pick' ? (
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <button type="button" className="btn btn-primary h-[52px] w-full text-[15.5px] sm:h-[46px] sm:w-auto sm:text-[14.5px]" disabled={!hasPhoto} onClick={analyze}>
          <Sparkles className="h-[18px] w-[18px]" />
          {t(L('Menga mosini ko‘rsat', 'Показать, что мне идёт', 'Show what suits me'))}
        </button>
        <p className="text-center text-[12.5px] text-muted sm:text-left" aria-live="polite">
          {hasPhoto
            ? photos.face && photos.body
              ? t(L('Ikkala rasm tayyor.', 'Оба фото готовы.', 'Both photos are ready.'))
              : photos.face
              ? t(L('Tayyor. Bo‘y rasmini qo‘shish shart emas.', 'Готово. Фото в рост добавлять не обязательно.', 'Ready. A full-length photo is optional.'))
              : t(L('Ranglarni aniqlash uchun yuz rasmini ham qo‘shing.', 'Чтобы определить цвета, добавьте и фото лица.', 'Add a face photo too, to read your colours.'))
            : t(L('Avval kamida bitta rasm qo‘shing', 'Сначала добавьте хотя бы одно фото', 'Add at least one photo first'))}
        </p>
      </div>
    ) : undefined;

  return (
    <Dialog open={isOpen} onClose={onClose} title={t(L('Sizga mos uslub va ranglar', 'Ваш стиль и цвета', 'Your styles and colours'))} size="xl" closeLabel={t(UI.close)} footer={pickFooter}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], slotRef.current); e.target.value = ''; }} />
      <input ref={camInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], slotRef.current); e.target.value = ''; }} />

      {state.phase === 'pick' && (
        <div className="px-4 py-5 sm:px-8 sm:py-7">
          <p className="max-w-[66ch] text-[14.5px] leading-relaxed text-graphite">
            {t(L(
              'Yuz rasmidan teri va sochingizga mos ranglarni, bo‘y rasmidan qomatingizga mos fasonlarni tanlaymiz. Bitta yuz rasmi ham yetarli.',
              'По фото лица подберём цвета под кожу и волосы, по фото в рост — фасоны под фигуру. Достаточно одного фото лица.',
              'A face photo gives colours for your skin and hair; a full-length photo gives styles for your figure. One face photo is enough.',
            ))}
          </p>
          <p className="mt-2.5 flex items-start gap-2 text-[13px] text-graphite">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={1.8} />
            {t(L(
              'Rasmlar hech qayerga yuborilmaydi va saqlanmaydi — tahlil faqat shu qurilmada bajariladi.',
              'Фото никуда не отправляются и не сохраняются — анализ идёт только на этом устройстве.',
              'Your photos are never sent or stored — the analysis runs only on this device.',
            ))}
          </p>
          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {slotCard('face')}
            {slotCard('body')}
          </ol>
          {badFile && <p className="mt-3 text-[13.5px] text-danger" role="alert">{t(L('25 MB gacha JPG, PNG yoki WEBP rasm tanlang.', 'Выберите JPG, PNG или WEBP до 25 МБ.', 'Choose a JPG, PNG or WEBP up to 25 MB.'))}</p>}
        </div>
      )}

      {state.phase === 'camera' && (
        <CameraCapture
          t={t}
          mode={state.slot}
          onCapture={(b, slot) => {
            setPhoto(slot, b);
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
              <div key={src} className="relative aspect-[3/4] w-[min(42vw,192px)] overflow-hidden rounded-[6px] bg-well">
                <img src={src!} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 top-0 h-1 animate-[scan_1.1s_ease-in-out_infinite] bg-tape motion-reduce:animate-none" />
              </div>
            ))}
          </div>
          <p className="mt-6 font-display text-[24px]">{t(L('Rang tipi va qomat aniqlanmoqda…', 'Определяем цветотип и фигуру…', 'Reading your colouring and figure…'))}</p>
          <style>{'@keyframes scan{0%{top:0}50%{top:calc(100% - 4px)}100%{top:0}}'}</style>
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
              {(['face', 'body'] as const).map((slot) => {
                const src = photos[slot];
                const u = state.used[slot];
                if (!src) return null;
                const what =
                  u?.colors && u.figure
                    ? L('ranglar va qomat uchun', 'для цветов и фигуры', 'used for colours and figure')
                    : u?.colors
                      ? u.kind === 'face'
                        ? L('yuz — ranglar uchun', 'лицо — для цветов', 'face — used for colours')
                        : L('ranglar uchun', 'для цветов', 'used for colours')
                      : u?.figure
                        ? L('qomat uchun', 'для фигуры', 'used for figure')
                        : u?.kind === 'face'
                          ? L('yuz — boshqa rasm aniqroq', 'лицо — другое фото чётче', 'face — the other photo was clearer')
                          : L('ishlatilmadi', 'не использовано', 'not used');
                return (
                  <figure key={slot} className="w-20 shrink-0 lg:w-auto">
                    <div className="aspect-[3/4] overflow-hidden rounded-[6px] bg-well">
                      <img src={src} alt={t(L('Sizning rasmingiz', 'Ваше фото', 'Your photo'))} className="h-full w-full object-contain" />
                    </div>
                    <figcaption className="mt-1 text-[11.5px] leading-tight text-graphite">{t(what)}</figcaption>
                  </figure>
                );
              })}
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

            {/* Summary: on a phone the two answers are a long scroll apart, so show both up front */}
            <div className="mb-6 grid grid-cols-2 gap-2.5">
              <a href="#sa-colors" onClick={(e) => { e.preventDefault(); document.getElementById('sa-colors')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl border border-line p-3 transition-colors hover:border-ink">
                <span className="block text-[12px] text-graphite">{t(L('Rang tipi', 'Цветотип', 'Colour type'))}</span>
                <span className="mt-0.5 block font-display text-[22px] leading-tight">{t(SEASONS[activeSeason].name)}</span>
                <span className="mt-1.5 flex gap-1" aria-hidden="true">
                  {SEASONS[activeSeason].best.slice(0, 5).map((c) => (
                    <span key={c.hex} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
                  ))}
                </span>
              </a>
              <a href="#sa-shape" onClick={(e) => { e.preventDefault(); document.getElementById('sa-shape')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl border border-line p-3 transition-colors hover:border-ink">
                <span className="block text-[12px] text-graphite">{t(L('Qomat', 'Фигура', 'Figure'))}</span>
                <span className="mt-0.5 block font-display text-[22px] leading-tight">{t(SHAPES[activeShape].name)}</span>
                <span className="mt-1.5 block text-[12px] text-graphite">{t(L(`${styles.good.length} ta mos fason`, `${styles.good.length} подходящих фасона`, `${styles.good.length} styles for you`))}</span>
              </a>
            </div>

            {/* Colouring */}
            <section aria-labelledby="sa-colors" className="scroll-mt-4">
              <p className="label" id="sa-colors">{t(L('Rang tipingiz', 'Ваш цветотип', 'Your colour type'))}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h3 className="font-display text-[32px] leading-tight">{t(SEASONS[activeSeason].name)}</h3>
                <span className={`rounded-full px-2.5 py-1 text-[12px] ${season ? 'bg-well text-graphite' : coloring ? 'bg-ok/10 text-ok' : 'bg-tape-soft text-ink'}`}>
                  {season
                    ? t(L('o‘zingiz tanladingiz', 'выбрано вами', 'your choice'))
                    : coloring
                      ? t(L('rasmingizdan aniqlandi', 'определено по фото', 'read from your photo'))
                      : t(L('taxminiy — yuz rasmi yo‘q', 'примерно — нет фото лица', 'a guess — no face photo'))}
                </span>
              </div>
              <p className="mt-1 text-[14px] font-medium">{t(SEASON_GUIDE[activeSeason].tag)}</p>

              {/* What the season name means: people read “Kuz” as the time of year */}
              <p className="mt-3 rounded-xl bg-mist px-3.5 py-3 text-[14px] leading-relaxed">
                {t(L(
                  `“${SEASONS[activeSeason].name.uz}” — bu yil fasli emas. Bu nom sizga ${SEASON_GUIDE[activeSeason].image.uz} yarashishini bildiradi.`,
                  `«${SEASONS[activeSeason].name.ru}» — это не время года. Название значит, что вам идут ${SEASON_GUIDE[activeSeason].image.ru}.`,
                  `“${SEASONS[activeSeason].name.en}” isn’t the time of year. It means ${SEASON_GUIDE[activeSeason].image.en} suit you.`,
                ))}{' '}
                <span className="text-graphite">{t(SEASONS[activeSeason].about)}</span>
              </p>

              <dl className="mt-4 space-y-3">
                <TraitScale label={t(L('Tus', 'Подтон', 'Undertone'))} from={t(L('Iliq', 'Тёплый', 'Warm'))} to={t(L('Sovuq', 'Холодный', 'Cool'))} value={SEASON_GUIDE[activeSeason].temperature} />
                <TraitScale label={t(L('Ochlik', 'Глубина', 'Depth'))} from={t(L('Och', 'Светлый', 'Light'))} to={t(L('To‘q', 'Тёмный', 'Deep'))} value={SEASON_GUIDE[activeSeason].depth} />
                <TraitScale label={t(L('Yorqinlik', 'Яркость', 'Clarity'))} from={t(L('Yumshoq', 'Мягкий', 'Soft'))} to={t(L('Yorqin', 'Яркий', 'Clear'))} value={SEASON_GUIDE[activeSeason].clarity} />
              </dl>

              {coloring && (
                <div className="mt-4">
                  <p className="text-[13px] font-medium">{t(L('Rasmingizda nimani ko‘rdik', 'Что мы увидели на фото', 'What we saw in your photo'))}</p>
                  <ul className="mt-2 grid grid-cols-3 gap-2 text-[12.5px]">
                    <li className="rounded-lg border border-line p-2.5">
                      <span className="flex items-center gap-1.5 text-graphite">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: coloring.skin }} aria-hidden="true" />
                        {t(L('Teri tusi', 'Подтон', 'Undertone'))}
                      </span>
                      <span className="mt-0.5 block font-medium">{t(UNDERTONE_LABEL[coloring.undertone])}</span>
                    </li>
                    <li className="rounded-lg border border-line p-2.5">
                      <span className="block text-graphite">{t(L('Teri', 'Кожа', 'Skin'))}</span>
                      <span className="mt-0.5 block font-medium">{t(DEPTH_LABEL[coloring.depth])}</span>
                    </li>
                    <li className="rounded-lg border border-line p-2.5">
                      <span className="flex items-center gap-1.5 text-graphite">
                        {coloring.hair && <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: coloring.hair }} aria-hidden="true" />}
                        {t(L('Kontrast', 'Контраст', 'Contrast'))}
                      </span>
                      <span className="mt-0.5 block font-medium first-letter:uppercase">{t(CONTRAST_LABEL[coloring.contrast])}</span>
                    </li>
                  </ul>
                </div>
              )}

              <div className="mt-5">
                <p className="text-[13px] font-medium">{t(L('Sizga mos ranglar', 'Ваши цвета', 'Colours that suit you'))}</p>
                <ul className="mt-2 grid grid-cols-4 gap-x-2 gap-y-3 sm:flex sm:flex-wrap">
                  {SEASONS[activeSeason].best.map((s) => (
                    <li key={s.hex} className="flex flex-col items-center gap-1 text-center text-[11.5px] leading-tight text-graphite sm:w-[64px]">
                      <span className="h-11 w-11 rounded-full ring-1 ring-black/10" style={{ background: s.hex }} aria-hidden="true" />
                      {t(s.name)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-[13px] font-medium">{t(L('Yuzdan uzoqroq kiying', 'Носите подальше от лица', 'Keep away from your face'))}</p>
                <ul className="mt-2 grid grid-cols-4 gap-x-2 gap-y-3 sm:flex sm:flex-wrap">
                  {SEASONS[activeSeason].avoid.map((s) => (
                    <li key={s.hex} className="flex flex-col items-center gap-1 text-center text-[11.5px] leading-tight text-graphite sm:w-[64px]">
                      <span className="relative h-11 w-11 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: s.hex }} aria-hidden="true">
                        <span className="absolute left-1/2 top-[-2px] h-[48px] w-[1.5px] -translate-x-1/2 rotate-45 bg-white/90 mix-blend-difference" />
                      </span>
                      {t(s.name)}
                    </li>
                  ))}
                </ul>
              </div>

              <dl className="mt-5 grid gap-x-4 gap-y-2.5 rounded-xl border border-line p-3.5 text-[13.5px] sm:grid-cols-[auto_1fr]">
                <dt className="text-graphite">{t(L('Zargarlik', 'Украшения', 'Jewellery'))}</dt>
                <dd className="-mt-2 sm:mt-0">{t(SEASON_GUIDE[activeSeason].metal)}</dd>
                <dt className="text-graphite">{t(L('Asosiy ranglar', 'Базовые цвета', 'Base colours'))}</dt>
                <dd className="-mt-2 sm:mt-0">{t(SEASON_GUIDE[activeSeason].neutrals)}</dd>
                <dt className="text-graphite">{t(L('Maslahat', 'Совет', 'Tip'))}</dt>
                <dd className="-mt-2 sm:mt-0">{t(SEASON_GUIDE[activeSeason].tip)}</dd>
              </dl>

              <div className="mt-6">
                <p className="text-[13px] font-medium">{t(L('Boshqa rang tipini tanlash', 'Выбрать другой цветотип', 'Pick another colour type'))}</p>
                <p className="mt-0.5 text-[12.5px] text-graphite">
                  {t(L('Natija to‘g‘ri kelmasa, o‘zingizga yaqin tavsifni tanlang — tavsiyalar darhol yangilanadi.', 'Если результат не подходит, выберите близкое описание — советы обновятся сразу.', 'If it doesn’t feel right, pick the description closest to you — the advice updates at once.'))}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t(L('Rang tipini o‘zgartirish', 'Сменить цветотип', 'Change colour type'))}>
                  {SEASON_KEYS.map((s) => {
                    const on = activeSeason === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSeason(s === detectedSeason && coloring ? null : s)}
                        className={`rounded-xl border p-3 text-left transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{t(SEASONS[s].name)}</span>
                          {coloring && s === detectedSeason && (
                            <span className={`rounded-full px-1.5 text-[10.5px] ${on ? 'bg-white/20' : 'bg-well text-graphite'}`}>{t(L('rasmdan', 'по фото', 'photo'))}</span>
                          )}
                        </span>
                        <span className={`mt-0.5 block text-[11.5px] ${on ? 'text-white/75' : 'text-graphite'}`}>{t(SEASON_GUIDE[s].tag)}</span>
                        <span className="mt-2 flex" aria-hidden="true">
                          {SEASONS[s].best.slice(0, 6).map((c) => (
                            <span key={c.hex} className="h-4 flex-1 first:rounded-l-full last:rounded-r-full" style={{ background: c.hex }} />
                          ))}
                        </span>
                        <span className={`mt-2 block text-[11.5px] leading-snug ${on ? 'text-white/80' : 'text-graphite'}`}>{t(SEASON_GUIDE[s].looks)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Figure */}
            <section className="mt-10 scroll-mt-4" aria-labelledby="sa-shape">
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
                    className="chip"
                    onClick={() => { setShape(s); setShapeSource('manual'); }}
                  >
                    {t(SHAPES[s].name)}
                  </button>
                ))}
              </div>
              <form className="mt-4 grid grid-cols-3 items-end gap-2.5 sm:flex sm:flex-wrap sm:gap-3" onSubmit={applyMeasurements}>
                {(['bustCm', 'waistCm', 'hipsCm'] as const).map((k) => (
                  <label key={k} className="min-w-0 sm:w-[104px]">
                    <span className="label">
                      {t(k === 'bustCm' ? L('Ko‘krak, sm', 'Грудь, см', 'Bust, cm') : k === 'waistCm' ? L('Bel, sm', 'Талия, см', 'Waist, cm') : L('Son, sm', 'Бёдра, см', 'Hips, cm'))}
                    </span>
                    <input
                      className="field h-11"
                      inputMode="decimal"
                      type="number"
                      min={MEASURE_LIMITS[k][0]}
                      max={MEASURE_LIMITS[k][1]}
                      value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    />
                  </label>
                ))}
                <button type="submit" className="btn btn-secondary btn-sm col-span-3 h-11 sm:col-span-1">{t(L('O‘lchamlarim bo‘yicha', 'По моим меркам', 'Use my measurements'))}</button>
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
                          className="btn btn-primary btn-sm px-3.5 text-[13px]"
                          href={href('studio', { query: { garment: r.garment.typeKey, fabric: r.fabric?.id, color: r.color?.id } })}
                          onClick={onClose}
                        >
                          {t(UI.tryOn3D)}
                        </a>
                        {r.fabric && (
                          <a className="btn btn-secondary btn-sm px-3 text-[13px]" href={href('fabric', { id: r.fabric.id, query: { color: r.color?.id } })} onClick={onClose}>
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
                            <a className="btn btn-secondary btn-sm px-3 text-[13px]" href={href('studio', { query: { fabric: m.fabric.id, color: m.color.id, garment: styles.good[0]?.garment.typeKey ?? m.fabric.bestFor[0] } })} onClick={onClose}>3D</a>
                            <a className="btn btn-secondary btn-sm px-3 text-[13px]" href={href('fabric', { id: m.fabric.id, query: { color: m.color.id } })} onClick={onClose}>{t(L('Ko‘rish', 'Открыть', 'View'))}</a>
                            <button type="button" className={`btn btn-sm px-3 text-[13px] ${sampled ? 'btn-tape' : 'btn-secondary'}`} aria-pressed={sampled} onClick={() => toggleSample(m.fabric.id, m.color.id)}>
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

/** A trait as a dot on a two-ended scale, e.g. Warm ●──── Cool. */
function TraitScale({ label, from, to, value }: { label: string; from: string; to: string; value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="grid grid-cols-[78px_1fr] items-center gap-3 text-[12.5px]">
      <dt className="text-graphite">{label}</dt>
      <dd>
        <div className="relative h-1.5 rounded-full bg-well">
          <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-[3px] ring-paper" style={{ left: `${pct}%` }} aria-hidden="true" />
        </div>
        <div className="mt-1.5 flex justify-between text-[11.5px] text-graphite">
          <span className={pct <= 40 ? 'font-medium text-ink' : undefined}>{from}</span>
          <span className={pct >= 60 ? 'font-medium text-ink' : undefined}>{to}</span>
        </div>
        <span className="sr-only">{pct <= 40 ? from : pct >= 60 ? to : `${from} / ${to}`}</span>
      </dd>
    </div>
  );
}

/**
 * Live camera with a face or full-body guide (switchable in place, so a shopper who only wants a
 * selfie is never stuck with the full-length outline), a low-light warning, and a self-timer so a
 * full-length shot can be taken alone.
 */
function CameraCapture({
  t,
  mode: initialMode,
  onCapture,
  onCancel,
  onFail,
}: {
  t: ReturnType<typeof useApp>['t'];
  mode: Slot;
  onCapture: (b: Blob, slot: Slot) => void;
  onCancel: () => void;
  onFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Slot>(initialMode);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timer, setTimer] = useState(initialMode === 'body');
  const [dark, setDark] = useState(false);
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
    c.toBlob((b) => b && onCapture(b, mode), 'image/jpeg', 0.9);
  }, [facing, mode, onCapture]);

  // Low light is the most common reason the skin tone can't be read; say so before the shot.
  useEffect(() => {
    if (!ready) return;
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      ctx.drawImage(v, 0, 0, 24, 24);
      const d = ctx.getImageData(0, 0, 24, 24).data;
      let y = 0;
      for (let i = 0; i < d.length; i += 4) y += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      setDark(y / (d.length / 4) < 70);
    }, 700);
    return () => window.clearInterval(id);
  }, [ready]);

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
    <div className="flex min-h-full flex-col px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-3 flex justify-center">
        <div className="inline-flex rounded-full bg-well p-1" role="radiogroup" aria-label={t(L('Nimani suratga olamiz', 'Что снимаем', 'What to photograph'))}>
          {(['face', 'body'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => { setMode(m); if (m === 'body') setTimer(true); }}
              className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] transition-colors ${mode === m ? 'bg-paper text-ink shadow-sm' : 'text-graphite hover:text-ink'}`}
            >
              {m === 'face' ? <ScanFace className="h-4 w-4" /> : <PersonStanding className="h-4 w-4" />}
              {m === 'face' ? t(L('Faqat yuz', 'Только лицо', 'Face only')) : t(L('To‘liq bo‘y', 'В полный рост', 'Full length'))}
            </button>
          ))}
        </div>
      </div>
      {/* sized from the viewport height so the shutter row always stays on screen */}
      <div className="relative mx-auto aspect-[3/4] overflow-hidden rounded-2xl bg-ink" style={{ width: 'min(100%, calc((100dvh - 330px) * 0.75), 520px)' }}>
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
        {dark && (
          <p className="absolute inset-x-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-center text-[12.5px] text-white" role="status">
            {t(L(
              'Yorug‘lik kam — rang noto‘g‘ri chiqadi. Deraza yoki chiroq tomonga qarang.',
              'Мало света — цвет исказится. Повернитесь к окну или лампе.',
              'Too dark — colours will be off. Face a window or a lamp.',
            ))}
          </p>
        )}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center font-display text-[96px] text-white" aria-live="assertive">
            {countdown}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-[13.5px] text-graphite">
        {mode === 'face'
          ? t(L('Yuzingizni oval ichiga joylang, deraza tomonga qarang.', 'Поместите лицо в овал, повернитесь к окну.', 'Fit your face in the oval and face the window.'))
          : t(L('Telefonni qo‘ying, 5 soniyada shablonga to‘liq kiring.', 'Поставьте телефон и за 5 секунд встаньте в контур.', 'Prop the phone up and step into the outline within 5 seconds.'))}
      </p>
      {/* camera-app layout: back · shutter · switch, with the self-timer as a toggle */}
      <div className="mx-auto mt-auto grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3 pt-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-start">
          <button type="button" className="btn btn-ghost px-3" onClick={onCancel}>{t(UI.back)}</button>
        </div>
        <button
          type="button"
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-ink/85 transition-transform active:scale-95 disabled:opacity-40"
          disabled={!ready}
          onClick={() => (countdown !== null ? setCountdown(null) : timer ? setCountdown(5) : snap())}
          aria-label={countdown !== null ? t(L('Taymerni to‘xtatish', 'Остановить таймер', 'Stop the timer')) : t(L('Suratga olish', 'Снять', 'Take photo'))}
          data-autofocus
        >
          <span className={`flex h-[58px] w-[58px] items-center justify-center rounded-full text-white ${countdown !== null ? 'bg-danger' : 'bg-ink'}`}>
            {countdown !== null ? <X className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
          </span>
        </button>
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className={`icon-btn h-11 w-11 border ${timer ? 'border-ink bg-ink text-white hover:bg-ink' : 'border-line'}`}
            aria-pressed={timer}
            onClick={() => setTimer(!timer)}
            aria-label={t(L('5 soniyali taymer', 'Таймер 5 секунд', '5-second timer'))}
            title={t(L('5 soniyali taymer', 'Таймер 5 секунд', '5-second timer'))}
          >
            <Timer className="h-5 w-5" />
          </button>
          <button type="button" className="icon-btn h-11 w-11 border border-line" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label={t(L('Kamerani almashtirish', 'Сменить камеру', 'Switch camera'))}>
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] text-muted" aria-live="polite">
        {timer ? t(L('Taymer yoqilgan: tugmani bosgach 5 soniyadan keyin suratga oladi', 'Таймер включён: снимок через 5 секунд после нажатия', 'Timer on: the photo is taken 5 seconds after you tap')) : '\u00a0'}
      </p>
    </div>
  );
}
