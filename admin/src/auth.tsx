import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AdminUser } from '../../shared/types';
import { api, ApiError, hasToken, onExpired, setToken } from './api';

interface AuthValue {
  admin: AdminUser | null;
  /** true while the saved session is being checked */
  checking: boolean;
  /** why the user was sent back to the login form */
  notice: string;
  /** a saved session exists but the API could not be reached */
  offline: boolean;
  retry: () => void;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(hasToken());
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(false);

  const check = useCallback(() => {
    if (!hasToken()) {
      setChecking(false);
      return;
    }
    setChecking(true);
    api
      .me()
      .then((a) => {
        setAdmin(a);
        setOffline(false);
      })
      .catch((e) => {
        // 401 is handled by onExpired; anything else means the server is unreachable right now.
        if (!(e instanceof ApiError && e.status === 401)) setOffline(true);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    onExpired(() => {
      setToken(null);
      setAdmin(null);
      setOffline(false);
      setNotice('Sessiya tugadi. Qaytadan kiring.');
    });
    check();
  }, [check]);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const r = await api.login(email, password);
    setToken(r.token, remember);
    setNotice('');
    setAdmin(r.admin);
  }, []);

  const signOut = useCallback(() => {
    api.logout().catch(() => undefined);
    setToken(null);
    setAdmin(null);
    setOffline(false);
    setNotice('');
  }, []);

  return <Ctx.Provider value={{ admin, checking, notice, offline, retry: check, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
};
