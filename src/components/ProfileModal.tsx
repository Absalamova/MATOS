import React, { useMemo, useState } from 'react';
import { useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { formatDate, formatMoney } from '../lib/format';
import { historyFor, OrderStatus, SwatchStatus } from '../lib/orders';
import { clampMeasurements, MEASURE_LIMITS, sizeFor } from '../lib/measure';
import { Dialog } from './ui/Dialog';
import { BodyMeasurements } from '../types';
import { href } from '../lib/router';

const ORDER_STATUS: Record<OrderStatus, ReturnType<typeof L>> = {
  new: L('Qabul qilindi', 'Принят', 'Received'),
  processing: L('Tayyorlanmoqda', 'Готовится', 'Preparing'),
  shipped: L('Yo‘lda', 'В пути', 'On the way'),
  done: L('Yetkazildi', 'Доставлен', 'Delivered'),
  cancelled: L('Bekor qilindi', 'Отменён', 'Cancelled'),
};
const SAMPLE_STATUS: Record<SwatchStatus, ReturnType<typeof L>> = {
  pending: L('Qabul qilindi', 'Принята', 'Received'),
  packed: L('Qadoqlandi', 'Упакована', 'Packed'),
  delivered: L('Yetkazildi', 'Доставлена', 'Delivered'),
};

export function ProfileModal() {
  const { t, lang, overlay, close, user, setUser, measurements, setMeasurements, notify } = useApp();
  const [tab, setTab] = useState<'orders' | 'body'>('orders');
  const [draft, setDraft] = useState<BodyMeasurements>(measurements);
  const history = useMemo(() => (user && overlay === 'profile' ? historyFor(user) : { orders: [], samples: [] }), [user, overlay]);
  if (!user) return null;
  const size = sizeFor(draft);
  const fields: [keyof BodyMeasurements, ReturnType<typeof L>][] = [
    ['heightCm', L('Bo‘y', 'Рост', 'Height')],
    ['bustCm', L('Ko‘krak', 'Грудь', 'Bust')],
    ['waistCm', L('Bel', 'Талия', 'Waist')],
    ['hipsCm', L('Son', 'Бёдра', 'Hips')],
  ];

  return (
    <Dialog open={overlay === 'profile'} onClose={close} title={user.name} size="md" closeLabel={t(UI.close)}>
      <div className="px-5 py-6 sm:px-6">
        <p className="-mt-2 text-[13.5px] text-graphite">{user.identifier}</p>
        <div className="mt-5 flex gap-2" role="tablist">
          <button type="button" role="tab" className="chip" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>{t(L('Buyurtmalar', 'Заказы', 'Orders'))}</button>
          <button type="button" role="tab" className="chip" aria-selected={tab === 'body'} onClick={() => { setDraft(measurements); setTab('body'); }}>{t(L('O‘lchamlar', 'Мерки', 'Measurements'))}</button>
        </div>

        {tab === 'orders' ? (
          <div className="mt-6">
            {history.orders.length === 0 && history.samples.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center">
                <p className="text-graphite">{t(L('Hali buyurtma yo‘q. Boshlash uchun 5 tagacha bepul namuna oling.', 'Заказов пока нет. Начните с бесплатных образцов — до 5 штук.', 'No orders yet. Start with up to 5 free samples.'))}</p>
                <a className="btn btn-primary mt-5" href={href('catalog')} onClick={close}>{t(L('Katalogga o‘tish', 'Перейти в каталог', 'Go to catalog'))}</a>
              </div>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {history.orders.map((o) => (
                  <li key={o.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{o.id} · {o.kind === 'tikuv' ? t(L('Tikish', 'Пошив', 'Tailoring')) : t(L('Mato', 'Ткань', 'Fabric'))}</span>
                      <span className="shrink-0 rounded-full bg-mist px-2.5 py-0.5 text-[12.5px]">{t(ORDER_STATUS[o.status])}</span>
                    </div>
                    <p className="mt-1 text-[13.5px] text-graphite">{o.item}</p>
                    <p className="tabular mt-1 text-[13px] text-muted">{formatDate(o.date, lang)} · {formatMoney(o.amountUZS, 'UZS', lang)}</p>
                  </li>
                ))}
                {history.samples.map((s) => (
                  <li key={s.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{s.id} · {t(UI.freeSamples)}</span>
                      <span className="shrink-0 rounded-full bg-tape-soft px-2.5 py-0.5 text-[12.5px]">{t(SAMPLE_STATUS[s.status])}</span>
                    </div>
                    <p className="mt-1 text-[13.5px] text-graphite">{s.fabrics.join(', ')}</p>
                    <p className="mt-1 text-[13px] text-muted">{formatDate(s.date, lang)}</p>
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
              setMeasurements(clampMeasurements(draft));
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
                    value={draft[k]}
                    onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <p className="mt-4 text-[13.5px] text-graphite">
              {t(L('O‘lcham', 'Размер', 'Size'))}: {size.INT} · {size.EU} · {size.US} · {size.UK}. {t(L('3D maneken va metraj hisobi shu o‘lchamlardan foydalanadi.', '3D-манекен и расчёт метража используют эти мерки.', 'The 3D mannequin and length calculations use these.'))}
            </p>
            <button type="submit" className="btn btn-primary mt-6">{t(L('Saqlash', 'Сохранить', 'Save'))}</button>
          </form>
        )}

        <div className="mt-8 border-t border-line pt-5">
          <button
            type="button"
            className="text-[14px] text-graphite hover:text-ink"
            onClick={() => {
              setUser(null);
              close();
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
