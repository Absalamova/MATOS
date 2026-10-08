import React from 'react';
import { useApp } from '../../state/app';
import { L, UI } from '../../lib/i18n';
import { href } from '../../lib/router';
import { ADMIN_URL } from '../../lib/api';
import { displayPhone, telHref } from '../../lib/format';

export function Footer() {
  const { t, open, settings } = useApp();
  const link = 'inline-block text-graphite transition-colors hover:text-ink pointer-coarse:py-1';
  return (
    <footer className="mt-24 border-t border-line bg-mist">
      <div className="wrap grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
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
            <li><a className={link} href={ADMIN_URL} rel="noopener">{t(L('Sotuvchi paneli', 'Панель продавца', 'Seller panel'))}</a></li>
          </ul>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <h3 className="mb-3 font-sans text-[13px] font-medium text-muted">{t(L('Aloqa', 'Контакты', 'Contact'))}</h3>
          <ul className="space-y-2 text-graphite">
            <li className="max-w-[30ch]">{settings.pickupAddress}</li>
            {settings.supportPhone && (
              <li><a className={`${link} tabular`} href={telHref(settings.supportPhone)}>{displayPhone(settings.supportPhone)}</a></li>
            )}
            <li><a className={`${link} break-all`} href="mailto:atelier@matosfabrics.com">atelier@matosfabrics.com</a></li>
          </ul>
        </div>
      </div>
      <div className="wrap flex flex-col gap-2 border-t border-line py-6 text-[13px] text-muted sm:flex-row sm:justify-between">
        <span>© 2026 MATOS</span>
        <span>{t(L('To‘lov mato qo‘lingizga yetgach — naqd yoki karta orqali.', 'Оплата при получении — наличными или картой.', 'Pay on delivery — cash or card.'))}</span>
      </div>
    </footer>
  );
}
