import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import type { AdminColorInput, AdminFabric, AdminFabricInput, FabricCategory, FabricPhotos, GarmentTypeKey, Localized, WeavePattern } from '../../../shared/types';
import { CATEGORY_LABELS } from '../../../shared/catalog';
import { GARMENTS } from '../../../shared/garments';
import { drawWeave } from '../../../src/lib/weave';
import { api, ApiError, errorMessage, photoUrl, STORE_URL } from '../api';
import { go, money, prepareImage } from '../lib';
import { useStats } from '../Layout';
import { ErrorBox, Field, Skeleton, useUi } from '../ui';

type Lang = keyof Localized;
const LANGS: { id: Lang; label: string }[] = [
  { id: 'uz', label: 'O‘zbekcha' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

const PATTERNS: { id: WeavePattern; label: string }[] = [
  { id: 'plain', label: 'Polotno (oddiy)' },
  { id: 'canvas', label: 'Kanvas (zich)' },
  { id: 'twill', label: 'Tvil (diagonal)' },
  { id: 'gingham', label: 'Katak' },
  { id: 'ikat', label: 'Ikat / adras' },
  { id: 'crepe', label: 'Krep' },
  { id: 'jersey', label: 'Trikotaj' },
];

const PHOTO_SLOTS: { id: keyof FabricPhotos; label: string; hint: string }[] = [
  { id: 'swatch', label: 'Asosiy surat', hint: 'Yaqindan, kunduzgi yorug‘likda' },
  { id: 'hang', label: 'Tushishi', hint: 'Osilgan holatda' },
  { id: 'roll', label: 'Rulon', hint: '' },
  { id: 'ruler', label: 'Chizg‘ich bilan', hint: 'O‘lchamni ko‘rsatish uchun' },
  { id: 'tile', label: '3D tekstura', hint: 'Choksiz kvadrat, 512×512' },
];

const L0: Localized = { uz: '', ru: '', en: '' };
const EMPTY_PHOTOS: FabricPhotos = { swatch: '', hang: '', roll: '', ruler: '', tile: '' };

const blankColor = (): AdminColorInput => ({ name: { ...L0 }, hex: '#C8BFB0', roughness: 0.85, metalness: 0, stockM: 50, active: true, photos: { ...EMPTY_PHOTOS } });

const blankFabric = (): AdminFabricInput => ({
  name: { ...L0 },
  status: 'active',
  sort: 0,
  category: 'linen',
  organic: false,
  pattern: 'plain',
  origin: { ...L0 },
  seller: { name: 'MATOS ombori', city: { uz: 'Toshkent', ru: 'Ташкент', en: 'Tashkent' } },
  gsm: 180,
  widthCm: 145,
  composition: { ...L0 },
  priceUZS: 0,
  drapeFactor: 8,
  drapeText: { ...L0 },
  certifications: [],
  shrinkageRate: 2,
  care: { ...L0 },
  description: { ...L0 },
  bestFor: [],
  colors: [blankColor()],
});

const toInput = (f: AdminFabric): AdminFabricInput => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = f;
  return { ...rest, colors: f.colors.map((c) => ({ ...c, photos: { ...EMPTY_PHOTOS, ...(c.photos ?? {}) } })) };
};

/** Drawn cloth preview for colours without a photo — the same weave the store and 3D studio use. */
export function Swatch({ pattern, hex }: { pattern: WeavePattern; hex: string }) {
  const url = useMemo(() => {
    try {
      return drawWeave(pattern, /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#cccccc', 160).color.toDataURL('image/jpeg', 0.8);
    } catch {
      return '';
    }
  }, [pattern, hex]);
  return <span className="block h-full w-full bg-cover bg-center" style={{ backgroundColor: hex, backgroundImage: url ? `url("${url}")` : undefined }} aria-hidden="true" />;
}

export function FabricEditor({ id }: { id: string | null }) {
  const isNew = !id;
  const { toast, confirm } = useUi();
  const { refresh } = useStats();
  const [form, setForm] = useState<AdminFabricInput | null>(isNew ? blankFabric() : null);
  const [saved, setSaved] = useState<string>(isNew ? '' : '');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [lang, setLang] = useState<Lang>('uz');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [certText, setCertText] = useState('');

  useEffect(() => {
    if (isNew) {
      const b = blankFabric();
      setForm(b);
      setSaved(JSON.stringify(b));
      setCertText('');
      return;
    }
    setForm(null);
    api
      .fabric(id!)
      .then((f) => {
        const input = toInput(f);
        setForm(input);
        setSaved(JSON.stringify(input));
        setCertText(f.certifications.join(', '));
      })
      .catch(setLoadError);
  }, [id, isNew]);

  const dirty = !!form && JSON.stringify({ ...form, certifications: splitCerts(certText) }) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loadError) {
    return (
      <>
        <BackLink />
        <ErrorBox error={loadError} />
      </>
    );
  }
  if (!form) {
    return (
      <>
        <BackLink />
        <div className="card">
          <Skeleton rows={8} />
        </div>
      </>
    );
  }

  const set = <K extends keyof AdminFabricInput>(k: K, v: AdminFabricInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setL = (k: 'name' | 'origin' | 'composition' | 'drapeText' | 'care' | 'description', v: string) => setForm((f) => (f ? { ...f, [k]: { ...f[k], [lang]: v } } : f));
  const setColor = (i: number, patch: Partial<AdminColorInput>) => setForm((f) => (f ? { ...f, colors: f.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : f));
  const err = (k: string) => errors[k];

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.uz.trim().length < 1) e['name.uz'] = 'Nomini o‘zbekcha yozing';
    if (!form.composition.uz.trim()) e['composition.uz'] = 'Tarkibini yozing';
    if (!form.description.uz.trim()) e['description.uz'] = 'Qisqa tavsif yozing';
    if (!(form.priceUZS > 0)) e.priceUZS = 'Narxni kiriting';
    if (!(form.gsm >= 20 && form.gsm <= 1000)) e.gsm = '20–1000 g/m²';
    if (!(form.widthCm >= 30 && form.widthCm <= 400)) e.widthCm = '30–400 sm';
    if (!form.seller.name.trim()) e['seller.name'] = 'Sotuvchini yozing';
    if (!form.colors.length) e.colors = 'Kamida bitta rang qo‘shing';
    form.colors.forEach((c, i) => {
      if (!c.name.uz.trim()) e[`colors[${i}].name.uz`] = 'Rang nomini yozing';
      if (!/^#[0-9a-fA-F]{6}$/.test(c.hex)) e[`colors[${i}].hex`] = '#RRGGBB';
      if (!(c.stockM >= 0)) e[`colors[${i}].stockM`] = '0 yoki ko‘p';
    });
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      if (Object.keys(e).some((k) => k.endsWith('.uz'))) setLang('uz');
      toast('Belgilangan maydonlarni to‘ldiring', 'error');
      return;
    }
    setBusy(true);
    try {
      const body: AdminFabricInput = { ...form, certifications: splitCerts(certText) };
      const result = await api.saveFabric(id, body);
      const input = toInput(result);
      setForm(input);
      setSaved(JSON.stringify(input));
      setCertText(result.certifications.join(', '));
      refresh();
      toast(isNew ? 'Mato qo‘shildi — saytda chiqdi' : 'O‘zgarishlar saqlandi');
      if (isNew) go(`fabrics/${encodeURIComponent(result.id)}`, { replace: true });
    } catch (ex) {
      if (ex instanceof ApiError && ex.fields) setErrors(ex.fields);
      toast(errorMessage(ex), 'error');
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!id) return;
    const ok = await confirm({
      title: `“${form.name.uz}” o‘chirilsinmi?`,
      text: 'Mato saytdan va paneldan olib tashlanadi. Eski buyurtmalardagi ma’lumot saqlanib qoladi.',
      confirm: 'O‘chirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.archiveFabric(id);
      refresh();
      toast('Mato o‘chirildi');
      go('fabrics');
    } catch (ex) {
      toast(errorMessage(ex), 'error');
    }
  };

  const removeColor = async (i: number) => {
    const c = form.colors[i];
    const ok = await confirm({
      title: `“${c.name.uz || 'Yangi rang'}” rangini o‘chirasizmi?`,
      text: 'Saqlaganingizdan keyin bu rang saytdan olib tashlanadi. Vaqtincha yashirish uchun “Sotuvda” belgisini olib qo‘ying.',
      confirm: 'O‘chirish',
      danger: true,
    });
    if (ok) set('colors', form.colors.filter((_, j) => j !== i));
  };

  const moveColor = (i: number, d: -1 | 1) => {
    const next = [...form.colors];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set('colors', next);
  };

  const L = (k: 'name' | 'origin' | 'composition' | 'drapeText' | 'care' | 'description') => form[k][lang];
  const ph = (k: 'name' | 'origin' | 'composition' | 'drapeText' | 'care' | 'description') => (lang !== 'uz' && form[k].uz ? `${form[k].uz} (o‘zbekcha ko‘rinadi)` : '');
  const req = lang === 'uz' ? ' *' : '';

  return (
    <div className="pb-24">
      <BackLink />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[30px] sm:text-[34px]">{isNew ? 'Yangi mato' : form.name.uz || 'Mato'}</h1>
          {!isNew && <p className="mt-1 text-[13px] text-muted">ID: {id}</p>}
        </div>
        {!isNew && (
          <a href={`${STORE_URL}#/fabric/${encodeURIComponent(id!)}`} target="_blank" rel="noopener" className="btn btn-secondary self-start">
            <ExternalLink className="h-4 w-4" /> Saytda ko‘rish
          </a>
        )}
      </div>

      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-mist/95 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-paper/95 lg:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-graphite">Matn tili:</span>
          {LANGS.map((l) => (
            <button key={l.id} type="button" className="chip" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
          <span className="hidden text-[12px] text-muted md:inline">Ruscha va inglizcha bo‘sh qolsa, saytda o‘zbekchasi ko‘rinadi.</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="font-sans text-[15px] font-semibold">Asosiy</h2>
            <Field label={`Nomi${req}`} error={err(`name.${lang}`)}>
              <input className="field" value={L('name')} placeholder={ph('name')} onChange={(e) => setL('name', e.target.value)} aria-invalid={!!err(`name.${lang}`)} maxLength={120} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Turkum">
                <select className="field" value={form.category} onChange={(e) => set('category', e.target.value as FabricCategory)}>
                  {(Object.keys(CATEGORY_LABELS) as FabricCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c].uz}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="To‘quv turi" hint="Surati yo‘q ranglar va 3D tekstura shu bo‘yicha chiziladi">
                <select className="field" value={form.pattern} onChange={(e) => set('pattern', e.target.value as WeavePattern)}>
                  {PATTERNS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-ink" checked={form.status === 'active'} onChange={(e) => set('status', e.target.checked ? 'active' : 'hidden')} />
                Saytda sotuvda
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-ink" checked={form.organic} onChange={(e) => set('organic', e.target.checked)} />
                Organik
              </label>
              <label className="flex items-center gap-2">
                Tartib
                <input className="field h-8 w-20" type="number" value={form.sort} onChange={(e) => set('sort', Math.round(Number(e.target.value) || 0))} aria-label="Katalogdagi tartib raqami" />
              </label>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-sans text-[15px] font-semibold">Narx va xususiyatlar</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Narx, so‘m / metr *" error={err('priceUZS')} hint={form.priceUZS > 0 ? money(form.priceUZS) : undefined}>
                <input className="field tabular" type="number" inputMode="numeric" min={0} step={1000} value={form.priceUZS || ''} onChange={(e) => set('priceUZS', Math.max(0, Math.round(Number(e.target.value) || 0)))} aria-invalid={!!err('priceUZS')} />
              </Field>
              <Field label="Zichlik, g/m² *" error={err('gsm')}>
                <input className="field tabular" type="number" inputMode="numeric" min={20} max={1000} value={form.gsm || ''} onChange={(e) => set('gsm', Math.round(Number(e.target.value) || 0))} aria-invalid={!!err('gsm')} />
              </Field>
              <Field label="Eni, sm *" error={err('widthCm')}>
                <input className="field tabular" type="number" inputMode="numeric" min={30} max={400} value={form.widthCm || ''} onChange={(e) => set('widthCm', Math.round(Number(e.target.value) || 0))} aria-invalid={!!err('widthCm')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label={`Tushishi: ${form.drapeFactor.toFixed(1)} / 10`} hint="1 — qattiq, shaklini ushlaydi · 10 — suvdek oqadi (3D shunga qarab kiyadi)">
                <input className="mt-2 w-full accent-ink" type="range" min={1} max={10} step={0.1} value={form.drapeFactor} onChange={(e) => set('drapeFactor', Number(e.target.value))} />
              </Field>
              <Field label="Qisqarishi, %">
                <input className="field tabular" type="number" min={0} max={20} step={0.1} value={form.shrinkageRate} onChange={(e) => set('shrinkageRate', Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            </div>
            <Field label={`Tarkibi${req}`} error={err(`composition.${lang}`)}>
              <input className="field" value={L('composition')} placeholder={ph('composition') || '100% zig‘ir'} onChange={(e) => setL('composition', e.target.value)} aria-invalid={!!err(`composition.${lang}`)} maxLength={200} />
            </Field>
            <Field label="Tushishi haqida qisqacha">
              <input className="field" value={L('drapeText')} placeholder={ph('drapeText') || 'Yumshoq, havodor to‘kiladi'} onChange={(e) => setL('drapeText', e.target.value)} maxLength={160} />
            </Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-sans text-[15px] font-semibold">Tavsif</h2>
            <Field label={`Tavsif${req}`} error={err(`description.${lang}`)}>
              <textarea className="field" rows={4} value={L('description')} placeholder={ph('description') || 'Mato nimasi bilan yaxshi va nimaga mos'} onChange={(e) => setL('description', e.target.value)} aria-invalid={!!err(`description.${lang}`)} maxLength={2000} />
            </Field>
            <Field label="Parvarish">
              <textarea className="field" rows={2} value={L('care')} placeholder={ph('care') || '30° da yuving, ichidan dazmollang'} onChange={(e) => setL('care', e.target.value)} maxLength={400} />
            </Field>
            <Field label="Kelib chiqishi">
              <input className="field" value={L('origin')} placeholder={ph('origin') || 'Marg‘ilon, qo‘l dastgohi'} onChange={(e) => setL('origin', e.target.value)} maxLength={200} />
            </Field>
            <Field label="Sertifikatlar" hint="Vergul bilan ajrating: GOTS, OEKO-TEX® 100">
              <input className="field" value={certText} onChange={(e) => setCertText(e.target.value)} />
            </Field>
            <fieldset>
              <legend className="label">Qaysi fasonlarga mos (tavsiyalar va 3D uchun)</legend>
              <div className="flex flex-wrap gap-1.5">
                {GARMENTS.map((g) => {
                  const on = form.bestFor.includes(g.typeKey);
                  return (
                    <button
                      key={g.typeKey}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      onClick={() => set('bestFor', on ? form.bestFor.filter((x) => x !== g.typeKey) : ([...form.bestFor, g.typeKey] as GarmentTypeKey[]))}
                    >
                      {g.name.uz}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-sans text-[15px] font-semibold">Sotuvchi</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Do‘kon yoki ishlab chiqaruvchi *" error={err('seller.name')}>
                <input className="field" value={form.seller.name} onChange={(e) => set('seller', { ...form.seller, name: e.target.value })} maxLength={120} />
              </Field>
              <Field label="Shahar">
                <input className="field" value={form.seller.city[lang]} placeholder={lang !== 'uz' ? form.seller.city.uz : ''} onChange={(e) => set('seller', { ...form.seller, city: { ...form.seller.city, [lang]: e.target.value } })} maxLength={80} />
              </Field>
            </div>
          </section>
        </div>

        <section className="space-y-3" aria-labelledby="colors-h">
          <div className="flex items-center justify-between">
            <h2 id="colors-h" className="font-sans text-[15px] font-semibold">
              Ranglar <span className="font-normal text-graphite">({form.colors.length})</span>
            </h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('colors', [...form.colors, blankColor()])}>
              <Plus className="h-4 w-4" /> Rang qo‘shish
            </button>
          </div>
          {err('colors') && <p className="text-[13px] text-danger">{err('colors')}</p>}
          {form.colors.map((c, i) => (
            <ColorCard
              key={c.id ?? `new-${i}`}
              c={c}
              i={i}
              count={form.colors.length}
              pattern={form.pattern}
              lang={lang}
              errors={errors}
              onChange={(patch) => setColor(i, patch)}
              onRemove={() => removeColor(i)}
              onMove={(d) => moveColor(i, d)}
            />
          ))}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="text-[13px] text-graphite">{dirty ? 'Saqlanmagan o‘zgarishlar bor' : isNew ? 'Yangi mato' : 'Hammasi saqlangan'}</div>
          <div className="flex gap-2">
            {!isNew && (
              <button type="button" className="btn btn-danger" onClick={archive} disabled={busy}>
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">O‘chirish</span>
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || (!dirty && !isNew)}>
              {busy ? 'Saqlanmoqda…' : isNew ? 'Matoni qo‘shish' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const splitCerts = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);

function BackLink() {
  return (
    <a href="#/fabrics" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-graphite hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> Matolar
    </a>
  );
}

function ColorCard({
  c,
  i,
  count,
  pattern,
  lang,
  errors,
  onChange,
  onRemove,
  onMove,
}: {
  c: AdminColorInput;
  i: number;
  count: number;
  pattern: WeavePattern;
  lang: Lang;
  errors: Record<string, string>;
  onChange: (p: Partial<AdminColorInput>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const { toast } = useUi();
  const [uploading, setUploading] = useState<keyof FabricPhotos | null>(null);
  const [more, setMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<keyof FabricPhotos>('swatch');
  const photos = { ...EMPTY_PHOTOS, ...(c.photos ?? {}) };
  const e = (k: string) => errors[`colors[${i}].${k}`];

  const pick = (slot: keyof FabricPhotos) => {
    slotRef.current = slot;
    fileRef.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const slot = slotRef.current;
    setUploading(slot);
    try {
      const blob = await prepareImage(file, slot === 'tile' ? 1024 : 1600);
      const url = await api.upload(blob);
      onChange({ photos: { ...photos, [slot]: url } });
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : errorMessage(ex), 'error');
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <article className={`card p-4 ${c.active ? '' : 'opacity-75'}`}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(ev) => onFile(ev.target.files?.[0])} />
      <div className="flex gap-4">
        <button type="button" onClick={() => pick('swatch')} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-well" aria-label="Asosiy suratni yuklash">
          {photos.swatch ? <img src={photoUrl(photos.swatch)} alt="" className="h-full w-full object-cover" /> : <Swatch pattern={pattern} hex={c.hex} />}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink/70 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImagePlus className="h-3.5 w-3.5" /> {uploading === 'swatch' ? 'Yuklanmoqda…' : 'Surat'}
          </span>
        </button>
        <div className="min-w-0 flex-1 space-y-2.5">
          <Field label={`Rang nomi${lang === 'uz' ? ' *' : ''}`} error={e(`name.${lang}`)}>
            <input
              className="field"
              value={c.name[lang]}
              placeholder={lang !== 'uz' ? c.name.uz : 'Masalan: Zumrad'}
              onChange={(ev) => onChange({ name: { ...c.name, [lang]: ev.target.value } })}
              aria-invalid={!!e(`name.${lang}`)}
              maxLength={80}
            />
          </Field>
          <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-2">
            <input type="color" className="h-10 w-10 cursor-pointer rounded-lg border border-line bg-paper p-1" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#cccccc'} onChange={(ev) => onChange({ hex: ev.target.value.toUpperCase() })} aria-label="Rangni tanlash" />
            <Field label="HEX" error={e('hex')}>
              <input className="field tabular uppercase" value={c.hex} onChange={(ev) => onChange({ hex: ev.target.value.trim() })} maxLength={7} aria-invalid={!!e('hex')} />
            </Field>
            <Field label="Omborda, m" error={e('stockM')}>
              <input className="field tabular" type="number" min={0} step={0.5} value={Number.isFinite(c.stockM) ? c.stockM : ''} onChange={(ev) => onChange({ stockM: Math.max(0, Number(ev.target.value) || 0) })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" className="h-4 w-4 accent-ink" checked={c.active} onChange={(ev) => onChange({ active: ev.target.checked })} />
          Sotuvda
        </label>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMore((m) => !m)} aria-expanded={more}>
            {more ? 'Yopish' : 'Suratlar va yuzasi'}
          </button>
          <button type="button" className="icon-btn disabled:opacity-30" disabled={i === 0} onClick={() => onMove(-1)} aria-label="Yuqoriga">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" className="icon-btn disabled:opacity-30" disabled={i === count - 1} onClick={() => onMove(1)} aria-label="Pastga">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" className="icon-btn text-danger disabled:opacity-30" disabled={count <= 1} onClick={onRemove} aria-label="Rangni o‘chirish">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {more && (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PHOTO_SLOTS.map((s) => (
              <div key={s.id} className="min-w-0">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-line bg-mist">
                  {photos[s.id] ? (
                    <>
                      <img src={photoUrl(photos[s.id])} alt="" className="h-full w-full object-cover" />
                      <button type="button" className="absolute right-1 top-1 rounded-full bg-paper/90 p-1 shadow" onClick={() => onChange({ photos: { ...photos, [s.id]: '' } })} aria-label={`${s.label}: o‘chirish`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button type="button" className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11.5px] text-graphite hover:text-ink" onClick={() => pick(s.id)} disabled={!!uploading}>
                      <ImagePlus className="h-4 w-4" />
                      {uploading === s.id ? '…' : 'Yuklash'}
                    </button>
                  )}
                </div>
                <div className="mt-1 truncate text-[12px] font-medium" title={s.hint}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted">JPG, PNG yoki WEBP. Katta rasmlar yuklashdan oldin avtomatik kichraytiriladi. “Asosiy surat” bo‘lmasa, sayt to‘quvni rang bo‘yicha chizib ko‘rsatadi.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Matlik: ${c.roughness.toFixed(2)}`} hint="0 — yaltiroq ipak, 1 — mat zig‘ir">
              <input className="mt-2 w-full accent-ink" type="range" min={0.2} max={1} step={0.01} value={c.roughness} onChange={(ev) => onChange({ roughness: Number(ev.target.value) })} />
            </Field>
            <Field label={`Jilo: ${(c.sheen ?? 0).toFixed(2)}`} hint="Ipak va atlas uchun 0.8–0.9">
              <input className="mt-2 w-full accent-ink" type="range" min={0} max={1} step={0.01} value={c.sheen ?? 0} onChange={(ev) => onChange({ sheen: Number(ev.target.value) || undefined })} />
            </Field>
          </div>
        </div>
      )}
    </article>
  );
}
