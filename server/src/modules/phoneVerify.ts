import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db.ts';
import { nowIso } from '../db.ts';
import { newToken, sha256 } from '../lib/crypto.ts';
import { conflict, HttpError } from '../lib/errors.ts';
import { SmsError, type SmsProvider } from '../lib/sms.ts';

/**
 * Phone ownership check for sign-up: a 6-digit SMS code, exchanged for a short-lived single-use
 * verification token that /api/auth/register must present.
 *
 * Abuse limits (per number; per-IP limits live in rateLimit.ts):
 *  - one SMS per 60 s, 5 per hour, 10 per day — caps SMS cost and bombing of a victim's phone;
 *  - a code lives 5 minutes and allows 5 guesses, so guessing succeeds with p ≤ 5/10⁶ per SMS;
 *  - only the latest code of a number is valid; codes and tokens are stored as hashes.
 */
export const CODE_TTL_SEC = 300;
export const RESEND_SEC = 60;
export const MAX_ATTEMPTS = 5;
const TOKEN_TTL_SEC = 900;
const PER_HOUR = 5;
const PER_DAY = 10;
const PURPOSE = 'register';

interface CodeRow {
  id: number;
  phone: string;
  code_hash: string;
  salt: string;
  attempts: number;
  created_at: string;
  expires_at: string;
}

const iso = (ms: number) => new Date(ms).toISOString();
const hashCode = (salt: string, phone: string, code: string) => sha256(`${salt}:${phone}:${code}`);

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

function limited(code: string, message: string, retryMs: number) {
  return new HttpError(429, code, message, { details: { retryInSec: Math.max(1, Math.ceil(retryMs / 1000)) } });
}

export function smsText(code: string) {
  return `MATOS: ro'yxatdan o'tish kodi ${code}. Kodni hech kimga bermang.`;
}

export async function startPhoneVerification(db: Db, sms: SmsProvider, phone: string, ip: string) {
  if (db.get('SELECT 1 FROM users WHERE phone = ?', phone)) {
    throw conflict('Bu raqam bilan profil allaqachon bor. Kirish bo‘limidan foydalaning.', 'phone_taken');
  }
  if (sms.name === 'none') throw new HttpError(503, 'sms_unavailable', 'SMS xizmati vaqtincha ishlamayapti. Birozdan keyin urinib ko‘ring.');

  const now = Date.now();
  const recent = db.all<{ created_at: string }>(
    'SELECT created_at FROM phone_codes WHERE phone = ? AND purpose = ? AND created_at > ? ORDER BY created_at DESC',
    phone,
    PURPOSE,
    iso(now - 86400_000),
  );
  const last = recent[0] ? Date.parse(recent[0].created_at) : 0;
  if (now - last < RESEND_SEC * 1000) throw limited('sms_cooldown', 'Kod yaqinda yuborildi. Biroz kuting.', last + RESEND_SEC * 1000 - now);
  const lastHour = recent.filter((r) => Date.parse(r.created_at) > now - 3600_000);
  if (lastHour.length >= PER_HOUR) {
    throw limited('sms_limit', 'Bu raqamga juda ko‘p kod so‘raldi. Keyinroq urinib ko‘ring.', Date.parse(lastHour[lastHour.length - 1].created_at) + 3600_000 - now);
  }
  if (recent.length >= PER_DAY) {
    throw limited('sms_limit', 'Bu raqamga juda ko‘p kod so‘raldi. Ertaga urinib ko‘ring.', Date.parse(recent[recent.length - 1].created_at) + 86400_000 - now);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = randomBytes(16).toString('hex');
  // Check-and-insert runs without an await in between, so parallel requests can't both pass the cooldown.
  const id = db.tx(() => {
    db.run('UPDATE phone_codes SET expires_at = ? WHERE phone = ? AND purpose = ? AND verified_at IS NULL AND expires_at > ?', iso(now), phone, PURPOSE, iso(now));
    return db.run(
      'INSERT INTO phone_codes (phone, purpose, code_hash, salt, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      phone,
      PURPOSE,
      hashCode(salt, phone, code),
      salt,
      iso(now),
      iso(now + CODE_TTL_SEC * 1000),
      ip.slice(0, 64),
    ).lastId;
  });

  try {
    await sms.send(phone, smsText(code));
  } catch (err) {
    // Not sent: don't count it against the cooldown, and let the visitor retry at once.
    db.run('DELETE FROM phone_codes WHERE id = ?', id);
    if (err instanceof SmsError) throw new HttpError(502, 'sms_failed', 'SMS yuborib bo‘lmadi. Raqamni tekshirib, qayta urinib ko‘ring.');
    throw err;
  }

  return { expiresInSec: CODE_TTL_SEC, resendInSec: RESEND_SEC, ...(sms.exposesCode ? { devCode: code } : {}) };
}

export function confirmPhoneCode(db: Db, phone: string, code: string) {
  const now = Date.now();
  const row = db.get<CodeRow>(
    'SELECT * FROM phone_codes WHERE phone = ? AND purpose = ? AND verified_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1',
    phone,
    PURPOSE,
    iso(now),
  );
  if (!row || row.attempts >= MAX_ATTEMPTS) throw new HttpError(400, 'code_expired', 'Kod eskirgan. Yangi kod so‘rang.');

  // Count the attempt before comparing, so a crash mid-check can't hand out free guesses.
  const attempts = row.attempts + 1;
  db.run('UPDATE phone_codes SET attempts = ? WHERE id = ?', attempts, row.id);
  if (!sameHash(hashCode(row.salt, phone, code), row.code_hash)) {
    const left = MAX_ATTEMPTS - attempts;
    if (left <= 0) {
      db.run('UPDATE phone_codes SET expires_at = ? WHERE id = ?', iso(now), row.id);
      throw new HttpError(400, 'code_expired', 'Urinishlar tugadi. Yangi kod so‘rang.');
    }
    throw new HttpError(400, 'code_invalid', 'Kod noto‘g‘ri', { details: { attemptsLeft: left } });
  }

  const token = newToken();
  db.run(
    'UPDATE phone_codes SET verified_at = ?, ticket_hash = ?, ticket_expires_at = ? WHERE id = ?',
    iso(now),
    sha256(token),
    iso(now + TOKEN_TTL_SEC * 1000),
    row.id,
  );
  return { verificationToken: token, expiresInSec: TOKEN_TTL_SEC };
}

/** Marks the token used. Call inside the transaction that creates the account, so a failed insert gives it back. */
export function consumeVerification(db: Db, phone: string, token: string) {
  const row = db.get<{ id: number; phone: string; ticket_expires_at: string; used_at: string | null }>(
    'SELECT id, phone, ticket_expires_at, used_at FROM phone_codes WHERE ticket_hash = ?',
    sha256(token),
  );
  if (!row || row.phone !== phone || row.used_at || row.ticket_expires_at <= nowIso()) {
    throw new HttpError(400, 'verification_invalid', 'Telefon raqami tasdiqlanmagan yoki tasdiq muddati o‘tgan. Kodni qayta oling.');
  }
  db.run('UPDATE phone_codes SET used_at = ? WHERE id = ?', nowIso(), row.id);
}

export function sweepPhoneCodes(db: Db) {
  db.run('DELETE FROM phone_codes WHERE created_at <= ?', iso(Date.now() - 2 * 86400_000));
}
