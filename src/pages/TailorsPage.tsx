import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Search, Send, Star } from 'lucide-react';
import { useApp } from '../state/app';
import { navigate, Route } from '../lib/router';
import { L, UI } from '../lib/i18n';
import { displayPhone, formatMoney, formatNumber, formatPhone, isValidPhone, normalizePhone, telHref } from '../lib/format';
import { CITIES, SPECIALTIES, specialtyFor, type SpecialtyKey, type Tailor } from '../data/tailors';
import { GARMENTS, findGarment } from '../data/garments';
import { findColor } from '../data/fabrics';
import { applyAsTailor, errorText, requestTailor } from '../lib/api';
import { sizeFor } from '../lib/measure';
import { Dialog } from '../components/ui/Dialog';
import { GarmentTypeKey } from '../types';

function BookingDialog({ tailor, onClose, preset }: { tailor: Tailor | null; onClose: () => void; preset: { garment?: string; fabric?: string; color?: string } }) {
  const { t, lang, user, measurements, cart, fabricById, notify } = useApp();
  const [garment, setGarment] = useState<GarmentTypeKey>(
    (findGarment(preset.garment ?? '')?.typeKey as GarmentTypeKey) ?? (tailor ? specialtyFor(tailor.specialtyKey).garments[0] : 'slip_dress'),
  );
  const fabricOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    const add = (fid: string, cid?: string) => {
      const f = fabricById(fid);
      if (!f) return;
      const c = findColor(f, cid);
      const id = `${f.id}:${c.id}`;
      if (!opts.some((o) => o.id === id)) opts.push({ id, label: `${t(f.name)}, ${t(c.name)}` });
    };
    if (preset.fabric) add(preset.fabric, preset.color);
    cart.forEach((i) => add(i.fabricId, i.colorId));
    return opts;
  }, [preset.fabric, preset.color, cart, fabricById, t]);
  const [fabricChoice, setFabricChoice] = useState(fabricOptions[0]?.id ?? 'own');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user ? displayPhone(user.phone) : '+998 ');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    if (tailor) {
      setDoneId(null);
      setError('');
    }
  }, [tailor]);

  if (!tailor) return null;
  const g = findGarment(garment)!;
  const size = sizeFor(measurements);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError(t(L('Ismingizni yozing.', 'Укажите имя.', 'Enter your name.')));
    if (!isValidPhone(phone)) return setError(t(L('Telefon raqamini +998 XX XXX XX XX ko‘rinishida yozing.', 'Укажите телефон в формате +998 XX XXX XX XX.', 'Enter the phone as +998 XX XXX XX XX.')));
    setError('');
    setBusy(true);
    try {
      const [fabricId, colorId] = fabricChoice === 'own' ? [undefined, undefined] : fabricChoice.split(':');
      const req = await requestTailor({
        tailorId: tailor.id,
        garmentKey: garment,
        fabricId,
        colorId,
        customer: { name: name.trim(), phone: normalizePhone(phone)! },
        measurements,
        note: note.trim() || undefined,
      });
      setDoneId(req.number);
      notify(t(L(`So‘rov yuborildi: ${req.number}`, `Заявка отправлена: ${req.number}`, `Request sent: ${req.number}`)));
    } catch (ex) {
      setError(errorText(ex, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!tailor} onClose={onClose} title={doneId ? t(L('So‘rov yuborildi', 'Заявка отправлена', 'Request sent')) : tailor.atelierName} size="md" closeLabel={t(UI.close)}>
      {doneId ? (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-[17px]">
            {t(L(`So‘rov raqami ${doneId}. ${tailor.name} 1 ish kuni ichida ${phone} raqamiga qo‘ng‘iroq qiladi.`, `Номер заявки ${doneId}. ${tailor.name} позвонит на ${phone} в течение рабочего дня.`, `Request ${doneId}. ${tailor.name} will call ${phone} within one working day.`))}
          </p>
          <p className="mt-3 text-graphite">{t(L('Tikish narxi va muddati suhbatda aniqlanadi.', 'Цена и сроки пошива уточняются в разговоре.', 'Price and timing are agreed on the call.'))}</p>
          <button type="button" className="btn btn-primary mt-8" onClick={onClose}>{t(UI.close)}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 px-5 py-6 sm:px-6" noValidate>
          <p className="text-graphite">
            {tailor.name} · {tailor.city}, {tailor.district}. {t(L('Tikish', 'Пошив', 'Sewing'))} {formatMoney(tailor.priceStartingUZS, 'UZS', lang)} {t(L('dan', 'и выше', 'and up'))}, ~{tailor.leadDays} {t(L('kun', 'дн.', 'days'))}.
          </p>
          <label className="block">
            <span className="label">{t(L('Nima tikiladi', 'Что шьём', 'What to make'))}</span>
            <select className="field" value={garment} onChange={(e) => setGarment(e.target.value as GarmentTypeKey)}>
              {GARMENTS.map((x) => (
                <option key={x.id} value={x.typeKey}>{t(x.name)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t(L('Mato', 'Ткань', 'Fabric'))}</span>
            <select className="field" value={fabricChoice} onChange={(e) => setFabricChoice(e.target.value)}>
              {fabricOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
              <option value="own">{t(L('Matoni o‘zim olib boraman', 'Принесу свою ткань', 'I’ll bring my own fabric'))}</option>
            </select>
          </label>
          <div className="rounded-lg bg-mist p-3 text-[13.5px] text-graphite">
            {t(L('O‘lchamlaringiz', 'Ваши мерки', 'Your measurements'))}: {measurements.heightCm} / {measurements.bustCm} / {measurements.waistCm} / {measurements.hipsCm} sm · {size.EU}.{' '}
            <a className="underline underline-offset-4 hover:text-ink" href="#/studio" onClick={onClose}>{t(L('3D studiyada o‘zgartirish', 'Изменить в 3D-студии', 'Edit in the 3D studio'))}</a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t(L('Ism', 'Имя', 'Name'))}</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-autofocus />
            </label>
            <label className="block">
              <span className="label">{t(L('Telefon', 'Телефон', 'Phone'))}</span>
              <input className="field tabular" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} autoComplete="tel" aria-invalid={!!error && !isValidPhone(phone)} />
            </label>
          </div>
          <label className="block">
            <span className="label">{t(L('Izoh (ixtiyoriy)', 'Комментарий (необязательно)', 'Note (optional)'))}</span>
            <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t(L('Masalan: to‘yga, 3 haftada kerak', 'Например: на свадьбу, нужно через 3 недели', 'E.g. for a wedding, needed in 3 weeks'))} />
          </label>
          {error && <p className="text-[13.5px] text-danger" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? t(L('Yuborilmoqda…', 'Отправляем…', 'Sending…')) : t(L('So‘rov yuborish', 'Отправить заявку', 'Send request'))}
          </button>
        </form>
      )}
    </Dialog>
  );
}

function RegisterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, notify } = useApp();
  const [f, setF] = useState({ name: '', atelier: '', city: 'Toshkent', district: '', specialty: 'couture' as SpecialtyKey, years: '5', price: '300000', phone: '+998 ', telegram: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const upd = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const finish = () => {
    onClose();
    if (sent) {
      setSent(false);
      setF((p) => ({ ...p, name: '', atelier: '', district: '', telegram: '', phone: '+998 ' }));
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (f.name.trim().length < 2 || f.atelier.trim().length < 2) return setError(t(L('Usta va atelye nomini yozing.', 'Укажите имя мастера и название ателье.', 'Enter the tailor and atelier names.')));
    if (!isValidPhone(f.phone)) return setError(t(L('Telefon raqamini to‘liq yozing.', 'Укажите телефон полностью.', 'Enter the full phone number.')));
    const tg = f.telegram.trim().replace(/^@/, '');
    if (tg && !/^[A-Za-z0-9_]{3,32}$/.test(tg)) return setError(t(L('Telegram: faqat lotin harflari, raqam va _', 'Telegram: только латиница, цифры и _', 'Telegram: letters, digits and _ only')));
    setError('');
    setBusy(true);
    try {
      await applyAsTailor({
        name: f.name.trim(),
        atelierName: f.atelier.trim(),
        city: f.city,
        district: f.district.trim() || undefined,
        specialtyKey: f.specialty,
        experienceYears: Math.max(0, Math.round(Number(f.years) || 0)),
        priceStartingUZS: Math.max(0, Math.round(Number(f.price) || 0)),
        phone: normalizePhone(f.phone)!,
        telegram: tg || undefined,
      });
      setSent(true);
      notify(t(L('Ariza yuborildi', 'Заявка отправлена', 'Application sent')));
    } catch (ex) {
      setError(errorText(ex, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={finish} title={sent ? t(L('Ariza qabul qilindi', 'Заявка принята', 'Application received')) : t(L('Atelyeni qo‘shish', 'Добавить ателье', 'List your atelier'))} closeLabel={t(UI.close)}>
      {sent ? (
        <div className="px-5 py-8 sm:px-6">
          <div className="h-1.5 w-16 rounded-full bg-tape" aria-hidden="true" />
          <p className="mt-6 text-[17px]">
            {t(L(`${f.atelier} arizasi qabul qilindi. Moderator 1–2 ish kunida ${f.phone} raqamiga bog‘lanadi, tasdiqlangach atelye ro‘yxatda chiqadi.`, `Заявка ${f.atelier} принята. Модератор свяжется по номеру ${f.phone} в течение 1–2 рабочих дней; после проверки ателье появится в списке.`, `${f.atelier} is under review. We’ll call ${f.phone} within 1–2 working days; the atelier appears in the list once approved.`))}
          </p>
          <button type="button" className="btn btn-primary mt-8" onClick={finish}>{t(UI.close)}</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 px-5 py-6 sm:px-6" noValidate>
          <p className="text-graphite">{t(L('Ariza tekshiruvdan keyin ro‘yxatda chiqadi. Reyting birinchi sharhlardan keyin paydo bo‘ladi.', 'Профиль появится в списке после проверки. Рейтинг — после первых отзывов.', 'Your profile appears after a quick review. A rating shows after the first reviews.'))}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">{t(L('Usta ismi', 'Имя мастера', 'Tailor name'))}</span><input className="field" value={f.name} onChange={(e) => upd('name', e.target.value)} autoComplete="name" data-autofocus /></label>
            <label className="block"><span className="label">{t(L('Atelye nomi', 'Название ателье', 'Atelier name'))}</span><input className="field" value={f.atelier} onChange={(e) => upd('atelier', e.target.value)} autoComplete="organization" /></label>
            <label className="block"><span className="label">{t(L('Shahar', 'Город', 'City'))}</span>
              <select className="field" value={f.city} onChange={(e) => upd('city', e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block"><span className="label">{t(L('Tuman, ko‘cha', 'Район, улица', 'District, street'))}</span><input className="field" value={f.district} onChange={(e) => upd('district', e.target.value)} /></label>
            <label className="block sm:col-span-2"><span className="label">{t(L('Ixtisoslik', 'Специализация', 'Speciality'))}</span>
              <select className="field" value={f.specialty} onChange={(e) => upd('specialty', e.target.value)}>{SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{t(s.label)}</option>)}</select>
            </label>
            <label className="block"><span className="label">{t(L('Tajriba, yil', 'Опыт, лет', 'Experience, years'))}</span><input className="field" type="number" min={0} max={70} inputMode="numeric" value={f.years} onChange={(e) => upd('years', e.target.value)} /></label>
            <label className="block"><span className="label">{t(L('Tikish narxi, so‘mdan', 'Цена пошива от, сум', 'Sewing from, UZS'))}</span><input className="field" type="number" min={0} inputMode="numeric" step={10000} value={f.price} onChange={(e) => upd('price', e.target.value)} /></label>
            <label className="block"><span className="label">{t(L('Telefon', 'Телефон', 'Phone'))}</span><input className="field tabular" type="tel" inputMode="tel" value={f.phone} onChange={(e) => upd('phone', formatPhone(e.target.value))} autoComplete="tel" /></label>
            <label className="block"><span className="label">Telegram</span><input className="field" value={f.telegram} placeholder="@username" onChange={(e) => upd('telegram', e.target.value)} /></label>
          </div>
          {error && <p className="text-[13.5px] text-danger" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? t(L('Yuborilmoqda…', 'Отправляем…', 'Sending…')) : t(L('Arizani yuborish', 'Отправить заявку', 'Send application'))}
          </button>
        </form>
      )}
    </Dialog>
  );
}

export function TailorsPage({ route }: { route: Route }) {
  const { t, lang, tailors } = useApp();
  const q = route.query;
  const [city, setCity] = useState<string>('all');
  const presetGarment = q.get('garment') ?? undefined;
  const presetSpecialty = presetGarment ? SPECIALTIES.find((s) => s.garments.includes(presetGarment as GarmentTypeKey))?.id : undefined;
  const [spec, setSpec] = useState<SpecialtyKey | 'all'>(presetSpecialty ?? 'all');
  const [query, setQuery] = useState('');
  const [booking, setBooking] = useState<Tailor | null>(() => tailors.find((x) => x.id === q.get('book')) ?? null);
  // The list may arrive after the page opened with ?book=…
  useEffect(() => {
    const id = q.get('book');
    if (id && !booking) {
      const found = tailors.find((x) => x.id === id);
      if (found) setBooking(found);
    }
  }, [tailors]); // eslint-disable-line react-hooks/exhaustive-deps
  const [registering, setRegistering] = useState(q.get('register') === '1');

  const list = tailors.filter((x) => {
    if (city !== 'all' && x.city !== city) return false;
    if (spec !== 'all' && x.specialtyKey !== spec) return false;
    const qq = query.trim().toLowerCase();
    if (qq && ![x.name, x.atelierName, x.city, x.district, t(x.specialtyLabel)].join(' ').toLowerCase().includes(qq)) return false;
    return true;
  });
  const cities = ['all', ...CITIES.filter((c) => tailors.some((x) => x.city === c))];
  const preset = { garment: presetGarment, fabric: q.get('fabric') ?? undefined, color: q.get('color') ?? undefined };

  return (
    <div className="wrap pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-[40px] sm:text-[52px]">{t(UI.tailors)}</h1>
          <p className="mt-3 text-graphite">
            {t(L('Matoni tanlab bo‘lgach, uni tikib beradigan ustani shu yerda toping. So‘rovingiz o‘lchamlaringiz bilan birga yuboriladi.', 'Выбрали ткань — найдите мастера, который её сошьёт. Заявка уходит вместе с вашими мерками.', 'Chosen your fabric? Find a tailor to make it. Your request is sent with your measurements.'))}
          </p>
        </div>
        <button type="button" className="btn btn-secondary self-start lg:self-auto" onClick={() => setRegistering(true)}>
          {t(L('Atelyeni qo‘shish', 'Добавить ателье', 'List your atelier'))}
        </button>
      </div>

      <div className="mt-8 space-y-4">
        <label className="relative block max-w-md">
          <span className="sr-only">{t(L('Qidirish', 'Поиск', 'Search'))}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input type="search" className="field rounded-full pl-11" placeholder={t(L('Usta yoki atelye nomi', 'Имя мастера или ателье', 'Tailor or atelier name'))} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-7 sm:px-7 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label={t(L('Shahar', 'Город', 'City'))}>
          {cities.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={city === c} onClick={() => setCity(c)}>
              {c === 'all' ? t(L('Barcha shaharlar', 'Все города', 'All cities')) : c}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-7 sm:px-7 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label={t(L('Ixtisoslik', 'Специализация', 'Speciality'))}>
          <button type="button" className="chip" aria-pressed={spec === 'all'} onClick={() => setSpec('all')}>{t(L('Barcha yo‘nalishlar', 'Все направления', 'All kinds'))}</button>
          {SPECIALTIES.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={spec === s.id} onClick={() => setSpec(s.id)}>{t(s.label)}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-display text-[24px]">{t(L('Bu filtr bo‘yicha usta yo‘q', 'По этому фильтру мастеров нет', 'No tailors for this filter'))}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => { setCity('all'); setSpec('all'); setQuery(''); }}>{t(L('Filtrlarni tozalash', 'Сбросить фильтры', 'Clear filters'))}</button>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((x) => (
            <article key={x.id} className="flex flex-col rounded-xl border border-line p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-[24px] leading-tight">{x.atelierName}</h2>
                  <p className="mt-1 text-[14px] text-graphite">{x.name} · {x.city}, {x.district}</p>
                </div>
                {x.rating ? (
                  <span className="tabular inline-flex shrink-0 items-center gap-1 text-[14px]" aria-label={`${formatNumber(x.rating, lang, 1)} / 5, ${x.reviewsCount}`}>
                    <Star className="h-4 w-4 fill-ink" />
                    {formatNumber(x.rating, lang, 1)}
                    <span className="text-muted">({x.reviewsCount})</span>
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-tape-soft px-2.5 py-0.5 text-[12.5px]">{t(L('Yangi', 'Новый', 'New'))}</span>
                )}
              </div>
              <p className="mt-4 text-[14.5px]">{t(x.description)}</p>
              <dl className="tabular mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[13px]">
                <div><dt className="text-muted">{t(L('Tajriba', 'Опыт', 'Experience'))}</dt><dd>{x.experienceYears} {t(L('yil', 'лет', 'yrs'))}</dd></div>
                <div><dt className="text-muted">{t(L('Narx', 'Цена', 'From'))}</dt><dd>{formatMoney(x.priceStartingUZS, 'UZS', lang)}</dd></div>
                <div><dt className="text-muted">{t(L('Muddat', 'Срок', 'Lead time'))}</dt><dd>~{x.leadDays} {t(L('kun', 'дн.', 'days'))}</dd></div>
              </dl>
              <div className="mt-auto flex items-center gap-2 pt-6">
                <button type="button" className="btn btn-primary flex-1" onClick={() => setBooking(x)}>{t(L('Buyurtma berish', 'Заказать пошив', 'Request a fitting'))}</button>
                <a className="icon-btn border border-line" href={telHref(x.phone)} aria-label={`${t(L('Qo‘ng‘iroq', 'Позвонить', 'Call'))} ${x.phone}`}><Phone className="h-4 w-4" /></a>
                {x.telegram && (
                  <a className="icon-btn border border-line" href={`https://t.me/${x.telegram.replace('@', '')}`} target="_blank" rel="noreferrer" aria-label={`Telegram ${x.telegram}`}><Send className="h-4 w-4" /></a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <BookingDialog key={booking?.id ?? 'none'} tailor={booking} onClose={() => { setBooking(null); if (q.get('book')) navigate('tailors', { replace: true, query: { garment: presetGarment, fabric: preset.fabric, color: preset.color } }); }} preset={preset} />
      <RegisterDialog open={registering} onClose={() => setRegistering(false)} />
    </div>
  );
}
