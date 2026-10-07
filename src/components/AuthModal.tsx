import React, { useState } from 'react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { KEYS, load } from '../lib/storage';
import { DEFAULT_MEASUREMENTS, sizeFor } from '../lib/measure';
import { Dialog } from './ui/Dialog';
import { User } from '../types';

const norm = (s: string) => {
  const d = s.replace(/\D/g, '');
  return s.includes('@') ? s.trim().toLowerCase() : d.length >= 9 ? d.slice(-9) : s.trim().toLowerCase();
};

export function AuthModal() {
  const { t, overlay, close, setUser, notify, measurements } = useApp();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const switchTab = (next: 'login' | 'register') => {
    setTab(next);
    setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const users = load<User[]>(KEYS.users, []);
    if (tab === 'login') {
      const u = users.find((x) => norm(x.identifier) === norm(id) && x.password === pw);
      if (!u) return setError(t(L('Telefon/email yoki parol noto‘g‘ri.', 'Неверный телефон/email или пароль.', 'Wrong phone/email or password.')));
      setUser(u);
      close();
      notify(t(L(`Xush kelibsiz, ${u.name.split(' ')[0]}`, `Добро пожаловать, ${u.name.split(' ')[0]}`, `Welcome back, ${u.name.split(' ')[0]}`)));
      return;
    }
    if (name.trim().length < 2) return setError(t(L('Ismingizni yozing.', 'Укажите имя.', 'Enter your name.')));
    if (!/@/.test(id) && id.replace(/\D/g, '').length < 9) return setError(t(L('Telefon raqami yoki email kiriting.', 'Укажите телефон или email.', 'Enter a phone number or email.')));
    if (pw.length < 6) return setError(t(L('Parol kamida 6 belgidan iborat bo‘lsin.', 'Пароль — минимум 6 символов.', 'Use at least 6 characters for the password.')));
    if (users.some((x) => norm(x.identifier) === norm(id))) return setError(t(L('Bu raqam yoki email bilan profil bor. Kirish bo‘limidan foydalaning.', 'Профиль с этим телефоном или email уже есть. Войдите.', 'An account with this phone or email exists. Sign in instead.')));
    const m = measurements ?? DEFAULT_MEASUREMENTS;
    const s = sizeFor(m);
    const u: User = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      identifier: id.trim(),
      password: pw,
      registeredAt: new Date().toISOString(),
      measurements: { heightCm: m.heightCm, chestCm: m.bustCm, waistCm: m.waistCm, hipsCm: m.hipsCm, sizeINT: s.INT, sizeEU: s.EU, sizeUS: s.US, sizeUK: s.UK },
    };
    setUser(u);
    close();
    notify(t(L('Profil yaratildi', 'Профиль создан', 'Account created')));
  };

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
              <span className="label">{t(L('Ism', 'Имя', 'Name'))}</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-autofocus />
            </label>
          )}
          <label className="block">
            <span className="label">{t(L('Telefon yoki email', 'Телефон или email', 'Phone or email'))}</span>
            <input className="field" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" inputMode="email" placeholder="+998 90 123 45 67" {...(tab === 'login' ? { 'data-autofocus': true } : {})} />
          </label>
          <label className="block">
            <span className="label">{t(L('Parol', 'Пароль', 'Password'))}</span>
            <input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {error && <p className="text-[13.5px] text-danger" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">
            {tab === 'login' ? t(UI.signIn) : t(L('Profil yaratish', 'Создать профиль', 'Create account'))}
          </button>
          {tab === 'login' && (
            <p className="text-[13px] text-muted">
              {t(L('Sinov uchun: +998 90 123 45 67, parol 123', 'Для проверки: +998 90 123 45 67, пароль 123', 'Demo login: +998 90 123 45 67, password 123'))}
            </p>
          )}
        </form>
      </div>
    </Dialog>
  );
}
