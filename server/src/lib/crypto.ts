import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Spends the same time as a real check so missing accounts can't be told apart by timing. */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword('matos-timing-equaliser');
  await verifyPassword(password, await dummyHash);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomHex = (bytes: number) => randomBytes(bytes).toString('hex');
export const shortHash = (s: string) => createHash('sha1').update(s).digest('base64url').slice(0, 16);
