import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type { AdminUser, PaymentReceiver, StoreSettings } from '../../../shared/types';
import { cardDigits, formatCard, isAllowedPayLink, isCardNumber, MAX_HOLD_HOURS, MIN_HOLD_HOURS } from '../../../shared/payment';
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
        <div className="space-y-5">
          <StoreSettingsCard />
          <PaymentCard />
        </div>
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

/**
 * Where QR payments go. Everyone sees it; only the owner can change it, and only with their password,
 * because whoever controls this card number controls where customers send money.
 */
function PaymentCard() {
  const { admin } = useAuth();
  const { toast } = useUi();
  const owner = admin?.role === 'owner';
  const [r, setR] = useState<(PaymentReceiver & { ready: boolean }) | null>(null);
  const [f, setF] = useState<PaymentReceiver | null>(null);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .paymentReceiver()
      .then((x) => {
        setR(x);
        setF({ enabled: x.enabled, cardNumber: x.cardNumber, cardHolder: x.cardHolder, bankName: x.bankName, payLink: x.payLink, holdHours: x.holdHours });
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!r || !f) return <div className="card"><Skeleton rows={5} /></div>;

  const dirty = owner && JSON.stringify(f) !== JSON.stringify({ enabled: r.enabled, cardNumber: r.cardNumber, cardHolder: r.cardHolder, bankName: r.bankName, payLink: r.payLink, holdHours: r.holdHours });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (f.cardNumber && !isCardNumber(f.cardNumber)) local.cardNumber = 'Raqam noto‘g‘ri — 16 ta raqamni qayta tekshiring';
    if (f.enabled && !f.cardNumber) local.cardNumber = 'Karta raqamini kiriting';
    if (f.enabled && f.cardHolder.trim().length < 3) local.cardHolder = 'Kartadagi ism-familiya';
    if (f.payLink && !isAllowedPayLink(f.payLink)) local.payLink = 'Faqat https://…payme.uz, click.uz yoki uzumbank.uz';
    if (!password) local.password = 'Saqlash uchun parolingizni kiriting';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const x = await api.savePaymentReceiver({ ...f, cardNumber: cardDigits(f.cardNumber), password });
      setR(x);
      setF({ enabled: x.enabled, cardNumber: x.cardNumber, cardHolder: x.cardHolder, bankName: x.bankName, payLink: x.payLink, holdHours: x.holdHours });
      setPassword('');
      toast(x.enabled ? 'Saqlandi — saytda QR orqali to‘lov yoqildi' : 'Saqlandi — QR orqali to‘lov o‘chiq');
    } catch (ex) {
      if (ex instanceof ApiError && ex.fields) setErrors(ex.fields);
      else if (ex instanceof ApiError && ex.code === 'wrong_password') setErrors({ password: 'Parol noto‘g‘ri' });
      toast(errorMessage(ex), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card space-y-4 p-5" onSubmit={save}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-[15px] font-semibold">QR orqali to‘lov</h2>
          <p className="mt-1 text-[13px] text-graphite">Mijoz buyurtmadan keyin QR / karta raqamini ko‘rib, o‘z ilovasidan pul o‘tkazadi. Buyurtma siz pul tushganini ko‘rib tasdiqlaganingizdan keyingina “to‘langan” bo‘ladi.</p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-medium ${r.ready ? 'bg-ok-soft text-ok' : 'bg-well text-graphite'}`}>{r.ready ? 'Saytda yoqilgan' : 'O‘chiq'}</span>
      </div>
      {!owner && <p className="rounded-lg bg-mist p-3 text-[13px] text-graphite">Kartani faqat do‘kon egasi o‘zgartira oladi.</p>}
      <fieldset disabled={!owner || busy} className="space-y-4">
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          Saytda QR orqali to‘lovni taklif qilish
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Karta raqami" error={errors.cardNumber} hint="Uzcard, Humo, Visa yoki Mastercard — 16 raqam">
            <input
              className="field tabular tracking-[0.04em]"
              inputMode="numeric"
              autoComplete="off"
              value={owner ? formatCard(f.cardNumber) : f.cardNumber}
              onChange={(e) => setF({ ...f, cardNumber: cardDigits(e.target.value).slice(0, 16) })}
              placeholder="8600 0000 0000 0000"
            />
          </Field>
          <Field label="Karta egasi (kartadagidek)" error={errors.cardHolder} hint="Mijoz o‘tkazishda shu ismni ko‘radi">
            <input className="field" value={f.cardHolder} onChange={(e) => setF({ ...f, cardHolder: e.target.value })} maxLength={80} placeholder="ALIYEVA MALIKA" />
          </Field>
          <Field label="Bank (ixtiyoriy)" error={errors.bankName}>
            <input className="field" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} maxLength={60} placeholder="Kapitalbank" />
          </Field>
          <Field label="To‘lov muddati, soat" error={errors.holdHours} hint="Shu vaqtda to‘lanmasa, buyurtma bekor bo‘lib, mato sotuvga qaytadi">
            <input className="field tabular" type="number" min={MIN_HOLD_HOURS} max={MAX_HOLD_HOURS} value={f.holdHours} onChange={(e) => setF({ ...f, holdHours: Math.min(MAX_HOLD_HOURS, Math.max(MIN_HOLD_HOURS, Math.round(Number(e.target.value) || MIN_HOLD_HOURS))) })} />
          </Field>
        </div>
        <Field label="Payme / Click / Uzum havolasi (ixtiyoriy)" error={errors.payLink} hint="Bo‘lsa, mijozga “ilovada ochish” tugmasi chiqadi. Faqat payme.uz, click.uz, uzumbank.uz">
          <input className="field" type="url" value={f.payLink} onChange={(e) => setF({ ...f, payLink: e.target.value.trim() })} maxLength={300} placeholder="https://payme.uz/…" />
        </Field>
        {owner && (
          <Field label="Parolingiz (tasdiqlash uchun)" error={errors.password} hint="Karta o‘zgarsa, Telegram guruhiga ogohlantirish boradi">
            <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
      </fieldset>
      {owner && (
        <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
          {busy ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
      )}
    </form>
  );
}
