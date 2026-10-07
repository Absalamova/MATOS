import React, { useState } from 'react';
import { useAuth } from '../auth';
import { ApiError, API_URL, STORE_URL } from '../api';

export function Login() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return setError('Email va parolni kiriting');
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim().toLowerCase(), password, remember);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === 'invalid_credentials'
            ? 'Email yoki parol noto‘g‘ri'
            : err.code === 'rate_limited'
              ? 'Juda ko‘p urinish. 10 daqiqadan keyin qayta urinib ko‘ring.'
              : err.message
          : 'Kirib bo‘lmadi',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-mist px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-baseline gap-2">
          <span className="font-display text-[34px] lowercase leading-none">matos</span>
          <span className="text-graphite">sotuvchi paneli</span>
        </div>
        <form onSubmit={submit} className="card p-6 shadow-sm" noValidate>
          <h1 className="font-sans text-[18px] font-semibold">Kirish</h1>
          {notice && <p className="mt-2 rounded-lg bg-tape-soft px-3 py-2 text-[13px]">{notice}</p>}
          <label className="mt-5 block">
            <span className="label">Email</span>
            <input className="field" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <label className="mt-4 block">
            <span className="label">Parol</span>
            <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="mt-4 flex items-center gap-2 text-[13.5px] text-graphite">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Shu qurilmada eslab qolish
          </label>
          {error && (
            <p className="mt-4 text-[13.5px] text-danger" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-5 w-full" disabled={busy}>
            {busy ? 'Tekshirilmoqda…' : 'Kirish'}
          </button>
        </form>
        <div className="mt-5 flex justify-between text-[12.5px] text-muted">
          <a className="hover:text-ink" href={STORE_URL}>
            Saytga o‘tish
          </a>
          <span title="API manzili">{API_URL.replace(/^https?:\/\//, '')}</span>
        </div>
      </div>
    </div>
  );
}
