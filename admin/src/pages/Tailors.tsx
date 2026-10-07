import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Star, X } from 'lucide-react';
import type { AdminTailor, Localized, SpecialtyKey, TailorStatus } from '../../../shared/types';
import { CITIES, SPECIALTIES, specialtyFor } from '../../../shared/tailors';
import { TAILOR_STATUS_LABEL } from '../../../shared/status';
import { displayPhone, formatPhoneInput, isValidPhone, normalizePhone } from '../../../shared/phone';
import { api, ApiError, errorMessage } from '../api';
import { go, money, num, useLoad, when, type Route } from '../lib';
import { useStats } from '../Layout';
import { Chips, Empty, ErrorBox, Field, Overlay, PageHeader, SearchBox, Skeleton, TailorBadge, useUi } from '../ui';

type Draft = {
  status: TailorStatus;
  sort: number;
  name: string;
  atelierName: string;
  city: string;
  district: string;
  address: string;
  specialtyKey: SpecialtyKey;
  experienceYears: number;
  rating: number | null;
  reviewsCount: number;
  completedOrders: number;
  priceStartingUZS: number;
  leadDays: number;
  phone: string;
  telegram: string;
  description: Localized;
};

const toDraft = (t?: AdminTailor): Draft =>
  t
    ? {
        status: t.status,
        sort: t.sort,
        name: t.name,
        atelierName: t.atelierName,
        city: t.city,
        district: t.district,
        address: t.address,
        specialtyKey: t.specialtyKey,
        experienceYears: t.experienceYears,
        rating: t.rating,
        reviewsCount: t.reviewsCount,
        completedOrders: t.completedOrders,
        priceStartingUZS: t.priceStartingUZS,
        leadDays: t.leadDays,
        phone: displayPhone(t.phone),
        telegram: t.telegram,
        description: { uz: t.description.uz ?? '', ru: t.description.ru ?? '', en: t.description.en ?? '' },
      }
    : {
        status: 'approved',
        sort: 0,
        name: '',
        atelierName: '',
        city: 'Toshkent',
        district: '',
        address: '',
        specialtyKey: 'couture',
        experienceYears: 5,
        rating: null,
        reviewsCount: 0,
        completedOrders: 0,
        priceStartingUZS: 300000,
        leadDays: 14,
        phone: '+998 ',
        telegram: '',
        description: { uz: '', ru: '', en: '' },
      };

