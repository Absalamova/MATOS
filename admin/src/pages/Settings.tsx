import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type { AdminUser, StoreSettings } from '../../../shared/types';
import { displayPhone, formatPhoneInput, normalizePhone } from '../../../shared/phone';
import { api, ApiError, API_URL, errorMessage, STORE_URL } from '../api';
import { useAuth } from '../auth';
import { money, when } from '../lib';
import { ErrorBox, Field, Overlay, PageHeader, Skeleton, useUi } from '../ui';

export function Settings() {
  const { admin } = useAuth();
  return (
    <>
      <PageHeader title="Sozlamalar" />
      <div className="grid gap-5 xl:grid-cols-2">
        <StoreSettingsCard />
        <div className="space-y-5">
          <PasswordCard />
          {admin?.role === 'owner' && <StaffCard />}
          <section className="card p-5 text-[13px] text-graphite">
            <h2 className="mb-2 font-sans text-[15px] font-semibold text-ink">Ulanish</h2>
            <p>
              API: <span className="text-ink">{API_URL}</span>
            </p>
            <p>
              Sayt: <span className="text-ink">{STORE_URL}</span>
            </p>
            <p className="mt-2">Yangi buyurtmalar haqida Telegram xabari kerak bo‘lsa, serverdagi .env faylida TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID ni kiriting.</p>
          </section>
        </div>
      </div>
    </>
  );
}

