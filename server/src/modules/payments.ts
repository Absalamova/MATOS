/**
 * QR card payments.
 *
 * The shop never sees or stores a shopper's card. Each QR order gets:
 *  - the amount fixed by the server at checkout (the browser never sends a price),
 *  - a random pay token, returned once and stored only as a SHA-256 hash, which opens the order's
 *    payment page (the page shows no name, phone or address, so a forwarded link leaks nothing personal),
 *  - a snapshot of the receiving card, so changing the card later never redirects a waiting order.
 * The shopper's “I paid” only flags the order for checking; staff mark it paid after seeing the money.
 */
import { timingSafeEqual } from 'node:crypto';
import type { Db } from '../db.ts';
import { json, nowIso } from '../db.ts';
import type { AdminRole, AdminUser, OrderStatus, PayInfo, PaymentReceiver, PaymentStatus } from '../../../shared/types.ts';
import { cardDigits, DEFAULT_RECEIVER, isAllowedPayLink, isCardNumber, maskCard, MAX_HOLD_HOURS, MIN_HOLD_HOURS } from '../../../shared/payment.ts';
import { conflict, forbidden, HttpError, invalid, notFound } from '../lib/errors.ts';
import { newToken, sha256 } from '../lib/crypto.ts';
import { v } from '../lib/validate.ts';
import { escapeHtml, type Notifier } from '../lib/telegram.ts';
import { bumpCatalog } from './revision.ts';

const KEY = 'payment';

export function getReceiver(db: Db): PaymentReceiver {
  const row = db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', KEY);
  return { ...DEFAULT_RECEIVER, ...json<Partial<PaymentReceiver>>(row?.value, {}) };
}

/** QR payment can be offered only when it is switched on and has a valid card to pay to. */
export const receiverReady = (r: PaymentReceiver) => r.enabled && isCardNumber(r.cardNumber) && r.cardHolder.trim().length >= 3;

/** Managers see the card masked; only the owner sees and edits the full number. */
export function receiverFor(r: PaymentReceiver, role: AdminRole): PaymentReceiver & { ready: boolean } {
  return { ...r, cardNumber: role === 'owner' ? r.cardNumber : maskCard(r.cardNumber), ready: receiverReady(r) };
}

export const receiverSchema = v.object({
  enabled: v.boolean(),
  cardNumber: v.string({ min: 0, max: 30 }).default(''),
  cardHolder: v.string({ min: 0, max: 80 }).default(''),
  bankName: v.string({ min: 0, max: 60 }).default(''),
  payLink: v.string({ min: 0, max: 300 }).default(''),
  holdHours: v.number({ min: MIN_HOLD_HOURS, max: MAX_HOLD_HOURS, int: true }).default(DEFAULT_RECEIVER.holdHours),
  /** The owner's own password, asked again: a stolen session token alone must not be able to redirect payments. */
  password: v.string({ max: 200, trim: false }),
});