export function Tailors({ route }: { route: Route }) {
  const status = (route.query.get('status') as TailorStatus | null) ?? '';
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminTailor | 'new' | null>(null);
  const list = useLoad(() => api.tailors(), []);
  const { toast } = useUi();
  const { refresh } = useStats();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((t) => (!status || t.status === status) && (!q || [t.atelierName, t.name, t.city, t.district, t.phone].join(' ').toLowerCase().includes(q)));
  }, [list.data, status, search]);
  const count = (s: TailorStatus) => (list.data ?? []).filter((t) => t.status === s).length;

  const setStatus = async (t: AdminTailor, s: TailorStatus) => {
    try {
      const next = await api.setTailorStatus(t.id, s);
      list.setData((d) => d?.map((x) => (x.id === next.id ? next : x)) ?? d);
      refresh();
      toast(s === 'approved' ? `${t.atelierName} saytda chiqdi` : `${t.atelierName}: ${TAILOR_STATUS_LABEL[s].uz.toLowerCase()}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Atelyelar"
        sub="Hamkor tikuvchilar. Saytdan kelgan arizalar tekshiruvdan keyin “Faol” bo‘lsa, ro‘yxatda chiqadi."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Atelye qo‘shish
          </button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips
          value={status}
          onChange={(s) => go('tailors', { replace: true, query: { status: s || undefined } })}
          options={[
            { id: '', label: 'Hammasi' },
            ...(['pending', 'approved', 'hidden', 'rejected'] as TailorStatus[]).map((s) => ({ id: s, label: TAILOR_STATUS_LABEL[s].uz, count: count(s) })),
          ]}
          label="Holat"
        />
        <SearchBox value={search} onChange={setSearch} placeholder="Atelye, usta yoki shahar" />
      </div>

      <section className="card overflow-hidden">
        {list.error ? (
          <div className="p-4">
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : !list.data ? (
          <Skeleton rows={6} />
        ) : rows.length === 0 ? (
          <Empty title="Hech narsa topilmadi" text={status === 'pending' ? 'Yangi ariza yo‘q.' : 'Filtr yoki qidiruvni o‘zgartiring.'} />
        ) : (
          <ul>
            {rows.map((t) => (
              <li key={t.id} className={`border-t border-line px-4 py-3.5 first:border-0 ${t.status === 'pending' ? 'needs-action' : ''}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.atelierName}</span>
                      <TailorBadge status={t.status} />
                      {t.rating && t.reviewsCount > 1 ? (
                        <span className="tabular inline-flex items-center gap-1 text-[12.5px]">
                          <Star className="h-3.5 w-3.5 fill-ink" /> {num(t.rating, 1)} ({t.reviewsCount})
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-graphite">
                      {t.name} · {t.city}
                      {t.district ? `, ${t.district}` : ''} · {specialtyFor(t.specialtyKey).label.uz} · {money(t.priceStartingUZS)} dan
                    </div>
                    <div className="tabular mt-0.5 text-[12.5px] text-muted">
                      {displayPhone(t.phone)}
                      {t.telegram ? ` · ${t.telegram}` : ''} · qo‘shilgan {when(t.createdAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {t.status === 'pending' && (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(t, 'approved')}>
                          <Check className="h-4 w-4" /> Tasdiqlash
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setStatus(t, 'rejected')}>
                          <X className="h-4 w-4" /> Rad etish
                        </button>
                      </>
                    )}
                    {t.status === 'approved' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(t, 'hidden')}>
                        Yashirish
                      </button>
                    )}
                    {(t.status === 'hidden' || t.status === 'rejected') && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(t, 'approved')}>
                        Faollashtirish
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(t)} aria-label={`${t.atelierName}: tahrirlash`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TailorForm
        key={editing === 'new' ? 'new' : (editing?.id ?? 'none')}
        tailor={editing}
        onClose={() => setEditing(null)}
        onSaved={(t, isNew) => {
          list.setData((d) => (d ? (isNew ? [t, ...d] : d.map((x) => (x.id === t.id ? t : x))) : d));
          refresh();
          setEditing(null);
        }}
        onDeleted={(id, hidden) => {
          list.setData((d) => (d ? (hidden ? d.map((x) => (x.id === id ? { ...x, status: 'hidden' as const } : x)) : d.filter((x) => x.id !== id)) : d));
          refresh();
          setEditing(null);
        }}
      />
    </>
  );
}