function StoreSettingsCard() {
  const { toast } = useUi();
  const [s, setS] = useState<StoreSettings | null>(null);
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((x) => {
        setS(x);
        setPhone(x.supportPhone ? displayPhone(x.supportPhone) : '');
        setSaved(JSON.stringify(x));
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!s) return <div className="card"><Skeleton rows={6} /></div>;

  const next: StoreSettings = { ...s, supportPhone: phone.trim() && phone.trim() !== '+998' ? (normalizePhone(phone) ?? phone.trim()) : '' };
  const dirty = JSON.stringify(next) !== saved;
  const n = (k: keyof StoreSettings, v: string) => setS({ ...s, [k]: Math.max(0, Math.round(Number(v) || 0)) });

  const save = async () => {
    if (next.supportPhone && !normalizePhone(next.supportPhone)) return setErrors({ supportPhone: '+998 XX XXX XX XX' });
    setBusy(true);
    setErrors({});
    try {
      const r = await api.saveSettings(next);
      setS(r);
      setSaved(JSON.stringify(r));
      toast('Sozlamalar saqlandi — saytda yangilandi');
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-sans text-[15px] font-semibold">Do‘kon</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="1 USD, so‘m" error={errors['rates.USD']} hint="Dollar narxlari shu kurs bo‘yicha">
          <input className="field tabular" type="number" min={1000} value={s.rates.USD} onChange={(e) => setS({ ...s, rates: { ...s.rates, USD: Number(e.target.value) || 0 } })} />
        </Field>
        <Field label="1 EUR, so‘m" error={errors['rates.EUR']}>
          <input className="field tabular" type="number" min={1000} value={s.rates.EUR} onChange={(e) => setS({ ...s, rates: { ...s.rates, EUR: Number(e.target.value) || 0 } })} />
        </Field>
        <Field label="Yetkazish narxi, so‘m" error={errors.deliveryFeeUZS} hint={money(s.deliveryFeeUZS)}>
          <input className="field tabular" type="number" min={0} step={1000} value={s.deliveryFeeUZS} onChange={(e) => n('deliveryFeeUZS', e.target.value)} />
        </Field>
        <Field label="Bepul yetkazish, so‘mdan" error={errors.freeDeliveryFromUZS} hint={s.freeDeliveryFromUZS ? money(s.freeDeliveryFromUZS) : 'har doim pullik'}>
          <input className="field tabular" type="number" min={0} step={50000} value={s.freeDeliveryFromUZS} onChange={(e) => n('freeDeliveryFromUZS', e.target.value)} />
        </Field>
        <Field label="Bir buyurtmada bepul namuna" error={errors.maxSamples}>
          <input className="field tabular" type="number" min={1} max={10} value={s.maxSamples} onChange={(e) => setS({ ...s, maxSamples: Math.min(10, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
        </Field>
        <Field label="Aloqa telefoni (saytda)" error={errors.supportPhone}>
          <input className="field tabular" type="tel" value={phone} placeholder="+998 71 200 00 00" onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />
        </Field>
      </div>
      <Field label="Olib ketish manzili" error={errors.pickupAddress} hint="Savatda va sayt pastida ko‘rinadi">
        <textarea className="field" rows={2} value={s.pickupAddress} onChange={(e) => setS({ ...s, pickupAddress: e.target.value })} maxLength={300} />
      </Field>
      <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !dirty}>
        {busy ? 'Saqlanmoqda…' : 'Saqlash'}
      </button>
    </section>
  );
}

function PasswordCard() {
  const { toast } = useUi();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('Yangi parol kamida 8 belgi');
    if (next !== again) return setError('Parollar mos emas');
    setBusy(true);
    setError('');
    try {
      await api.changePassword(cur, next);
      setCur('');
      setNext('');
      setAgain('');
      toast('Parol o‘zgartirildi');
    } catch (ex) {
      setError(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card space-y-4 p-5" onSubmit={submit}>
      <h2 className="font-sans text-[15px] font-semibold">Parolni o‘zgartirish</h2>
      <input type="text" autoComplete="username" className="hidden" readOnly aria-hidden="true" tabIndex={-1} />
      <Field label="Joriy parol">
        <input className="field" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Yangi parol">
          <input className="field" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Yana bir bor">
          <input className="field" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
      </div>
      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-secondary" disabled={busy || !cur || !next}>
        O‘zgartirish
      </button>
    </form>
  );
}

function StaffCard() {
  const { admin } = useAuth();
  const { toast, confirm } = useUi();
  const [staff, setStaff] = useState<AdminUser[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'manager' as 'owner' | 'manager' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.staff().then(setStaff).catch(() => setStaff([]));
  }, []);

  const add = async () => {
    if (f.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()) || f.password.length < 8) return setError('Ism, to‘g‘ri email va kamida 8 belgili parol kiriting');
    try {
      const a = await api.addStaff({ ...f, email: f.email.trim().toLowerCase(), name: f.name.trim() });
      setStaff((s) => [...(s ?? []), a]);
      setAdding(false);
      setF({ name: '', email: '', password: '', role: 'manager' });
      toast('Xodim qo‘shildi');
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = async (u: AdminUser) => {
    if (!(await confirm({ title: `${u.name} o‘chirilsinmi?`, text: 'Xodim panelga kira olmaydi.', confirm: 'O‘chirish', danger: true }))) return;
    try {
      await api.removeStaff(u.id);
      setStaff((s) => s?.filter((x) => x.id !== u.id) ?? s);
      toast('Xodim o‘chirildi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-sans text-[15px] font-semibold">Xodimlar</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" /> Qo‘shish
        </button>
      </div>
      {!staff ? (
        <Skeleton rows={2} />
      ) : (
        <ul className="divide-y divide-line">
          {staff.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {u.name} <span className="font-normal text-muted">· {u.role === 'owner' ? 'ega' : 'menejer'}</span>
                </div>
                <div className="truncate text-[12.5px] text-graphite">
                  {u.email} · {u.lastLoginAt ? `oxirgi kirish ${when(u.lastLoginAt)}` : 'hali kirmagan'}
                </div>
              </div>
              {u.id !== admin?.id && (
                <button type="button" className="icon-btn text-danger" onClick={() => remove(u)} aria-label={`${u.name}: o‘chirish`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Overlay
        open={adding}
        onClose={() => setAdding(false)}
        title="Yangi xodim"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>
              Bekor qilish
            </button>
            <button type="button" className="btn btn-primary" onClick={add}>
              Qo‘shish
            </button>
          </>
        }
      >
        <div className="space-y-4 px-5 py-5">
          <Field label="Ism">
            <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-autofocus />
          </Field>
          <Field label="Email">
            <input className="field" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Vaqtinchalik parol" hint="Kamida 8 belgi. Xodim keyin o‘zi o‘zgartiradi.">
            <input className="field" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Huquq">
            <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'owner' | 'manager' })}>
              <option value="manager">Menejer — buyurtmalar, katalog, mijozlar</option>
              <option value="owner">Ega — hammasi, xodimlarni boshqarish ham</option>
            </select>
          </Field>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      </Overlay>
    </section>
  );
}
