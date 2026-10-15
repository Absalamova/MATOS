import type { Localized, PaymentReceiver, PaymentStatus } from './types.ts';

export const DEFAULT_RECEIVER: PaymentReceiver = {
  enabled: false,
  cardNumber: '',
  cardHolder: '',
  bankName: '',
  payLink: '',
  holdHours: 24,
};

export const MIN_HOLD_HOURS = 1;
export const MAX_HOLD_HOURS = 72;

export const cardDigits = (s: string) => s.replace(/\D/g, '');

/** Luhn checksum — Uzcard, Humo, Visa and Mastercard numbers all carry one, so a typo is caught before money goes astray. */
export function luhnValid(digits: string) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export const isCardNumber = (s: string) => {
  const d = cardDigits(s);
  return d.length === 16 && luhnValid(d);
};

/** 8600 1234 5678 9012 */
export const formatCard = (s: string) => cardDigits(s).replace(/(\d{4})(?=\d)/g, '$1 ');

/** 8600 •••• •••• 9012 */
export const maskCard = (s: string) => {
  const d = cardDigits(s);
  return d.length >= 8 ? `${d.slice(0, 4)} •••• •••• ${d.slice(-4)}` : '';
};

/**
 * Pay links may only point at these wallets. A link is shown to every paying customer, so a
 * look-alike domain typed by mistake (or by someone with a stolen admin session) must not get through.
 */
export const PAY_LINK_HOSTS = ['payme.uz', 'click.uz', 'uzumbank.uz', 'uzum.uz'];

export function isAllowedPayLink(url: string) {
  if (!url) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    const host = u.hostname.toLowerCase();
    return PAY_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, Localized> = {
  unpaid: { uz: 'To‘lov kutilmoqda', ru: 'Ожидает оплаты', en: 'Awaiting payment' },
  claimed: { uz: 'Tekshirilmoqda', ru: 'Проверяем оплату', en: 'Checking payment' },
  paid: { uz: 'To‘landi', ru: 'Оплачен', en: 'Paid' },
  refunded: { uz: 'Pul qaytarildi', ru: 'Возврат', en: 'Refunded' },
};

/** Staff wording: “claimed” is only the customer's word until someone sees the money. */
export const PAYMENT_STATUS_ADMIN: Record<PaymentStatus, string> = {
  unpaid: 'To‘lanmagan',
  claimed: 'Mijoz “to‘ladim” dedi — tekshiring',
  paid: 'To‘lov tasdiqlangan',
  refunded: 'Pul qaytarilgan',
};
