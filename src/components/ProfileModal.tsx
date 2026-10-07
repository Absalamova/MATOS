import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { displayPhone, formatDate, formatLength, formatMoney } from '../lib/format';
import { clampMeasurements, MEASURE_LIMITS, sizeFor } from '../lib/measure';
import { errorText, fetchHistory } from '../lib/api';
import { findGarment } from '../data/garments';
import { ORDER_STATUS_CUSTOMER, TAILOR_REQUEST_LABEL } from '../../shared/status';
import { Dialog } from './ui/Dialog';
import type { BodyMeasurements, MyHistory } from '../types';
import { href } from '../lib/router';

export function ProfileModal() {
  const { t, lang, unit, overlay, close, user, signOut, measurements, setMeasurements, notify } = useApp();
  const [tab, setTab] = useState<'orders' | 'body'>('orders');
  const [draft, setDraft] = useState<BodyMeasurements>(measurements);
  const [history, setHistory] = useState<MyHistory | null>(null);
  const [error, setError] = useState('');
  const isOpen = overlay === 'profile' && !!user;

  const load = useCallback(() => {
    setError('');
    fetchHistory()
      .then(setHistory)
      .catch((e) => setError(errorText(e, t)));
  }, [t]);

  useEffect(() => {
    if (isOpen && tab === 'orders') load();
  }, [isOpen, tab, load]);

  if (!user) return null;
  const size = sizeFor(draft);
  const fields: [keyof BodyMeasurements, ReturnType<typeof L>][] = [
    ['heightCm', L('Bo‘y', 'Рост', 'Height')],
    ['bustCm', L('Ko‘krak', 'Грудь', 'Bust')],
    ['waistCm', L('Bel', 'Талия', 'Waist')],
    ['hipsCm', L('Son', 'Бёдра', 'Hips')],
  ];
  const empty = history && history.orders.length === 0 && history.tailorRequests.length === 0;

  return (
    <Dialog open={isOpen} onClose={close} title={user.name} size="md" closeLabel={t(UI.close)}>
      <div className="px-5 py-6 sm:px-6">
        <p className="tabular -mt-2 text-[13.5px] text-graphite">{displayPhone(user.phone)}</p>
        <div className="mt-5 flex gap-2" role="tablist">
          <button type="button" role="tab" className="chip" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>
            {t(L('Buyurtmalar', 'Заказы', 'Orders'))}
          </button>
          <button
            type="button"
            role="tab"
            className="chip"
            aria-selected={tab === 'body'}
            onClick={() => {
              setDraft(measurements);
              setTab('body');
            }}
          >
            {t(L('O‘lchamlar', 'Мерки', 'Measurements'))}
          </button>
        </div>

        {tab === 'orders' ? (
          <div className="mt-6" aria-live="polite">
            {error ? (
              <div className="rounded-xl border border-line p-6 text-center">
                <p className="text-graphite">{error}</p>
                <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={load}>
                  {t(L('Qayta urinish', 'Повторить', 'Try again'))}
                </button>
              </div>
            ) : !history ? (
              <div className="space-y-3" aria-label={t(L('Yuklanmoqda', 'Загрузка', 'Loading'))}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-mist" />
                ))}
              </div>
            ) : empty ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center">
                <p className="text-graphite">{t(L('Hali buyurtma yo‘q. Boshlash uchun 5 tagacha bepul namuna oling.', 'Заказов пока нет. Начните с бесплатных образцов — до 5 штук.', 'No orders yet. Start with up to 5 free samples.'))}</p>
                <a className="btn btn-primary mt-5" href={href('catalog')} onClick={close}>
                  {t(L('Katalogga o‘tish', 'Перейти в каталог', 'Go to catalog'))}
                </a>
              </div>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {history.orders.map((o) => (
                  <li key={o.number} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {o.number} · {o.kind === 'sample' ? t(UI.freeSamples) : t(L('Mato', 'Ткань', 'Fabric'))}
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] ${o.status === 'cancelled' ? 'bg-well text-graphite' : o.kind === 'sample' ? 'bg-tape-soft' : 'bg-mist'}`}>
                        {t(ORDER_STATUS_CUSTOMER[o.status])}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-[13.5px] text-graphite">
                      {o.items.map((i) => (
                        <li key={`${i.fabricId}-${i.colorId}`} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: i.colorHex }} aria-hidden="true" />
                          <span className="min-w-0 truncate">
                            {t(i.fabricName)}, {t(i.colorName)}
                            {i.meters ? ` — ${formatLength(i.meters, unit, lang)}` : ''}
                            {i.garmentKey ? ` · ${t(findGarment(i.garmentKey)?.name ?? L('', '', ''))}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="tabular mt-1.5 text-[13px] text-muted">
                      {formatDate(o.createdAt, lang)}
                      {o.kind === 'fabric' ? ` · ${formatMoney(o.totalUZS, 'UZS', lang)}` : ''}
                    </p>
                  </li>
                ))}
                {history.tailorRequests.map((r) => (
                  <li key={r.number} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {r.number} · {t(L('Tikish', 'Пошив', 'Tailoring'))}
                      </span>
                      <span className="shrink-0 rounded-full bg-mist px-2.5 py-0.5 text-[12.5px]">{t(TAILOR_REQUEST_LABEL[r.status])}</span>
                    </div>
                    <p className="mt-1 text-[13.5px] text-graphite">
                      {t(findGarment(r.garmentKey)?.name ?? L(r.garmentKey, r.garmentKey, r.garmentKey))} — {r.tailor.atelierName}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      {formatDate(r.createdAt, lang)} · {r.fabricLabel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              const next = clampMeasurements(draft);
              setDraft(next);
              setMeasurements(next);
              notify(t(L('O‘lchamlar saqlandi', 'Мерки сохранены', 'Measurements saved')));
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              {fields.map(([k, label]) => (
                <label key={k} className="block">
                  <span className="label">{t(label)}, sm</span>
                  <input
                    className="field tabular"
                    type="number"
                    inputMode="numeric"
                    min={MEASURE_LIMITS[k][0]}
                    max={MEASURE_LIMITS[k][1]}
                    value={Number.isFinite(draft[k]) ? draft[k] : ''}
                    onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <p className="mt-4 text-[13.5px] text-graphite">
              {t(L('O‘lcham', 'Размер', 'Size'))}: {size.INT} · {size.EU} · {size.US} · {size.UK}.{' '}
              {t(L('3D maneken, metraj hisobi va tikuvchiga so‘rov shu o‘lchamlardan foydalanadi.', '3D-манекен, расчёт метража и заявки портным используют эти мерки.', 'The 3D mannequin, length estimates and tailor requests use these.'))}
            </p>
            <button type="submit" className="btn btn-primary mt-6">
              {t(L('Saqlash', 'Сохранить', 'Save'))}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-line pt-5">
          <button
            type="button"
            className="text-[14px] text-graphite hover:text-ink"
            onClick={() => {
              signOut();
              close();
              setHistory(null);
              notify(t(L('Profildan chiqdingiz', 'Вы вышли из профиля', 'Signed out')));
            }}
          >
            {t(UI.signOut)}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