export function saveReceiver(db: Db, input: PaymentReceiver, actor: AdminUser, notifier: Notifier): PaymentReceiver {
  const digits = cardDigits(input.cardNumber);
  const fields: Record<string, string> = {};
  if (digits && !isCardNumber(digits)) fields.cardNumber = 'Karta raqami noto‘g‘ri (16 ta raqam, tekshiruv raqami mos emas)';
  if (input.payLink && !isAllowedPayLink(input.payLink)) fields.payLink = 'Faqat https://…payme.uz, click.uz yoki uzumbank.uz havolasi';
  if (input.enabled) {
    if (!digits) fields.cardNumber = 'QR to‘lovni yoqish uchun karta raqamini kiriting';
    if (input.cardHolder.trim().length < 3) fields.cardHolder = 'Karta egasining ismini kiriting (kartadagidek)';
  }
  if (Object.keys(fields).length) throw invalid(fields);

  const prev = getReceiver(db);
  const next: PaymentReceiver = {
    enabled: input.enabled,
    cardNumber: digits,
    cardHolder: input.cardHolder.trim(),
    bankName: input.bankName.trim(),
    payLink: input.payLink.trim(),
    holdHours: input.holdHours,
  };
  const now = nowIso();
  db.tx(() => {
    db.run(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      KEY,
      JSON.stringify(next),
      now,
    );
    db.run(
      'INSERT INTO audit_log (admin_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      actor.id,
      'payment_receiver.update',
      'settings',
      KEY,
      JSON.stringify({ from: { ...prev, cardNumber: maskCard(prev.cardNumber) }, to: { ...next, cardNumber: maskCard(next.cardNumber) } }),
      now,
    );
  });
  bumpCatalog();

  const cardChanged = prev.cardNumber !== next.cardNumber;
  if (cardChanged || prev.enabled !== next.enabled || prev.payLink !== next.payLink) {
    notifier.send(
      [
        '<b>⚠️ To‘lov sozlamalari o‘zgardi</b>',
        cardChanged ? `Karta: ${maskCard(prev.cardNumber) || '—'} → <b>${maskCard(next.cardNumber) || '—'}</b>` : '',
        prev.payLink !== next.payLink ? `Havola: ${escapeHtml(next.payLink || '—')}` : '',
        `QR to‘lov: ${next.enabled ? 'yoqilgan' : 'o‘chirilgan'}`,
        `Kim: ${escapeHtml(actor.name)} (${escapeHtml(actor.email)})`,
        'Siz qilmagan bo‘lsangiz, darhol parolni almashtiring.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return next;
}

/* ───────────── Per-order payment ───────────── */

/** What gets written into a new QR order. The plain token goes back to the shopper once and is not kept. */
export function startPayment(r: PaymentReceiver, now = Date.now()) {
  if (!receiverReady(r)) throw new HttpError(422, 'payment_unavailable', 'QR orqali to‘lov hozir mavjud emas. Boshqa usulni tanlang.');
  const token = newToken();
  return {
    token,
    tokenHash: sha256(token),
    payTo: JSON.stringify({ cardNumber: r.cardNumber, cardHolder: r.cardHolder, bankName: r.bankName, payLink: r.payLink }),
    deadline: new Date(now + r.holdHours * 3600_000).toISOString(),
  };
}

interface PayRow {
  id: number;
  number: string;
  status: OrderStatus;
  user_id: number | null;
  total_uzs: number;
  payment_status: PaymentStatus | null;
  pay_token_hash: string | null;
  pay_to: string | null;
  pay_deadline: string | null;
}

const PAY_COLS = 'id, number, status, user_id, total_uzs, payment_status, pay_token_hash, pay_to, pay_deadline';

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** One answer for “no such order” and “wrong token”, so order numbers can't be probed. */
const NOT_FOUND = () => notFound('To‘lov havolasi noto‘g‘ri yoki eskirgan', 'pay_not_found');

function rowByToken(db: Db, number: string, token: string) {
  const row = db.get<PayRow>(`SELECT ${PAY_COLS} FROM orders WHERE number = ? AND payment_method = 'qr'`, number);
  if (!row?.pay_token_hash || !token || !sameHash(row.pay_token_hash, sha256(token))) throw NOT_FOUND();
  return row;
}

function rowForUser(db: Db, number: string, userId: number) {
  const row = db.get<PayRow>(`SELECT ${PAY_COLS} FROM orders WHERE number = ? AND payment_method = 'qr' AND user_id = ?`, number, userId);
  if (!row) throw NOT_FOUND();
  return row;
}

function payInfoOut(row: PayRow): PayInfo {
  const to = json<{ cardNumber?: string; cardHolder?: string; bankName?: string; payLink?: string }>(row.pay_to, {});
  const open = row.status !== 'cancelled' && (row.payment_status === 'unpaid' || row.payment_status === 'claimed');
  return {
    number: row.number,
    totalUZS: row.total_uzs,
    status: row.status,
    paymentStatus: row.payment_status ?? 'unpaid',
    payDeadline: row.pay_deadline,
    // Once the order is paid or cancelled there is nothing to pay, so the card is not shown any more.
    cardNumber: open ? (to.cardNumber ?? '') : '',
    cardHolder: open ? (to.cardHolder ?? '') : '',
    bankName: open ? (to.bankName ?? '') : '',
    payLink: open ? (to.payLink ?? '') : '',
  };
}

export const payInfoByToken = (db: Db, number: string, token: string) => payInfoOut(rowByToken(db, number, token));
export const payInfoForUser = (db: Db, number: string, userId: number) => payInfoOut(rowForUser(db, number, userId));

export const claimSchema = v.object({
  number: v.string({ max: 20, pattern: /^MT-\d{1,9}$/, message: 'Buyurtma raqami noto‘g‘ri' }),
  token: v.string({ min: 0, max: 100, trim: false }).default(''),
  payerCardLast4: v.string({ min: 0, max: 4, pattern: /^(\d{4})?$/, message: 'Kartangizning oxirgi 4 raqami' }).default(''),
});

/**
 * The shopper says they have paid. This only moves `unpaid → claimed` and tells the staff;
 * it never marks the order paid. Repeating it is harmless.
 */
export function claimPayment(
  db: Db,
  input: { number: string; token: string; payerCardLast4: string },
  userId: number | null,
  notifier: Notifier,
  adminUrl: string,
): PayInfo {
  const row = input.token ? rowByToken(db, input.number, input.token) : userId ? rowForUser(db, input.number, userId) : null;
  if (!row) throw NOT_FOUND();
  if (row.status === 'cancelled') throw conflict('Buyurtma bekor qilingan. Pul o‘tkazgan bo‘lsangiz, biz bilan bog‘laning.', 'order_cancelled');
  if (row.payment_status !== 'unpaid') return payInfoOut(row);

  const now = nowIso();
  db.tx(() => {
    db.run(
      "UPDATE orders SET payment_status = 'claimed', payment_claimed_at = ?, payer_card_last4 = ?, updated_at = ? WHERE id = ? AND payment_status = 'unpaid'",
      now,
      input.payerCardLast4 || null,
      now,
      row.id,
    );
    db.run(
      'INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)',
      row.id,
      row.status,
      `Mijoz: “to‘ladim”${input.payerCardLast4 ? ` (karta •••• ${input.payerCardLast4})` : ''}`,
      'Mijoz',
      now,
    );
  });
  notifier.send(
    [
      `<b>💳 ${row.number}: mijoz “to‘ladim” dedi</b>`,
      `Summa: <b>${new Intl.NumberFormat('ru-RU').format(row.total_uzs)} so‘m</b>`,
      input.payerCardLast4 ? `To‘lovchi karta: •••• ${input.payerCardLast4}` : '',
      'Pul kartaga tushganini bank ilovasida tekshirib, keyin paneldan “To‘lov tasdiqlandi” ni bosing.',
      `${adminUrl}/#/orders/${row.id}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return payInfoOut(db.get<PayRow>(`SELECT ${PAY_COLS} FROM orders WHERE id = ?`, row.id)!);
}

/** Who may set which payment status (staff side). Undoing a confirmed payment is the owner's call. */
export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus, orderStatus: OrderStatus, role: AdminRole) {
  if (from === to) return;
  const ok =
    (to === 'paid' && (from === 'unpaid' || from === 'claimed') && orderStatus !== 'cancelled') ||
    (to === 'unpaid' && from === 'claimed') ||
    (to === 'unpaid' && from === 'paid' && role === 'owner') ||
    (to === 'refunded' && from === 'paid');
  if (!ok) {
    if (to === 'unpaid' && from === 'paid') throw forbidden('Tasdiqlangan to‘lovni faqat do‘kon egasi bekor qila oladi');
    if (to === 'paid' && orderStatus === 'cancelled') throw conflict('Bekor qilingan buyurtmani to‘langan deb belgilab bo‘lmaydi. Avval qayta oching.', 'order_cancelled');
    throw conflict('Bu to‘lov holatiga o‘tib bo‘lmaydi', 'payment_transition');
  }
}
