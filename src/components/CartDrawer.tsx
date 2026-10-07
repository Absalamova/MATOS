import React, { useMemo, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { MAX_SAMPLES, useApp } from '../state/app';
import { L, UI } from '../lib/i18n';
import { formatLength, formatMoney, formatPhone, isValidPhone, pricePerMeter, toUnit, fromUnit } from '../lib/format';
import { findColor } from '../data/fabrics';
import { findGarment } from '../data/garments';
import { CITIES } from '../data/tailors';
import { href } from '../lib/router';
import { placeOrder } from '../lib/orders';
import { Dialog } from './ui/Dialog';
import { ColorChip, FabricImage } from './ui/FabricImage';

type Step = 'bag' | 'checkout' | 'done';

export function CartDrawer() {
  const app = useApp();
  const { t, lang, currency, unit, overlay, close, cart, samples, fabricById, setCartMeters, removeFromCart, toggleSample, clearCart, clearSamples, user, open } = app;
  const [step, setStep] = useState<Step>('bag');
  const [form, setForm] = useState({ name: '', phone: '+998 ', city: 'Toshkent', address: '', note: '', delivery: 'courier' as 'courier' | 'pickup', payment: 'cash' as 'cash' | 'card' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ orderId?: string; swatchId?: string; phone: string } | null>(null);

  const lines = useMemo(
    () =>
      cart
        .map((i) => {
          const f = fabricById(i.fabricId);
          if (!f) return null;
          return { item: i, fabric: f, color: findColor(f, i.colorId), amount: pricePerMeter(f, currency) * i.meters, amountUZS: f.priceUZS * i.meters };
        })
        .filter(Boolean) as { item: (typeof cart)[number]; fabric: NonNullable<ReturnType<typeof fabricById>>; color: ReturnType<typeof findColor>; amount: number; amountUZS: number }[],
    [cart, fabricById, currency],
  );
  const sampleLines = samples
    .map((s) => {
      const f = fabricById(s.fabricId);
      return f ? { s, fabric: f, color: findColor(f, s.colorId) } : null;
    })
    .filter(Boolean) as { s: (typeof samples)[number]; fabric: NonNullable<ReturnType<typeof fabricById>>; color: ReturnType<typeof findColor> }[];

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const delivery = form.delivery === 'pickup' || lines.length === 0 ? 0 : subtotal >= (currency === 'UZS' ? 1000000 : 80) ? 0 : currency === 'UZS' ? 25000 : 2;
  const empty = lines.length === 0 && sampleLines.length === 0;

  const onClose = () => {
    close();
    if (step === 'done') {
      setStep('bag');
      setDone(null);
    }
  };

  const startCheckout = () => {
    setForm((f) => ({
      ...f,
      name: f.name || user?.name || '',
      phone: f.phone.trim() !== '+998' ? f.phone : user?.identifier?.startsWith('+') ? user.identifier : '+998 ',
    }));
    setStep('checkout');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = t(L('Ismingizni yozing', 'Укажите имя', 'Enter your name'));
    if (!isValidPhone(form.phone)) err.phone = t(L('Raqamni +998 XX XXX XX XX ko‘rinishida yozing', 'Формат: +998 XX XXX XX XX', 'Use +998 XX XXX XX XX'));
    if (form.delivery === 'courier' && !form.address.trim()) err.address = t(L('Manzilni yozing', 'Укажите адрес', 'Enter the address'));
    setErrors(err);
    if (Object.keys(err).length) return;
    const res = placeOrder({
      customer: { name: form.name.trim(), phone: form.phone, city: form.city, address: form.delivery === 'pickup' ? 'Olib ketish: Toshkent, Chilonzor' : form.address.trim(), userId: user?.id },
      lines: lines.map((l) => ({
        fabricId: l.fabric.id,
        colorId: l.color.id,
        title: `${l.fabric.name.uz} — ${l.color.name.uz}${l.item.garmentKey ? ` (${findGarment(l.item.garmentKey)?.name.uz})` : ''}`,
        meters: l.item.meters,
        amountUZS: Math.round(l.amountUZS),
      })),
      samples: sampleLines.map((s) => `${s.fabric.name.uz} — ${s.color.name.uz}`),
      note: form.note.trim(),
      delivery: form.delivery,
      payment: form.payment,
    });
    setDone({ ...res, phone: form.phone });
    clearCart();
    clearSamples();
    setStep('done');
  };

  const title =
    step === 'checkout'
      ? t(L('Rasmiylashtirish', 'Оформление', 'Checkout'))
      : step === 'done'
        ? t(L('Buyurtma qabul qilindi', 'Заказ принят', 'Order placed'))
        : t(UI.bag);

  const footer =
    step === 'bag' && !empty ? (
      <div className="space-y-3">
        {lines.length > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-graphite">{t(L('Matolar', 'Ткани', 'Fabrics'))}</span>
            <span className="tabular text-[20px] font-medium">{formatMoney(subtotal, currency, lang)}</span>
          </div>
        )}
        <button type="button" className="btn btn-primary w-full" onClick={startCheckout}>
          {lines.length ? t(L('Rasmiylashtirish', 'Оформить заказ', 'Check out')) : t(L('Namunalarni buyurtma qilish', 'Заказать образцы', 'Order samples'))}
        </button>
      </div>
    ) : step === 'checkout' ? (
      <div className="space-y-3">
        <div className="tabular space-y-1 text-[14px]">
          {lines.length > 0 && <div className="flex justify-between"><span className="text-graphite">{t(L('Matolar', 'Ткани', 'Fabrics'))}</span><span>{formatMoney(subtotal, currency, lang)}</span></div>}
          {sampleLines.length > 0 && <div className="flex justify-between"><span className="text-graphite">{t(UI.freeSamples)} × {sampleLines.length}</span><span>0</span></div>}
          <div className="flex justify-between"><span className="text-graphite">{t(L('Yetkazish', 'Доставка', 'Delivery'))}</span><span>{delivery ? formatMoney(delivery, currency, lang) : t(L('bepul', 'бесплатно', 'free'))}</span></div>
          <div className="flex justify-between border-t border-line pt-2 text-[17px] font-medium"><span>{t(UI.total)}</span><span>{formatMoney(subtotal + delivery, currency, lang)}</span></div>
        </div>
        <button type="submit" form="checkout" className="btn btn-primary w-full">{t(L('Buyurtmani tasdiqlash', 'Подтвердить заказ', 'Place order'))}</button>
      </div>
    ) : undefined;

  return (
    <Dialog open={overlay === 'cart'} onClose={onClose} title={title} variant="drawer" closeLabel={t(UI.close)} footer={footer}>
      {step === 'bag' && (
        <div className="px-5 py-5 sm:px-6">
          {empty ? (
            <div className="py-16 text-center">
              <p className="font-display text-[26px]">{t(L('Savat bo‘sh', 'Корзина пуста', 'Your bag is empty'))}</p>
              <p className="mx-auto mt-2 max-w-[34ch] text-graphite">
                {t(L('Matoni tanlang yoki avval 5 tagacha bepul namuna buyurtma qiling.', 'Выберите ткань или сначала закажите до 5 бесплатных образцов.', 'Choose a fabric, or start with up to 5 free samples.'))}
              </p>
              <a href={href('catalog')} onClick={onClose} className="btn btn-primary mt-8">{t(L('Katalogni ochish', 'Открыть каталог', 'Open the catalog'))}</a>
            </div>
          ) : (
            <>
              {lines.length > 0 && (
                <ul className="divide-y divide-line">
                  {lines.map((l) => (
                    <li key={l.item.id} className="flex gap-4 py-4 first:pt-0">
                      <a href={href('fabric', { id: l.fabric.id, query: { color: l.color.id } })} onClick={onClose} className="h-[88px] w-[72px] shrink-0 overflow-hidden rounded-[4px] bg-well">
                        <FabricImage fabric={l.fabric} color={l.color} alt="" />
                      </a>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{t(l.fabric.name)}</div>
                            <div className="truncate text-[13px] text-graphite">
                              {t(l.color.name)}
                              {l.item.garmentKey ? ` · ${t(findGarment(l.item.garmentKey)!.name)}` : ''}
                            </div>
                          </div>
                          <button type="button" className="icon-btn -mr-2 -mt-2 h-9 w-9 text-graphite hover:text-ink" onClick={() => removeFromCart(l.item.id)} aria-label={`${t(UI.remove)}: ${t(l.fabric.name)}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-full border border-line">
                            <button type="button" className="icon-btn h-8 w-8" onClick={() => setCartMeters(l.item.id, fromUnit(toUnit(l.item.meters, unit) - 0.5, unit))} aria-label="−0,5">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="tabular min-w-[64px] text-center text-[14px]">{formatLength(l.item.meters, unit, lang)}</span>
                            <button type="button" className="icon-btn h-8 w-8" onClick={() => setCartMeters(l.item.id, fromUnit(toUnit(l.item.meters, unit) + 0.5, unit))} aria-label="+0,5">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="tabular font-medium">{formatMoney(l.amount, currency, lang)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <section className={`${lines.length ? 'mt-6 border-t border-line pt-6' : ''}`} aria-labelledby="samples-title">
                <div className="flex items-baseline justify-between">
                  <h3 id="samples-title" className="font-sans text-[15px] font-medium">{t(UI.freeSamples)}</h3>
                  <span className="tabular text-[13px] text-graphite">{sampleLines.length}/{MAX_SAMPLES}</span>
                </div>
                <p className="mt-1 text-[13px] text-graphite">
                  {t(L('10×10 sm bo‘laklar. Matoni ushlab ko‘rib, keyin xarid qiling.', 'Отрезы 10×10 см. Потрогайте ткань, потом покупайте.', '10×10 cm cuttings. Feel the cloth before you buy.'))}
                </p>
                <div className="mt-3 flex gap-1" aria-hidden="true">
                  {Array.from({ length: MAX_SAMPLES }).map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < sampleLines.length ? 'bg-tape' : 'bg-well'}`} />
                  ))}
                </div>
                {sampleLines.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {sampleLines.map((s) => (
                      <li key={`${s.s.fabricId}-${s.s.colorId}`} className="flex items-center gap-3">
                        <ColorChip fabric={s.fabric} color={s.color} size={32} />
                        <span className="min-w-0 flex-1 truncate text-[14px]">
                          {t(s.fabric.name)}, {t(s.color.name)}
                        </span>
                        <button type="button" className="text-[13px] text-graphite underline-offset-4 hover:text-ink hover:underline" onClick={() => toggleSample(s.s.fabricId, s.s.colorId)}>
                          {t(UI.remove)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <a href={href('catalog')} onClick={onClose} className="mt-3 inline-block text-[13.5px] underline decoration-line underline-offset-4 hover:decoration-ink">
                    {t(L('Katalogdan namuna tanlash', 'Выбрать образцы в каталоге', 'Pick samples in the catalog'))}
                  </a>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {step === 'checkout' && (
        <form id="checkout" onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6" noValidate>
          <button type="button" className="text-[13.5px] text-graphite hover:text-ink" onClick={() => setStep('bag')}>
            ← {t(L('Savatga qaytish', 'Назад в корзину', 'Back to bag'))}
          </button>
          {!user && (
            <p className="rounded-lg bg-mist p-3 text-[13.5px] text-graphite">
              {t(L('Buyurtmalaringizni profilda kuzatish uchun', 'Чтобы следить за заказами в профиле,', 'To track orders in your profile,'))}{' '}
              <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => open('auth')}>{t(L('kiring', 'войдите', 'sign in'))}</button>.
            </p>
          )}
          <label className="block">
            <span className="label">{t(L('Ism va familiya', 'Имя и фамилия', 'Full name'))}</span>
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" aria-invalid={!!errors.name} data-autofocus />
            {errors.name && <span className="mt-1 block text-[13px] text-danger">{errors.name}</span>}
          </label>
          <label className="block">
            <span className="label">{t(L('Telefon', 'Телефон', 'Phone'))}</span>
            <input className="field tabular" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} autoComplete="tel" aria-invalid={!!errors.phone} />
            {errors.phone && <span className="mt-1 block text-[13px] text-danger">{errors.phone}</span>}
          </label>
          <fieldset>
            <legend className="label">{t(L('Qabul qilish', 'Получение', 'Delivery'))}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['courier', 'pickup'] as const).map((d) => (
                <button key={d} type="button" className="chip h-11 justify-center" aria-pressed={form.delivery === d} onClick={() => setForm({ ...form, delivery: d })}>
                  {d === 'courier' ? t(L('Kuryer', 'Курьер', 'Courier')) : t(L('Olib ketish', 'Самовывоз', 'Pick up'))}
                </button>
              ))}
            </div>
          </fieldset>
          {form.delivery === 'courier' ? (
            <>
              <label className="block">
                <span className="label">{t(L('Shahar', 'Город', 'City'))}</span>
                <select className="field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">{t(L('Manzil', 'Адрес', 'Address'))}</span>
                <textarea className="field" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" aria-invalid={!!errors.address} placeholder={t(L('Tuman, ko‘cha, uy, xonadon', 'Район, улица, дом, квартира', 'District, street, building, flat'))} />
                {errors.address && <span className="mt-1 block text-[13px] text-danger">{errors.address}</span>}
              </label>
            </>
          ) : (
            <p className="text-[13.5px] text-graphite">{t(L('Toshkent, Chilonzor showroom: har kuni 10:00–20:00.', 'Ташкент, шоурум на Чиланзаре: ежедневно 10:00–20:00.', 'Tashkent, Chilanzar showroom: daily 10:00–20:00.'))}</p>
          )}
          {lines.length > 0 && (
            <fieldset>
              <legend className="label">{t(L('To‘lov', 'Оплата', 'Payment'))}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'card'] as const).map((p) => (
                  <button key={p} type="button" className="chip h-11 justify-center" aria-pressed={form.payment === p} onClick={() => setForm({ ...form, payment: p })}>
                    {p === 'cash' ? t(L('Naqd, qabulda', 'Наличными', 'Cash on delivery')) : t(L('Karta, qabulda', 'Картой при получении', 'Card on delivery'))}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label className="block">
            <span className="label">{t(L('Izoh (ixtiyoriy)', 'Комментарий (необязательно)', 'Note (optional)'))}</span>
            <textarea className="field" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </form>
      )}

      {step === 'done' && done && (
        <div className="px-5 py-8 sm:px-6">
          <div className="h-1.5 w-16 rounded-full bg-tape" aria-hidden="true" />
          <p className="mt-6 text-[18px] leading-relaxed">
            {done.orderId && t(L(`Buyurtma ${done.orderId} qabul qilindi.`, `Заказ ${done.orderId} принят.`, `Order ${done.orderId} is placed.`))}{' '}
            {done.swatchId && t(L(`Namunalar so‘rovi: ${done.swatchId}.`, `Заявка на образцы: ${done.swatchId}.`, `Sample request: ${done.swatchId}.`))}
          </p>
          <p className="mt-3 text-graphite">
            {t(L(`Operator ${done.phone} raqamiga 30 daqiqa ichida qo‘ng‘iroq qilib, yetkazish vaqtini kelishib oladi.`, `Оператор позвонит на ${done.phone} в течение 30 минут и согласует доставку.`, `We’ll call ${done.phone} within 30 minutes to arrange delivery.`))}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <a className="btn btn-primary" href={href('tailors')} onClick={onClose}>{t(UI.findTailor)}</a>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t(L('Xaridni davom ettirish', 'Продолжить покупки', 'Keep shopping'))}</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
