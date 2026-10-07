import React, { useState } from 'react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { formatPhone, isValidPhone, normalizePhone } from '../lib/format';
import { ApiError, errorText, login, register } from '../lib/api';
import { Dialog } from './ui/Dialog';

type Tab = 'login' | 'register';

export function AuthModal() {
  const { t, overlay, close, signIn, notify, measurements } = useApp();
  const [tab, setTab] = useState<Tab>('login');
  const [phone, setPhone] = useState('+998 ');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError('');
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const err: Record<string, string> = {};
    if (tab === 'register' && name.trim().length < 2) err.name = t(L('Ismingizni yozing', 'Укажите имя', 'Enter your name'));
    if (!isValidPhone(phone)) err.phone = t(L('Raqamni +998 XX XXX XX XX ko‘rinishida yozing', 'Формат: +998 XX XXX XX XX', 'Use +998 XX XXX XX XX'));
    if (tab === 'register' ? pw.length < 6 : !pw) err.password = tab === 'register' ? t(L('Kamida 6 ta belgi', 'Минимум 6 символов', 'At least 6 characters')) : t(L('Parolni yozing', 'Введите пароль', 'Enter your password'));
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const p = normalizePhone(phone)!;
      const res = tab === 'login' ? await login(p, pw) : await register({ name: name.trim(), phone: p, password: pw, measurements });
      signIn(res);
      setPw('');
      close();
      const first = res.user.name.split(' ')[0];
      notify(tab === 'login' ? t(L(`Xush kelibsiz, ${first}`, `Добро пожаловать, ${first}`, `Welcome back, ${first}`)) : t(L('Profil yaratildi', 'Профиль создан', 'Account created')));
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === 'validation' && ex.fields) {
        setErrors({ name: ex.fields.name ?? '', phone: ex.fields.phone ?? '', password: ex.fields.password ?? '' });
      }
      setError(errorText(ex, t));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (k: string) => (errors[k] ? <span className="mt-1 block text-[13px] text-danger">{errors[k]}</span> : null);

  return (
    <Dialog open={overlay === 'auth'} onClose={close} title={tab === 'login' ? t(UI.signIn) : t(L('Ro‘yxatdan o‘tish', 'Регистрация', 'Create account'))} size="sm" closeLabel={t(UI.close)}>
      <div className="px-5 py-6 sm:px-6">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-mist p-1" role="tablist">
          {(['login', 'register'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} className={`h-10 rounded-full text-[14px] transition-colors ${tab === k ? 'bg-paper shadow-sm' : 'text-graphite'}`}>
              {k === 'login' ? t(UI.signIn) : t(L('Yangi profil', 'Новый профиль', 'New account'))}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {tab === 'register' && (
            <label className="block">
              <span className="label">{t(L('Ism va familiya', 'Имя и фамилия', 'Full name'))}</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} data-autofocus />
              {fieldError('name')}
            </label>
          )}
          <label className="block">
            <span className="label">{t(L('Telefon raqami', 'Номер телефона', 'Phone number'))}</span>
            <input
              className="field tabular"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              {...(tab === 'login' ? { 'data-autofocus': true } : {})}
            />
            {fieldError('phone')}
          </label>
          <label className="block">
            <span className="label">{t(L('Parol', 'Пароль', 'Password'))}</span>
            <input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} aria-invalid={!!errors.password} />
            {fieldError('password')}
          </label>
          {error && (
            <p className="text-[13.5px] text-danger" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? t(L('Kuting…', 'Подождите…', 'Please wait…')) : tab === 'login' ? t(UI.signIn) : t(L('Profil yaratish', 'Создать профиль', 'Create account'))}
          </button>
          <p className="text-[13px] text-muted">
            {tab === 'login'
              ? t(L('Profilda buyurtmalaringiz va o‘lchamlaringiz saqlanadi.', 'В профиле хранятся ваши заказы и мерки.', 'Your orders and measurements are kept in your account.'))
              : t(L('Ro‘yxatdan o‘tish orqali buyurtmalaringizni kuzatib borasiz. Raqamingiz faqat buyurtma bo‘yicha aloqa uchun ishlatiladi.', 'Зарегистрировавшись, вы сможете следить за заказами. Номер используется только для связи по заказу.', 'With an account you can track your orders. We only use your number to contact you about orders.'))}
          </p>
        </form>
      </div>
    </Dialog>
  );
}
