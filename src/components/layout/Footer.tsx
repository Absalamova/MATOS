import React from 'react';
import { useApp } from '../../state/app';
import { L, UI } from '../../lib/i18n';
import { href } from '../../lib/router';

export function Footer() {
  const { t, open } = useApp();
  const link = 'text-graphite hover:text-ink transition-colors';
  return (
    <footer className="mt-24 border-t border-line bg-mist">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="font-display text-[30px] lowercase leading-none">matos</div>
          <p className="mt-3 max-w-[30ch] text-graphite">
            {t(L('Mato, namuna, 3D va tikuvchi — bir joyda.', 'Ткань, образец, 3D и портной — в одном месте.', 'Fabric, samples, 3D and tailors in one place.'))}
          </p>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-[13px] font-medium text-muted">{t(L('Xaridorlarga', 'Покупателям', 'For buyers'))}</h3>
          <ul className="space-y-2">
            <li><a className={link} href={href('catalog')}>{t(UI.catalog)}</a></li>
            <li><button type="button" className={link} onClick={() => open('search')}>{t(UI.photoSearch)}</button></li>
            <li><a className={link} href={href('studio')}>{t(UI.studio)}</a></li>
            <li><a className={link} href="#/?section=samples">{t(UI.freeSamples)}</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-[13px] font-medium text-muted">{t(L('Hamkorlarga', 'Партнёрам', 'For partners'))}</h3>
          <ul className="space-y-2">
            <li><a className={link} href={href('tailors')}>{t(UI.tailors)}</a></li>
            <li><a className={link} href={href('tailors', { query: { register: '1' } })}>{t(L('Atelyeni qo‘shish', 'Добавить ателье', 'List your atelier'))}</a></li>
            <li><a className={link} href="#/admin">{t(L('Sotuvchi paneli', 'Панель продавца', 'Seller panel'))}</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-[13px] font-medium text-muted">{t(L('Aloqa', 'Контакты', 'Contact'))}</h3>
          <ul className="space-y-2 text-graphite">
            <li>{t(L('Toshkent, Chilonzor', 'Ташкент, Чиланзар', 'Tashkent, Chilanzar'))}</li>
            <li><a className={link} href="tel:+998712008844">+998 71 200 88 44</a></li>
            <li><a className={link} href="mailto:atelier@matosfabrics.com">atelier@matosfabrics.com</a></li>
          </ul>
        </div>
      </div>
      <div className="wrap flex flex-col gap-2 border-t border-line py-6 text-[13px] text-muted sm:flex-row sm:justify-between">
        <span>© 2026 MATOS</span>
        <span>{t(L('Demo versiya: buyurtmalar shu brauzerda saqlanadi.', 'Демо-версия: заказы сохраняются в этом браузере.', 'Demo: orders are stored in this browser.'))}</span>
      </div>
    </footer>
  );
}
