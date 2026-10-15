import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { formatPhone, isValidPhone, normalizePhone } from '../lib/format';
import { displayPhone } from '../../shared/phone';
import { ApiError, errorText, login, register, startPhoneVerification, verifyPhoneCode } from '../lib/api';
import { Dialog } from './ui/Dialog';

type Tab = 'login' | 'register';
/** Sign-up: name + phone → SMS code → password. */
type Step = 'phone' | 'code' | 'password';

const STEPS: Step[] = ['phone', 'code', 'password'];

export function AuthModal() {
  const { t, overlay, close, signIn, notify, measurements } = useApp();
  const [tab, setTab] = useState<Tab>('login');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+998 ');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  /** Number the code was sent to and the token it earned; both reset when the number changes. */
  const [sentTo, setSentTo] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | undefined>();
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (!resendAt || resendAt <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [resendAt]);

  useEffect(() => {
    if (tab !== 'register') return;
    if (step === 'code') codeRef.current?.focus();
    if (step === 'password') pwRef.current?.focus();
  }, [tab, step]);

  const resetMessages = () => {
    setError('');
    setErrors({});
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    resetMessages();
  };

  const goTo = (next: Step) => {
    setStep(next);
    resetMessages();
  };

  const afterSignIn = (res: Awaited<ReturnType<typeof login>>, isNew: boolean) => {
    signIn(res);
    setPw('');
    setCode('');
    setVerificationToken(undefined);
    setSentTo('');
    setStep('phone');
    close();
    const first = res.user.name.split(' ')[0];
    notify(isNew ? t(L('Profil yaratildi', 'Профиль создан', 'Account created')) : t(L(`Xush kelibsiz, ${first}`, `Добро пожаловать, ${first}`, `Welcome back, ${first}`)));
  };

  const showError = (ex: unknown) => {
    if (ex instanceof ApiError && ex.code === 'validation' && ex.fields) {
      setErrors({ name: ex.fields.name ?? '', phone: ex.fields.phone ?? '', password: ex.fields.password ?? '', code: ex.fields.code ?? '' });
    }
    setError(errorText(ex, t));
  };

  const phoneError = () => t(L('Raqamni +998 XX XXX XX XX ko‘rinishida yozing', 'Формат: +998 XX XXX XX XX', 'Use +998 XX XXX XX XX'));

  /* ───────────── Sign in ───────────── */

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const err: Record<string, string> = {};
    if (!isValidPhone(phone)) err.phone = phoneError();
    if (!pw) err.password = t(L('Parolni yozing', 'Введите пароль', 'Enter your password'));
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      afterSignIn(await login(normalizePhone(phone)!, pw), false);
    } catch (ex) {
      showError(ex);
    } finally {
      setBusy(false);
    }
  };

  /* ───────────── Sign up ───────────── */

  const sendCode = async () => {
    const p = normalizePhone(phone)!;
    setBusy(true);
    setError('');
    try {
      const r = await startPhoneVerification(p);
      setSentTo(p);
      setVerificationToken(undefined);
      setCode('');
      setDevCode(r.devCode ?? '');
      setResendAt(Date.now() + r.resendInSec * 1000);
      setNow(Date.now());
      goTo('code');
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 404) {
        // The API in front of this site predates SMS checks; it will refuse nothing, so keep sign-up working.
        setSentTo(p);
        goTo('password');
      } else if (ex instanceof ApiError && ex.code === 'sms_cooldown' && sentTo === p) {
        // A code for this number is already on its way.
        setResendAt(Date.now() + Number(ex.details?.retryInSec ?? 60) * 1000);
        setNow(Date.now());
        goTo('code');
      } else {
        showError(ex);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const err: Record<string, string> = {};
    if (name.trim().length < 2) err.name = t(L('Ismingizni yozing', 'Укажите имя', 'Enter your name'));
    if (!isValidPhone(phone)) err.phone = phoneError();
    setErrors(err);
    if (Object.keys(err).length) return;
    // Same number already confirmed in this sitting (user went back to fix the name).
    if (verificationToken && sentTo === normalizePhone(phone)) return goTo('password');
    await sendCode();
  };

  const checkCode = async (value: string) => {
    if (busy || value.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const r = await verifyPhoneCode(sentTo, value);
      setVerificationToken(r.verificationToken);
      goTo('password');
    } catch (ex) {
      showError(ex);
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError('');
    // Pasted or auto-filled from the SMS: submit at once.
    if (digits.length === 6) void checkCode(digits);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pw.length < 6) {
      setErrors({ password: t(L('Kamida 6 ta belgi', 'Минимум 6 символов', 'At least 6 characters')) });
      return;
    }
    setErrors({});
    setError('');
    setBusy(true);
    try {
      afterSignIn(await register({ name: name.trim(), phone: sentTo, password: pw, verificationToken, measurements }), true);
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === 'verification_invalid') {
        setVerificationToken(undefined);
        setStep('phone');
      }
      showError(ex);
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (k: string) => (errors[k] ? <span className="mt-1 block text-[13px] text-danger">{errors[k]}</span> : null);
  const alert = error ? (
    <p className="text-[13.5px] text-danger" role="alert">
      {error}
    </p>
  ) : null;
  const wait = t(L('Kuting…', 'Подождите…', 'Please wait…'));

  const stepNo = STEPS.indexOf(step) + 1;
  const stepLabel = {
    phone: t(L('Ism va raqam', 'Имя и номер', 'Name and number')),
    code: t(L('SMS kod', 'Код из SMS', 'SMS code')),
    password: t(L('Parol', 'Пароль', 'Password')),
  }[step];

  return (
    <Dialog open={overlay === 'auth'} onClose={close} title={tab === 'login' ? t(UI.signIn) : t(L('Ro‘yxatdan o‘tish', 'Регистрация', 'Create account'))} size="sm" closeLabel={t(UI.close)}>
      <div className="px-5 py-6 sm:px-6">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-mist p-1" role="tablist">
          {(['login', 'register'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} className={`h-11 rounded-full text-[14px] transition-colors ${tab === k ? 'bg-paper shadow-sm' : 'text-graphite'}`}>
              {k === 'login' ? t(UI.signIn) : t(L('Yangi profil', 'Новый профиль', 'New account'))}
            </button>
          ))}
        </div>

        {tab === 'login' ? (
          <form onSubmit={submitLogin} className="space-y-4" noValidate>
            <label className="block">
              <span className="label">{t(L('Telefon raqami', 'Номер телефона', 'Phone number'))}</span>
              <input className="field tabular" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} autoComplete="tel" aria-invalid={!!errors.phone} data-autofocus />
              {fieldError('phone')}
            </label>
            <label className="block">
              <span className="label">{t(L('Parol', 'Пароль', 'Password'))}</span>
              <input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" aria-invalid={!!errors.password} />
              {fieldError('password')}
            </label>
            {alert}
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? wait : t(UI.signIn)}
            </button>
            <p className="text-[13px] text-muted">{t(L('Profilda buyurtmalaringiz va o‘lchamlaringiz saqlanadi.', 'В профиле хранятся ваши заказы и мерки.', 'Your orders and measurements are kept in your account.'))}</p>
          </form>
        ) : (
          <div>
            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-ink">{stepLabel}</span>
                <span className="tabular text-muted">{t(L(`${stepNo}-qadam / 3`, `Шаг ${stepNo} из 3`, `Step ${stepNo} of 3`))}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5" aria-hidden>
                {STEPS.map((s, i) => (
                  <span key={s} className={`h-1 rounded-full transition-colors ${i < stepNo ? 'bg-ink' : 'bg-mist'}`} />
                ))}
              </div>
            </div>

            {step === 'phone' && (
              <form onSubmit={submitPhone} className="space-y-4" noValidate>
                <label className="block">
                  <span className="label">{t(L('Ism va familiya', 'Имя и фамилия', 'Full name'))}</span>
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} data-autofocus />
                  {fieldError('name')}
                </label>
                <label className="block">
                  <span className="label">{t(L('Telefon raqami', 'Номер телефона', 'Phone number'))}</span>
                  <input className="field tabular" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} autoComplete="tel" aria-invalid={!!errors.phone} />
                  {fieldError('phone')}
                </label>
                {alert}
                <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                  {busy ? wait : t(L('SMS kod olish', 'Получить код по SMS', 'Get SMS code'))}
                </button>
                <p className="text-[13px] text-muted">
                  {t(L('Raqamingiz sizniki ekanini tasdiqlash uchun unga 6 xonali kod yuboramiz. Raqam faqat buyurtma bo‘yicha aloqa uchun ishlatiladi.', 'Чтобы подтвердить, что номер ваш, мы отправим на него 6-значный код. Номер используется только для связи по заказу.', 'We’ll text a 6-digit code to confirm the number is yours. We only use it to contact you about orders.'))}
                </p>
              </form>
            )}

            {step === 'code' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkCode(code);
                }}
                className="space-y-4"
                noValidate
              >
                <p className="text-[14px] text-graphite">
                  {t(L('Kod yuborildi:', 'Код отправлен на', 'Code sent to'))} <span className="tabular font-medium text-ink">{displayPhone(sentTo)}</span>{' '}
                  <button type="button" className="ml-1 text-[13.5px] underline underline-offset-2" onClick={() => goTo('phone')}>
                    {t(L('O‘zgartirish', 'Изменить', 'Change'))}
                  </button>
                </p>
                <label className="block">
                  <span className="label">{t(L('SMS’dagi 6 xonali kod', '6-значный код из SMS', '6-digit code from the SMS'))}</span>
                  <input
                    ref={codeRef}
                    className="field tabular text-center text-[22px] tracking-[0.5em]"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="••••••"
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    aria-invalid={!!error || !!errors.code}
                    disabled={busy}
                  />
                  {fieldError('code')}
                </label>
                {devCode && (
                  <p className="rounded-lg bg-mist px-3 py-2 text-[13px] text-graphite">
                    {t(L('Sinov rejimi: SMS yuborilmadi, kod', 'Тестовый режим: SMS не отправлено, код', 'Test mode: no SMS sent, code'))} <span className="tabular font-medium">{devCode}</span>
                  </p>
                )}
                {alert}
                <button type="submit" className="btn btn-primary w-full" disabled={busy || code.length !== 6}>
                  {busy ? wait : t(L('Tasdiqlash', 'Подтвердить', 'Confirm'))}
                </button>
                <button type="button" className="btn btn-ghost w-full" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
                  {resendIn > 0
                    ? t(L(`Kodni qayta yuborish (${resendIn} s)`, `Отправить снова (${resendIn} с)`, `Resend code (${resendIn}s)`))
                    : t(L('Kodni qayta yuborish', 'Отправить код снова', 'Resend code'))}
                </button>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={submitPassword} className="space-y-4" noValidate>
                {verificationToken && (
                  <p className="text-[14px] text-graphite">
                    {t(L('Raqam tasdiqlandi:', 'Номер подтверждён:', 'Number confirmed:'))} <span className="tabular font-medium text-ink">{displayPhone(sentTo)}</span>
                  </p>
                )}
                <label className="block">
                  <span className="label">{t(L('Parol o‘ylab toping', 'Придумайте пароль', 'Create a password'))}</span>
                  <input ref={pwRef} className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-invalid={!!errors.password} />
                  {fieldError('password') ?? <span className="mt-1 block text-[13px] text-muted">{t(L('Kamida 6 ta belgi', 'Минимум 6 символов', 'At least 6 characters'))}</span>}
                </label>
                {alert}
                <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                  {busy ? wait : t(L('Profil yaratish', 'Создать профиль', 'Create account'))}
                </button>
                <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => goTo('phone')}>
                  {t(L('Orqaga', 'Назад', 'Back'))}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
