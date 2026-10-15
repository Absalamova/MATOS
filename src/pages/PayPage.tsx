import React, { useEffect, useState } from 'react';
import { useApp } from '../state/app';
import { L } from '../lib/i18n';
import { href, type Route } from '../lib/router';
import { rememberPayToken, savedPayToken } from '../lib/pay';
import { PaymentPanel } from '../components/PaymentPanel';

/**
 * #/pay/MT-1043?t=… — the QR target. The token is saved in this browser and dropped from the address bar,
 * so it doesn't stay in screenshots or get pasted along with the page by accident.
 */
export function PayPage({ route }: { route: Route }) {
  const { t, user, open } = useApp();
  const number = decodeURIComponent(route.id ?? '');
  const [token] = useState(() => route.query.get('t') || savedPayToken(number));

  useEffect(() => {
    if (!route.query.get('t')) return;
    rememberPayToken(number, route.query.get('t')!);
    history.replaceState(null, '', href('pay', { id: number }));
  }, [number, route.query]);

  const valid = /^MT-\d{1,9}$/.test(number);
  return (
    <div className="mx-auto w-full max-w-[460px] px-4 py-8 sm:py-12">
      <h1 className="font-display text-[28px] leading-tight">{t(L('Buyurtmani to‘lash', 'Оплата заказа', 'Pay for your order'))}</h1>
      <div className="mt-6">
        {!valid ? (
          <p className="text-graphite">{t(L('Havola noto‘g‘ri.', 'Неверная ссылка.', 'This link is not valid.'))}</p>
        ) : token || user ? (
          <PaymentPanel key={`${number}:${token}:${user?.id ?? ''}`} number={number} token={token} />
        ) : (
          <div className="rounded-lg bg-mist p-4 text-[14.5px]">
            <p>{t(L('Bu to‘lov sahifasini ochish uchun buyurtma bergan profilingizga kiring yoki buyurtmadan keyingi QR/havoladan foydalaning.', 'Чтобы открыть оплату, войдите в профиль, с которого оформили заказ, или используйте QR/ссылку после заказа.', 'Sign in to the account you ordered with, or use the QR/link you got after ordering.'))}</p>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => open('auth')}>
              {t(L('Kirish', 'Войти', 'Sign in'))}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
