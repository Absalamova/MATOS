import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, QrCode, ShieldCheck } from 'lucide-react';
import { useApp } from '../state/app';
import { L } from '../lib/i18n';
import { formatDayTime, formatMoney } from '../lib/format';
import { errorText } from '../lib/api';
import { claimPay, lookupPay, payPageUrl, walletName } from '../lib/pay';
import { formatCard, PAYMENT_STATUS_LABEL } from '../../shared/payment';
import type { PayInfo } from '../types';

/** Square QR drawn as one SVG path (no innerHTML). The encoder is loaded only when a QR is shown. */
function QrImage({ text, label }: { text: string; label: string }) {
  const [path, setPath] = useState<{ d: string; n: number } | null>(null);
  useEffect(() => {
    let live = true;
    import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
      if (live) setPath({ d, n: n + 8 });
    });
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <div className="mx-auto aspect-square w-full max-w-[220px] rounded-lg bg-white p-1 ring-1 ring-line">
      {path ? (
        <svg viewBox={`0 0 ${path.n} ${path.n}`} className="h-full w-full" role="img" aria-label={label} shapeRendering="crispEdges">
          <path d={path.d} fill="#000" />
        </svg>
      ) : (
        <div className="h-full w-full animate-pulse rounded bg-well" aria-hidden="true" />
      )}
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older in-app browsers: fall back to a hidden selection.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function CopyButton({ value, label, done, className = '' }: { value: string; label: string; done: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`btn btn-secondary h-11 gap-2 ${className}`}
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 2200);
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-ok" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}

const useCoarsePointer = () => {
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  return coarse;
};

/**
 * Pay for a QR order: card to pay to, exact amount, a QR that opens this page on a phone, and “I paid”.
 * Pass the pay token from checkout, or an empty token when the shopper is signed in and owns the order.
 */
export function PaymentPanel({ number, token }: { number: string; token: string }) {
  const { t, lang, settings } = useApp();
  const coarse = useCoarsePointer();
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [error, setError] = useState('');
  const [last4, setLast4] = useState('');
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(!coarse);

  const load = useCallback(
    (signal?: AbortSignal) =>
      lookupPay(number, token, signal)
        .then((p) => {
          setPay(p);
          setError('');
        })
        .catch((e) => {
          if (!signal?.aborted) setError(errorText(e, t));
        }),
    [number, token, t],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // While staff check the transfer, refresh now and then so “Paid” shows up without a reload.
  useEffect(() => {
    if (pay?.paymentStatus !== 'claimed' || pay.status === 'cancelled') return;
    const id = window.setInterval(() => document.visibilityState === 'visible' && void load(), 20_000);
    return () => window.clearInterval(id);
  }, [pay?.paymentStatus, pay?.status, load]);

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      setPay(await claimPay(number, token, last4));
      setError('');
    } catch (ex) {
      setError(errorText(ex, t));
    } finally {
      setBusy(false);
    }
  };

  if (!pay) {
    return error ? (
      <p className="rounded-lg bg-mist p-4 text-[14px] text-danger" role="alert">
        {error}
      </p>
    ) : (
      <div className="space-y-3" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded bg-well" />
        <div className="h-36 animate-pulse rounded-xl bg-well" />
      </div>
    );
  }

  const amount = formatMoney(pay.totalUZS, 'UZS', lang);
  const cancelled = pay.status === 'cancelled';
  const open = !cancelled && (pay.paymentStatus === 'unpaid' || pay.paymentStatus === 'claimed');
  const deadline = pay.payDeadline ? formatDayTime(pay.payDeadline, lang) : '';
  const wallet = walletName(pay.payLink);
  const link = payPageUrl(number, token);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] uppercase tracking-[0.08em] text-graphite">{t(L(`To‘lov · ${pay.number}`, `Оплата · ${pay.number}`, `Payment · ${pay.number}`))}</p>
        <p className="tabular mt-1 font-display text-[34px] leading-none">{amount}</p>
        <p
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-[13px] font-medium ${
            cancelled ? 'bg-well text-graphite' : pay.paymentStatus === 'paid' ? 'bg-ok/10 text-ok' : pay.paymentStatus === 'claimed' ? 'bg-tape-soft text-ink' : 'bg-mist text-ink'
          }`}
          role="status"
        >
          {cancelled ? t(L('Buyurtma bekor qilingan', 'Заказ отменён', 'Order cancelled')) : t(PAYMENT_STATUS_LABEL[pay.paymentStatus])}
        </p>
      </div>

      {pay.paymentStatus === 'paid' && (
        <p className="rounded-lg bg-mist p-4 text-[14.5px]">
          {t(L('Rahmat! To‘lov qabul qilindi. Operator yetkazish vaqtini kelishish uchun qo‘ng‘iroq qiladi.', 'Спасибо! Оплата получена. Оператор позвонит, чтобы согласовать доставку.', 'Thank you! Payment received. We’ll call to arrange delivery.'))}
        </p>
      )}
      {pay.paymentStatus === 'claimed' && !cancelled && (
        <p className="rounded-lg bg-tape-soft p-4 text-[14.5px]">
          {t(L('Rahmat! Pul kartaga tushganini tekshiryapmiz — odatda ish vaqtida 30 daqiqagacha. Tasdiqlangach, holat shu yerda “To‘landi” bo‘ladi.', 'Спасибо! Проверяем поступление — обычно до 30 минут в рабочее время. После подтверждения статус здесь сменится на «Оплачен».', 'Thanks! We’re checking the transfer — usually within 30 minutes in working hours. The status here will change to “Paid”.'))}
        </p>
      )}
      {cancelled && (
        <p className="rounded-lg bg-mist p-4 text-[14.5px] text-graphite">
          {t(L('To‘lov muddati o‘tgani uchun buyurtma bekor qilindi. Pul o‘tkazgan bo‘lsangiz, biz bilan bog‘laning — qaytaramiz yoki buyurtmani tiklaymiz.', 'Заказ отменён, срок оплаты истёк. Если вы уже перевели деньги, свяжитесь с нами — вернём или восстановим заказ.', 'The order was cancelled because the payment time ran out. If you already paid, contact us and we’ll refund or restore it.'))}
          {settings.supportPhone ? ` ${settings.supportPhone}` : ''}
        </p>
      )}

      {open && (
        <>
          {pay.paymentStatus === 'unpaid' && (
            <ol className="space-y-5">
              <li>
                <p className="label">{t(L('1. Shu kartaga o‘tkazing', '1. Переведите на эту карту', '1. Transfer to this card'))}</p>
                <div className="rounded-xl bg-ink p-5 text-white">
                  <p className="tabular select-all text-[22px] tracking-[0.06em] sm:text-[24px]">{formatCard(pay.cardNumber)}</p>
                  <p className="mt-3 text-[13.5px] uppercase tracking-[0.06em] text-white/75">
                    {pay.cardHolder}
                    {pay.bankName ? ` · ${pay.bankName}` : ''}
                  </p>
                </div>
                <CopyButton className="mt-2 w-full" value={pay.cardNumber} label={t(L('Karta raqamini nusxalash', 'Скопировать номер карты', 'Copy card number'))} done={t(L('Nusxalandi', 'Скопировано', 'Copied'))} />
              </li>
              <li>
                <p className="label">{t(L('2. Aynan shu summani yuboring', '2. Отправьте ровно эту сумму', '2. Send exactly this amount'))}</p>
                <div className="flex items-center gap-2">
                  <span className="tabular flex h-11 flex-1 items-center rounded-[10px] border border-line px-4 text-[17px] font-medium">{amount}</span>
                  <CopyButton value={String(pay.totalUZS)} label={t(L('Nusxalash', 'Копировать', 'Copy'))} done={t(L('Nusxalandi', 'Скопировано', 'Copied'))} />
                </div>
                <p className="mt-1.5 text-[13px] text-graphite">
                  {t(L(`Ilovada izoh bo‘lsa, ${pay.number} deb yozing. Click, Payme, Uzum yoki bank ilovangiz — farqi yo‘q.`, `Если в приложении есть комментарий, укажите ${pay.number}. Подойдёт Click, Payme, Uzum или приложение банка.`, `If your app has a comment field, write ${pay.number}. Click, Payme, Uzum or your bank app all work.`))}
                </p>
                {wallet && (
                  <a className="btn btn-secondary mt-2 h-11 w-full gap-2" href={pay.payLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t(L(`${wallet} ilovasida ochish`, `Открыть в ${wallet}`, `Open in ${wallet}`))}
                  </a>
                )}
              </li>
              <li>
                <form onSubmit={claim}>
                  <p className="label">{t(L('3. O‘tkazgach, xabar bering', '3. После перевода сообщите нам', '3. Tell us once it’s sent'))}</p>
                  <label className="block">
                    <span className="block text-[13px] text-graphite">{t(L('Siz to‘lagan kartaning oxirgi 4 raqami (ixtiyoriy, tekshiruvni tezlashtiradi)', 'Последние 4 цифры вашей карты (необязательно, ускорит проверку)', 'Last 4 digits of the card you paid from (optional, speeds up the check)'))}</span>
                    <input
                      className="field tabular mt-1.5 w-36 text-center tracking-[0.3em]"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      value={last4}
                      onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      aria-label={t(L('Kartaning oxirgi 4 raqami', 'Последние 4 цифры карты', 'Last 4 card digits'))}
                    />
                  </label>
                  <button type="submit" className="btn btn-primary mt-3 h-12 w-full" disabled={busy || (last4.length > 0 && last4.length < 4)}>
                    {busy ? t(L('Yuborilmoqda…', 'Отправляем…', 'Sending…')) : t(L('To‘ladim', 'Я оплатил(а)', 'I’ve paid'))}
                  </button>
                </form>
                {deadline && (
                  <p className="mt-2 text-[13px] text-graphite">
                    {t(L(`${deadline} gacha to‘lang. Keyin buyurtma bekor bo‘ladi va mato boshqalarga sotuvga qaytadi.`, `Оплатите до ${deadline}. Потом заказ отменится, а ткань вернётся в продажу.`, `Pay by ${deadline}. After that the order is cancelled and the fabric goes back on sale.`))}
                  </p>
                )}
              </li>
            </ol>
          )}

          {pay.paymentStatus === 'unpaid' && (
          <section className="rounded-xl border border-line p-4">
            <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
              <span className="flex items-center gap-2 text-[14.5px] font-medium">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                {coarse
                  ? t(L('Boshqa telefonda ochish uchun QR', 'QR, чтобы открыть на другом телефоне', 'QR to open on another phone'))
                  : t(L('Telefonda to‘lash uchun QR', 'QR для оплаты с телефона', 'QR to pay from your phone'))}
              </span>
              <span className="text-[13px] text-graphite">{showQr ? t(L('Yopish', 'Скрыть', 'Hide')) : t(L('Ko‘rsatish', 'Показать', 'Show'))}</span>
            </button>
            {showQr && (
              <div className="mt-4 space-y-3">
                <QrImage text={link} label={t(L(`${pay.number} to‘lov sahifasi QR kodi`, `QR-код страницы оплаты ${pay.number}`, `QR code for ${pay.number} payment page`))} />
                <p className="text-center text-[13px] text-graphite">
                  {t(L('Telefon kamerasi bilan skanerlang — shu sahifa telefoningizda ochiladi, karta raqamini u yerdan nusxalaysiz.', 'Наведите камеру телефона — эта страница откроется на телефоне, номер карты скопируете там.', 'Scan with your phone camera — this page opens there and you can copy the card number.'))}
                </p>
                <CopyButton className="w-full" value={link} label={t(L('Havolani nusxalash', 'Скопировать ссылку', 'Copy link'))} done={t(L('Nusxalandi', 'Скопировано', 'Copied'))} />
              </div>
            )}
          </section>
          )}
        </>
      )}

      {error && (
        <p className="text-[13.5px] text-danger" role="alert">
          {error}
        </p>
      )}

      <p className="flex gap-2 rounded-lg bg-mist p-3 text-[13px] leading-relaxed text-graphite">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
        <span>
          {t(L(
            'MATOS hech qachon karta raqamingiz, SMS-kod yoki CVV so‘ramaydi. Pulni faqat shu sahifadagi kartaga o‘tkazing; kimdir telefonda boshqa karta aytsa — o‘tkazmang.',
            'MATOS никогда не просит номер вашей карты, SMS-код или CVV. Переводите только на карту с этой страницы; если по телефону называют другую — не переводите.',
            'MATOS never asks for your card number, SMS code or CVV. Only pay to the card on this page; if someone on the phone gives you another card, don’t pay.',
          ))}
        </span>
      </p>
    </div>
  );
}