function TailorForm({
  tailor,
  onClose,
  onSaved,
  onDeleted,
}: {
  tailor: AdminTailor | 'new' | null;
  onClose: () => void;
  onSaved: (t: AdminTailor, isNew: boolean) => void;
  onDeleted: (id: string, hidden: boolean) => void;
}) {
  const isNew = tailor === 'new';
  const existing = tailor && tailor !== 'new' ? tailor : undefined;
  const [d, setD] = useState<Draft>(() => toDraft(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { toast, confirm } = useUi();
  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const e: Record<string, string> = {};
    if (d.name.trim().length < 2) e.name = 'Usta ismini yozing';
    if (d.atelierName.trim().length < 2) e.atelierName = 'Atelye nomini yozing';
    if (!isValidPhone(d.phone)) e.phone = '+998 XX XXX XX XX';
    if (!d.description.uz.trim()) e['description.uz'] = 'Qisqa tavsif yozing';
    if (d.telegram && !/^@?[A-Za-z0-9_]{3,32}$/.test(d.telegram.trim())) e.telegram = '@username';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const t = await api.saveTailor(existing?.id ?? null, { ...d, phone: normalizePhone(d.phone), telegram: d.telegram.trim().replace(/^@/, ''), rating: d.rating || null });
      toast(isNew ? 'Atelye qo‘shildi' : 'Saqlandi');
      onSaved(t, isNew);
    } catch (ex) {
      if (ex instanceof ApiError && ex.fields) setErrors(ex.fields);
      toast(errorMessage(ex), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({ title: `${existing.atelierName} o‘chirilsinmi?`, text: 'Agar atelyega so‘rovlar kelgan bo‘lsa, u o‘chirilmaydi — faqat yashiriladi.', confirm: 'O‘chirish', danger: true });
    if (!ok) return;
    try {
      const r = await api.deleteTailor(existing.id);
      toast(r.hidden ? 'So‘rovlari bor — atelye yashirildi' : 'Atelye o‘chirildi');
      onDeleted(existing.id, r.hidden);
    } catch (ex) {
      toast(errorMessage(ex), 'error');
    }
  };

  return (
    <Overlay
      open={!!tailor}
      onClose={onClose}
      side
      title={isNew ? 'Yangi atelye' : existing?.atelierName ?? ''}
      footer={
        <>
          {existing && (
            <button type="button" className="btn btn-danger mr-auto" onClick={remove} disabled={busy}>
              O‘chirish
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <Field label="Atelye nomi *" error={errors.atelierName}>
          <input className="field" value={d.atelierName} onChange={(e) => upd('atelierName', e.target.value)} data-autofocus />
        </Field>
        <Field label="Usta ismi *" error={errors.name}>
          <input className="field" value={d.name} onChange={(e) => upd('name', e.target.value)} />
        </Field>
        <Field label="Shahar">
          <select className="field" value={d.city} onChange={(e) => upd('city', e.target.value)}>
            {[...new Set([d.city, ...CITIES])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tuman">
          <input className="field" value={d.district} onChange={(e) => upd('district', e.target.value)} />
        </Field>
        <Field label="Manzil" className="sm:col-span-2">
          <input className="field" value={d.address} onChange={(e) => upd('address', e.target.value)} placeholder="Ko‘cha, uy" />
        </Field>
        <Field label="Ixtisoslik" className="sm:col-span-2">
          <select className="field" value={d.specialtyKey} onChange={(e) => upd('specialtyKey', e.target.value as SpecialtyKey)}>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label.uz}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Telefon *" error={errors.phone}>
          <input className="field tabular" type="tel" value={d.phone} onChange={(e) => upd('phone', formatPhoneInput(e.target.value))} />
        </Field>
        <Field label="Telegram" error={errors.telegram}>
          <input className="field" value={d.telegram} onChange={(e) => upd('telegram', e.target.value)} placeholder="@username" />
        </Field>
        <Field label="Tikish narxi, so‘mdan">
          <input className="field tabular" type="number" min={0} step={10000} value={d.priceStartingUZS} onChange={(e) => upd('priceStartingUZS', Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        </Field>
        <Field label="Odatiy muddat, kun">
          <input className="field tabular" type="number" min={1} max={365} value={d.leadDays} onChange={(e) => upd('leadDays', Math.max(1, Math.round(Number(e.target.value) || 1)))} />
        </Field>
        <Field label="Tajriba, yil">
          <input className="field tabular" type="number" min={0} max={70} value={d.experienceYears} onChange={(e) => upd('experienceYears', Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        </Field>
        <Field label="Bajarilgan buyurtmalar">
          <input className="field tabular" type="number" min={0} value={d.completedOrders} onChange={(e) => upd('completedOrders', Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        </Field>
        <Field label="Reyting (1–5)" hint="Kamida 2 ta sharh bo‘lsa saytda ko‘rinadi">
          <input className="field tabular" type="number" min={1} max={5} step={0.1} value={d.rating ?? ''} onChange={(e) => upd('rating', e.target.value === '' ? null : Math.min(5, Math.max(1, Number(e.target.value))))} />
        </Field>
        <Field label="Sharhlar soni">
          <input className="field tabular" type="number" min={0} value={d.reviewsCount} onChange={(e) => upd('reviewsCount', Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        </Field>
        <Field label="Tavsif (o‘zbekcha) *" error={errors['description.uz']} className="sm:col-span-2">
          <textarea className="field" rows={2} value={d.description.uz} onChange={(e) => upd('description', { ...d.description, uz: e.target.value })} />
        </Field>
        <Field label="Tavsif (ruscha)" className="sm:col-span-2">
          <textarea className="field" rows={2} value={d.description.ru} onChange={(e) => upd('description', { ...d.description, ru: e.target.value })} />
        </Field>
        <Field label="Tavsif (inglizcha)" className="sm:col-span-2">
          <textarea className="field" rows={2} value={d.description.en} onChange={(e) => upd('description', { ...d.description, en: e.target.value })} />
        </Field>
        <Field label="Holat">
          <select className="field" value={d.status} onChange={(e) => upd('status', e.target.value as TailorStatus)}>
            {(['approved', 'pending', 'hidden', 'rejected'] as TailorStatus[]).map((s) => (
              <option key={s} value={s}>
                {TAILOR_STATUS_LABEL[s].uz}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tartib raqami" hint="Kichigi ro‘yxatda yuqorida">
          <input className="field tabular" type="number" value={d.sort} onChange={(e) => upd('sort', Math.round(Number(e.target.value) || 0))} />
        </Field>
      </div>
    </Overlay>
  );
}
