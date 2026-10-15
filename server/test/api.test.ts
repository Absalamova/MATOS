/**
 * End-to-end API tests against a real server on a random port with a throw-away database.
 *   npm test
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, type Running } from '../src/app.ts';

let app: Running;
let base = '';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matos-test-'));
const ADMIN = { email: 'owner@matos.test', password: 'owner-secret-123' };

before(async () => {
  app = await startServer(
    {
      env: 'test',
      port: 0,
      host: '127.0.0.1',
      dataDir,
      publicUrl: 'http://api.test',
      admin: { email: ADMIN.email, password: ADMIN.password, name: 'Owner' },
      corsOrigins: ['http://shop.test'],
      telegram: { token: '', chatId: '' },
      sms: { provider: 'dev', eskiz: { email: '', password: '', from: '', baseUrl: '' } },
    },
    { quiet: true },
  );
  base = app.url;
});

after(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

async function call<T = any>(method: string, url: string, opts: { body?: unknown; token?: string; headers?: Record<string, string>; raw?: Buffer } = {}): Promise<Res<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: RequestInit['body'];
  if (opts.raw) {
    body = new Uint8Array(opts.raw);
    headers['Content-Type'] ??= 'application/octet-stream';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const r = await fetch(base + url, { method, headers, body });
  const text = await r.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* csv or plain text */
  }
  return { status: r.status, body: parsed as T, headers: r.headers };
}

let adminToken = '';
let userToken = '';
const PHONE = '+998 90 111 22 33';

/** Runs the SMS step with the dev provider, which returns the code instead of texting it. */
async function verifiedToken(phone: string): Promise<string> {
  const s = await call('POST', '/api/auth/phone/start', { body: { phone } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const v = await call('POST', '/api/auth/phone/verify', { body: { phone, code: s.body.devCode } });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body.verificationToken;
}

describe('public catalog', () => {
  it('reports health', async () => {
    const r = await call('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  });

  it('serves the seeded catalog with settings and an ETag', async () => {
    const r = await call('GET', '/api/catalog');
    assert.equal(r.status, 200);
    assert.equal(r.body.fabrics.length, 9);
    assert.ok(r.body.settings.rates.USD > 0);
    const f = r.body.fabrics.find((x: any) => x.id === 'organic-linen');
    assert.equal(f.colors[0].stockM, 120);
    assert.equal(f.priceUSD, Math.round((f.priceUZS / r.body.settings.rates.USD) * 100) / 100);
    const etag = r.headers.get('etag')!;
    const again = await call('GET', '/api/catalog', { headers: { 'If-None-Match': etag } });
    assert.equal(again.status, 304);
  });

  it('lists approved tailors only', async () => {
    const r = await call('GET', '/api/tailors');
    assert.equal(r.status, 200);
    assert.equal(r.body.tailors.length, 6);
  });

  it('answers CORS preflight for allowed origins only', async () => {
    const ok = await fetch(base + '/api/orders', { method: 'OPTIONS', headers: { Origin: 'http://shop.test', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://shop.test');
    const bad = await fetch(base + '/api/orders', { method: 'OPTIONS', headers: { Origin: 'http://evil.test' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const r = await call('GET', '/api/nope');
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'not_found');
  });
});

describe('shopper accounts', () => {
  it('validates registration with field messages', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'A', phone: '123', password: '1' } });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fields.name);
    assert.ok(r.body.error.fields.phone);
    assert.ok(r.body.error.fields.password);
  });

  it('refuses to register a number that was not confirmed by SMS', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'Malika Saidova', phone: PHONE, password: 'secret12' } });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fields.verificationToken);
    const forged = await call('POST', '/api/auth/register', { body: { name: 'Malika Saidova', phone: PHONE, password: 'secret12', verificationToken: 'x'.repeat(43) } });
    assert.equal(forged.status, 400);
    assert.equal(forged.body.error.code, 'verification_invalid');
  });

  it('limits code guesses and resends', async () => {
    const phone = '+998 93 555 00 11';
    const s = await call('POST', '/api/auth/phone/start', { body: { phone } });
    assert.equal(s.status, 200);
    assert.match(s.body.devCode, /^\d{6}$/);
    assert.equal(s.body.resendInSec, 60);

    const again = await call('POST', '/api/auth/phone/start', { body: { phone } });
    assert.equal(again.status, 429);
    assert.equal(again.body.error.code, 'sms_cooldown');
    assert.ok(again.body.error.details.retryInSec > 0);

    const wrongCode = s.body.devCode === '000000' ? '111111' : '000000';
    for (let i = 4; i >= 1; i--) {
      const w = await call('POST', '/api/auth/phone/verify', { body: { phone, code: wrongCode } });
      assert.equal(w.body.error.code, 'code_invalid');
      assert.equal(w.body.error.details.attemptsLeft, i);
    }
    const last = await call('POST', '/api/auth/phone/verify', { body: { phone, code: wrongCode } });
    assert.equal(last.body.error.code, 'code_expired');
    // The right code no longer works once the attempts are spent.
    const late = await call('POST', '/api/auth/phone/verify', { body: { phone, code: s.body.devCode } });
    assert.equal(late.body.error.code, 'code_expired');
  });

  it('binds the verification token to one number and one use', async () => {
    const phone = '+998 94 777 88 99';
    const token = await verifiedToken(phone);
    const other = await call('POST', '/api/auth/register', { body: { name: 'Boshqa Odam', phone: '+998 94 777 88 98', password: 'secret12', verificationToken: token } });
    assert.equal(other.body.error.code, 'verification_invalid');
    const ok = await call('POST', '/api/auth/register', { body: { name: 'Aziz Karimov', phone, password: 'secret12', verificationToken: token } });
    assert.equal(ok.status, 201);
    const taken = await call('POST', '/api/auth/phone/start', { body: { phone } });
    assert.equal(taken.status, 409);
    assert.equal(taken.body.error.code, 'phone_taken');
  });

  it('registers, rejects a duplicate phone and logs in', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'Malika Saidova', phone: PHONE, password: 'secret12', verificationToken: await verifiedToken(PHONE) } });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.phone, '998901112233');
    userToken = r.body.token;

    const dup = await call('POST', '/api/auth/register', { body: { name: 'Someone', phone: '901112233', password: 'secret12', verificationToken: 'y'.repeat(43) } });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'phone_taken');

    const wrong = await call('POST', '/api/auth/login', { body: { phone: PHONE, password: 'nope-nope' } });
    assert.equal(wrong.status, 401);

    const ok = await call('POST', '/api/auth/login', { body: { phone: '998901112233', password: 'secret12' } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
  });

  it('reads and updates the profile', async () => {
    const me = await call('GET', '/api/me', { token: userToken });
    assert.equal(me.body.user.name, 'Malika Saidova');
    const upd = await call('PATCH', '/api/me', { token: userToken, body: { measurements: { heightCm: 170, bustCm: 90, waistCm: 70, hipsCm: 96 } } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.user.measurements.heightCm, 170);
    const anon = await call('GET', '/api/me');
    assert.equal(anon.status, 401);
  });
});

describe('checkout', () => {
  let orderId = 0;

  it('places a fabric order and a sample request, priced on the server', async () => {
    const r = await call('POST', '/api/orders', {
      token: userToken,
      headers: { 'Idempotency-Key': 'test-key-0001' },
      body: {
        customer: { name: 'Malika Saidova', phone: PHONE },
        delivery: { method: 'courier', city: 'Toshkent', address: 'Chilonzor 9, 12-uy' },
        payment: 'cash',
        items: [
          { fabricId: 'organic-linen', colorId: 'ol-blush', meters: 2.5, garmentKey: 'slip_dress' },
          { fabricId: 'organic-linen', colorId: 'ol-blush', meters: 0.5 },
        ],
        samples: [{ fabricId: 'silk-crepe', colorId: 'sc-ruby' }],
      },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.orders.length, 2);
    const fabric = r.body.orders.find((o: any) => o.kind === 'fabric');
    assert.match(fabric.number, /^MT-\d+$/);
    // 3 m × 142 000 + 25 000 delivery (under the free threshold)
    assert.equal(fabric.totalUZS, 3 * 142000 + 25000);

    const retry = await call('POST', '/api/orders', {
      token: userToken,
      headers: { 'Idempotency-Key': 'test-key-0001' },
      body: { customer: { name: 'X Y', phone: PHONE }, delivery: { method: 'pickup' }, items: [{ fabricId: 'organic-linen', colorId: 'ol-blush', meters: 9 }], samples: [] },
    });
    assert.deepEqual(retry.body, r.body, 'same key returns the first result');

    const cat = await call('GET', '/api/catalog');
    const color = cat.body.fabrics.find((x: any) => x.id === 'organic-linen').colors.find((c: any) => c.id === 'ol-blush');
    assert.equal(color.stockM, 117);
  });

  it('refuses more than is in stock', async () => {
    const r = await call('POST', '/api/orders', {
      body: { customer: { name: 'Guest User', phone: '+998 93 000 00 01' }, delivery: { method: 'pickup' }, items: [{ fabricId: 'heavy-linen', colorId: 'hl-fog', meters: 100 }], samples: [] },
    });
    assert.equal(r.status, 201, 'first 100 m of 120 m are fine');
    const r2 = await call('POST', '/api/orders', {
      body: { customer: { name: 'Guest User', phone: '+998 93 000 00 01' }, delivery: { method: 'pickup' }, items: [{ fabricId: 'heavy-linen', colorId: 'hl-fog', meters: 50 }], samples: [] },
    });
    assert.equal(r2.status, 409);
    assert.equal(r2.body.error.code, 'out_of_stock');
    assert.equal(r2.body.error.details.availableM, 20);
  });

  it('rejects unknown products and empty bags', async () => {
    const r = await call('POST', '/api/orders', {
      body: { customer: { name: 'Guest User', phone: '+998 93 000 00 01' }, delivery: { method: 'pickup' }, items: [{ fabricId: 'nope', colorId: 'x', meters: 1 }], samples: [] },
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'unavailable');
    const empty = await call('POST', '/api/orders', { body: { customer: { name: 'Guest User', phone: '+998 93 000 00 01' }, delivery: { method: 'pickup' }, items: [], samples: [] } });
    assert.equal(empty.status, 422);
    const noAddress = await call('POST', '/api/orders', {
      body: { customer: { name: 'Guest User', phone: '+998 93 000 00 01' }, delivery: { method: 'courier' }, items: [{ fabricId: 'organic-linen', colorId: 'ol-white', meters: 1 }] },
    });
    assert.equal(noAddress.status, 422);
    assert.ok(noAddress.body.error.fields['delivery.address']);
  });

  it('shows the orders in the shopper’s history', async () => {
    const r = await call('GET', '/api/me/orders', { token: userToken });
    assert.equal(r.status, 200);
    assert.equal(r.body.orders.length, 2);
    const fabric = r.body.orders.find((o: any) => o.kind === 'fabric');
    orderId = fabric.id;
    assert.equal(fabric.items[0].meters, 3);
    assert.equal(fabric.items[0].fabricName.uz, 'Organik zig‘ir');
  });

  it('lets the admin see, move and cancel the order (stock comes back)', async () => {
    const login = await call('POST', '/api/admin/auth/login', { body: ADMIN });
    assert.equal(login.status, 200);
    adminToken = login.body.token;

    const unauth = await call('GET', '/api/admin/orders');
    assert.equal(unauth.status, 401);

    const list = await call('GET', '/api/admin/orders?kind=fabric&q=Malika', { token: adminToken });
    assert.equal(list.body.total, 1);
    const samples = await call('GET', '/api/admin/orders?kind=sample', { token: adminToken });
    assert.equal(samples.body.total, 1);

    const bad = await call('PATCH', `/api/admin/orders/${orderId}`, { token: adminToken, body: { status: 'packed' } });
    assert.equal(bad.status, 422, 'packed is a sample-only status');

    const ok = await call('PATCH', `/api/admin/orders/${orderId}`, { token: adminToken, body: { status: 'confirmed', adminNote: 'Qo‘ng‘iroq qilindi' } });
    assert.equal(ok.body.order.status, 'confirmed');
    assert.equal(ok.body.order.adminNote, 'Qo‘ng‘iroq qilindi');
    assert.equal(ok.body.order.events.length, 2);

    await call('PATCH', `/api/admin/orders/${orderId}`, { token: adminToken, body: { status: 'cancelled' } });
    const cat = await call('GET', '/api/catalog');
    const color = cat.body.fabrics.find((x: any) => x.id === 'organic-linen').colors.find((c: any) => c.id === 'ol-blush');
    assert.equal(color.stockM, 120);

    const stats = await call('GET', '/api/admin/stats', { token: adminToken });
    assert.equal(stats.status, 200);
    assert.equal(stats.body.counts.newSamples, 1);
    assert.equal(stats.body.ordersByDay.length, 30);

    const csv = await call('GET', '/api/admin/orders/export?kind=fabric', { token: adminToken });
    assert.equal(csv.status, 200);
    assert.match(String(csv.body), /Malika Saidova/);
  });
});

describe('admin catalog', () => {
  let newId = '';
  const fabric = {
    name: { uz: 'Atlas ipak', ru: 'Атлас', en: '' },
    category: 'silk',
    pattern: 'ikat',
    organic: false,
    origin: { uz: 'Marg‘ilon', ru: '', en: '' },
    seller: { name: 'Yodgorlik fabrikasi', city: { uz: 'Marg‘ilon', ru: '', en: '' } },
    gsm: 120,
    widthCm: 50,
    composition: { uz: '100% ipak', ru: '', en: '' },
    priceUZS: 210000,
    drapeFactor: 8.8,
    description: { uz: 'Qo‘lda to‘qilgan atlas.', ru: '', en: '' },
    bestFor: ['kimono'],
    colors: [{ name: { uz: 'Qizil', ru: '', en: '' }, hex: '#b22222', stockM: 40 }],
  };

  it('creates a fabric that shows up in the public catalog', async () => {
    const r = await call('POST', '/api/admin/fabrics', { token: adminToken, body: fabric });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    newId = r.body.fabric.id;
    assert.equal(newId, 'atlas-ipak');
    assert.equal(r.body.fabric.colors[0].hex, '#B22222');
    const cat = await call('GET', '/api/catalog');
    const f = cat.body.fabrics.find((x: any) => x.id === newId);
    assert.ok(f);
    assert.equal(f.name.en, 'Atlas ipak', 'missing translations fall back to Uzbek');
    assert.equal(f.weightCategory, 'mid');
  });

  it('validates the form', async () => {
    const r = await call('POST', '/api/admin/fabrics', { token: adminToken, body: { ...fabric, priceUZS: -5, colors: [] } });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.fields.priceUZS);
    assert.ok(r.body.error.fields.colors);
  });

  it('hides and archives fabrics', async () => {
    const got = await call('GET', `/api/admin/fabrics/${newId}`, { token: adminToken });
    const hidden = await call('PUT', `/api/admin/fabrics/${newId}`, { token: adminToken, body: { ...got.body.fabric, status: 'hidden' } });
    assert.equal(hidden.status, 200);
    let cat = await call('GET', '/api/catalog');
    assert.equal(cat.body.fabrics.some((x: any) => x.id === newId), false);
    const del = await call('DELETE', `/api/admin/fabrics/${newId}`, { token: adminToken });
    assert.equal(del.status, 204);
    const list = await call('GET', '/api/admin/fabrics', { token: adminToken });
    assert.equal(list.body.fabrics.some((x: any) => x.id === newId), false);
    cat = await call('GET', '/api/catalog');
    assert.equal(cat.body.fabrics.length, 9);
  });

  it('accepts image uploads and serves them cross-origin', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
    const up = await call('POST', '/api/admin/uploads', { token: adminToken, raw: png, headers: { 'Content-Type': 'image/png' } });
    assert.equal(up.status, 201);
    assert.match(up.body.url, /^http:\/\/api\.test\/uploads\/[a-f0-9]{32}\.png$/);
    const file = await fetch(base + new URL(up.body.url).pathname);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('access-control-allow-origin'), '*');
    const notImage = await call('POST', '/api/admin/uploads', { token: adminToken, raw: Buffer.from('hello world'), headers: { 'Content-Type': 'image/png' } });
    assert.equal(notImage.status, 415);
  });

  it('updates store settings', async () => {
    const s = await call('GET', '/api/admin/settings', { token: adminToken });
    const r = await call('PUT', '/api/admin/settings', { token: adminToken, body: { ...s.body.settings, deliveryFeeUZS: 30000 } });
    assert.equal(r.body.settings.deliveryFeeUZS, 30000);
    const cat = await call('GET', '/api/catalog');
    assert.equal(cat.body.settings.deliveryFeeUZS, 30000);
  });
});

describe('tailors', () => {
  let tailorId = '';

  it('takes an application that waits for approval', async () => {
    const r = await call('POST', '/api/tailors/apply', {
      body: { name: 'Nodira Aliyeva', atelierName: 'Nafis atelye', city: 'Namangan', specialtyKey: 'linen', experienceYears: 7, priceStartingUZS: 250000, phone: '+998 94 123 45 67', telegram: 'nafis_atelye' },
    });
    assert.equal(r.status, 201);
    tailorId = r.body.id;
    const pub = await call('GET', '/api/tailors');
    assert.equal(pub.body.tailors.some((t: any) => t.id === tailorId), false);
    const pending = await call('GET', '/api/admin/tailors?status=pending', { token: adminToken });
    assert.equal(pending.body.tailors.length, 1);
    await call('PATCH', `/api/admin/tailors/${tailorId}`, { token: adminToken, body: { status: 'approved' } });
    const after = await call('GET', '/api/tailors');
    const t = after.body.tailors.find((x: any) => x.id === tailorId);
    assert.ok(t);
    assert.equal(t.telegram, '@nafis_atelye');
    assert.equal(t.rating, null);
  });

  it('records a tailoring request with measurements', async () => {
    const r = await call('POST', '/api/tailor-requests', {
      token: userToken,
      body: {
        tailorId,
        garmentKey: 'shirt',
        fabricId: 'organic-linen',
        colorId: 'ol-white',
        customer: { name: 'Malika Saidova', phone: PHONE },
        measurements: { heightCm: 170, bustCm: 90, waistCm: 70, hipsCm: 96 },
        note: 'Yozga',
      },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.request.number, /^TK-\d+$/);
    assert.equal(r.body.request.fabricLabel, 'Organik zig‘ir, Oq');
    const mine = await call('GET', '/api/me/orders', { token: userToken });
    assert.equal(mine.body.tailorRequests.length, 1);
    const adminList = await call('GET', '/api/admin/tailor-requests?status=new', { token: adminToken });
    assert.equal(adminList.body.total, 1);
    const upd = await call('PATCH', `/api/admin/tailor-requests/${adminList.body.items[0].id}`, { token: adminToken, body: { status: 'contacted' } });
    assert.equal(upd.body.request.status, 'contacted');
  });
});

describe('customers & staff', () => {
  it('lists customers with order totals and can block them', async () => {
    const list = await call('GET', '/api/admin/customers?q=Malika', { token: adminToken });
    assert.equal(list.body.total, 1);
    const c = list.body.items[0];
    assert.equal(c.ordersCount, 2);
    const detail = await call('GET', `/api/admin/customers/${c.id}`, { token: adminToken });
    assert.equal(detail.body.orders.length, 2);
    await call('PATCH', `/api/admin/customers/${c.id}`, { token: adminToken, body: { status: 'blocked' } });
    const me = await call('GET', '/api/me', { token: userToken });
    assert.equal(me.status, 401, 'blocking ends the shopper’s sessions');
    const login = await call('POST', '/api/auth/login', { body: { phone: PHONE, password: 'secret12' } });
    assert.equal(login.status, 403);
  });

  it('lets the owner add a manager who cannot manage staff', async () => {
    const add = await call('POST', '/api/admin/staff', { token: adminToken, body: { email: 'manager@matos.test', name: 'Menejer', password: 'manager-pass-1' } });
    assert.equal(add.status, 201);
    const login = await call('POST', '/api/admin/auth/login', { body: { email: 'manager@matos.test', password: 'manager-pass-1' } });
    const staff = await call('GET', '/api/admin/staff', { token: login.body.token });
    assert.equal(staff.status, 403);
    const orders = await call('GET', '/api/admin/orders', { token: login.body.token });
    assert.equal(orders.status, 200);
    const out = await call('POST', '/api/admin/auth/logout', { token: login.body.token });
    assert.equal(out.status, 204);
    const after = await call('GET', '/api/admin/me', { token: login.body.token });
    assert.equal(after.status, 401);
  });
});

describe('QR card payments', () => {
  const CARD = '8600 1234 5678 9012';
  const guest = { name: 'QR Mijoz', phone: '+998 97 555 44 33' };
  const qrOrder = (meters = 1) => ({
    customer: guest,
    delivery: { method: 'pickup' },
    payment: 'qr',
    items: [{ fabricId: 'organic-linen', colorId: 'ol-white', meters }],
    samples: [],
  });
  let managerToken = '';

  it('is off until the owner sets a card, and then refuses orders cleanly', async () => {
    const cat = await call('GET', '/api/catalog');
    assert.equal(cat.body.settings.qrPayment, false);
    const r = await call('POST', '/api/orders', { body: qrOrder() });
    assert.equal(r.status, 422);
    assert.equal(r.body.error.code, 'payment_unavailable');
  });

  it('lets only the owner change the card, with the password and a valid number', async () => {
    const login = await call('POST', '/api/admin/auth/login', { body: { email: 'manager@matos.test', password: 'manager-pass-1' } });
    managerToken = login.body.token;
    const body = { enabled: true, cardNumber: CARD, cardHolder: 'MATOS OWNER', bankName: 'Kapitalbank', payLink: '', holdHours: 24 };
    const byManager = await call('PUT', '/api/admin/payment', { token: managerToken, body: { ...body, password: 'manager-pass-1' } });
    assert.equal(byManager.status, 403);
    const noPassword = await call('PUT', '/api/admin/payment', { token: adminToken, body: { ...body, password: 'wrong-password' } });
    assert.equal(noPassword.status, 400);
    const typo = await call('PUT', '/api/admin/payment', { token: adminToken, body: { ...body, cardNumber: '8600 1234 5678 9013', password: ADMIN.password } });
    assert.equal(typo.status, 422);
    assert.ok(typo.body.error.fields.cardNumber);
    const phishing = await call('PUT', '/api/admin/payment', { token: adminToken, body: { ...body, payLink: 'https://payme.uz.evil.example/pay', password: ADMIN.password } });
    assert.equal(phishing.status, 422);
    assert.ok(phishing.body.error.fields.payLink);
    const ok = await call('PUT', '/api/admin/payment', { token: adminToken, body: { ...body, payLink: 'https://payme.uz/fallback/test', password: ADMIN.password } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.receiver.cardNumber, '8600123456789012');
    const seenByManager = await call('GET', '/api/admin/payment', { token: managerToken });
    assert.equal(seenByManager.body.receiver.cardNumber, '8600 •••• •••• 9012');
    const cat = await call('GET', '/api/catalog');
    assert.equal(cat.body.settings.qrPayment, true);
    assert.ok(!JSON.stringify(cat.body).includes('8600123456789012'), 'card number must not be in the public catalog');
  });

  let number = '';
  let token = '';
  let orderId = 0;

  it('gives a QR order a one-time pay token and a server-side amount', async () => {
    const r = await call('POST', '/api/orders', { body: { ...qrOrder(2), totalUZS: 1 } });
    assert.equal(r.status, 201);
    const o = r.body.orders[0];
    assert.equal(o.kind, 'fabric');
    assert.ok(typeof o.payToken === 'string' && o.payToken.length >= 40);
    number = o.number;
    token = o.payToken;
    const pay = await call('POST', '/api/pay/lookup', { body: { number, token } });
    assert.equal(pay.status, 200);
    assert.equal(pay.headers.get('cache-control'), 'no-store');
    assert.equal(pay.body.pay.totalUZS, o.totalUZS);
    assert.equal(pay.body.pay.cardNumber, '8600123456789012');
    assert.equal(pay.body.pay.paymentStatus, 'unpaid');
    assert.ok(pay.body.pay.payDeadline);
    assert.ok(!('customerName' in pay.body.pay) && !JSON.stringify(pay.body).includes(guest.name), 'no personal data on the pay page');
  });

  it('answers the same 404 for a wrong token and an unknown order', async () => {
    const wrong = await call('POST', '/api/pay/lookup', { body: { number, token: token.slice(0, -2) + 'xx' } });
    const missing = await call('POST', '/api/pay/lookup', { body: { number: 'MT-999999', token } });
    const none = await call('POST', '/api/pay/lookup', { body: { number } });
    for (const r of [wrong, missing, none]) {
      assert.equal(r.status, 404);
      assert.equal(r.body.error.code, 'pay_not_found');
    }
  });

  it('records “I paid” without marking the order paid', async () => {
    const r = await call('POST', '/api/pay/claim', { body: { number, token, payerCardLast4: '4321' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.pay.paymentStatus, 'claimed');
    const again = await call('POST', '/api/pay/claim', { body: { number, token } });
    assert.equal(again.body.pay.paymentStatus, 'claimed');
    const list = await call('GET', `/api/admin/orders?q=${number}`, { token: adminToken });
    orderId = list.body.items[0].id;
    const o = await call('GET', `/api/admin/orders/${orderId}`, { token: adminToken });
    assert.equal(o.body.order.paymentStatus, 'claimed');
    assert.equal(o.body.order.qr.payerCardLast4, '4321');
    assert.equal(o.body.order.qr.payTo, '8600 •••• •••• 9012');
  });

  it('will not ship an unpaid QR order; staff confirm the money first', async () => {
    const ship = await call('PATCH', `/api/admin/orders/${orderId}`, { token: managerToken, body: { status: 'shipped' } });
    assert.equal(ship.status, 409);
    assert.equal(ship.body.error.code, 'unpaid');
    const paid = await call('PATCH', `/api/admin/orders/${orderId}`, { token: managerToken, body: { paymentStatus: 'paid' } });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.order.paymentStatus, 'paid');
    assert.equal(paid.body.order.qr.paidBy, 'Menejer');
    const undoByManager = await call('PATCH', `/api/admin/orders/${orderId}`, { token: managerToken, body: { paymentStatus: 'unpaid' } });
    assert.equal(undoByManager.status, 403);
    const shipNow = await call('PATCH', `/api/admin/orders/${orderId}`, { token: managerToken, body: { status: 'shipped' } });
    assert.equal(shipNow.status, 200);
    const pay = await call('POST', '/api/pay/lookup', { body: { number, token } });
    assert.equal(pay.body.pay.paymentStatus, 'paid');
    assert.equal(pay.body.pay.cardNumber, '', 'nothing left to pay, so the card is no longer shown');
  });

  it('keeps the card a waiting order was given, even if the owner changes it', async () => {
    const r = await call('POST', '/api/orders', { body: qrOrder(1) });
    const o = r.body.orders[0];
    const NEW_CARD = '8600123456789012'.slice(0, 15);
    const other = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => `9860${NEW_CARD.slice(4)}${d}`).find((c) => {
      let sum = 0;
      for (let i = 0; i < c.length; i++) {
        let d = Number(c[c.length - 1 - i]);
        if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
        sum += d;
      }
      return sum % 10 === 0;
    })!;
    const change = await call('PUT', '/api/admin/payment', {
      token: adminToken,
      body: { enabled: true, cardNumber: other, cardHolder: 'MATOS OWNER', bankName: '', payLink: '', holdHours: 24, password: ADMIN.password },
    });
    assert.equal(change.status, 200);
    const pay = await call('POST', '/api/pay/lookup', { body: { number: o.number, token: o.payToken } });
    assert.equal(pay.body.pay.cardNumber, '8600123456789012');
  });

  it('cancels unpaid QR orders after the deadline and puts the metres back', async () => {
    const before = await call('GET', '/api/catalog');
    const stock = (b: any) => b.fabrics.find((f: any) => f.id === 'organic-linen').colors.find((c: any) => c.id === 'ol-white').stockM;
    const r = await call('POST', '/api/orders', { body: qrOrder(1.5) });
    const o = r.body.orders[0];
    const mid = await call('GET', '/api/catalog');
    assert.equal(Math.round((stock(before.body) - stock(mid.body)) * 10) / 10, 1.5);
    const { expireUnpaidQrOrders } = await import('../src/modules/orders.ts');
    const n = expireUnpaidQrOrders(app.db, 'http://api.test', new Date(Date.now() + 25 * 3600_000));
    assert.ok(n >= 1);
    const after = await call('GET', '/api/catalog');
    // At least these 1.5 m came back (older unpaid test orders expire in the same sweep).
    assert.ok(stock(after.body) - stock(mid.body) >= 1.5 - 1e-9);
    const pay = await call('POST', '/api/pay/lookup', { body: { number: o.number, token: o.payToken } });
    assert.equal(pay.body.pay.status, 'cancelled');
    const late = await call('POST', '/api/pay/claim', { body: { number: o.number, token: o.payToken } });
    assert.equal(late.status, 409);
  });

  it('lets a signed-in shopper reopen their own payment page without the token', async () => {
    const reg = await call('POST', '/api/auth/register', { body: { name: 'QR Shopper', phone: '+998 99 765 43 21', password: 'secret-qr-1', verificationToken: await verifiedToken('+998 99 765 43 21') } });
    const shopper = reg.body.token;
    const r = await call('POST', '/api/orders', { token: shopper, body: { ...qrOrder(1), customer: { name: 'QR Shopper', phone: '+998 99 765 43 21' } } });
    const o = r.body.orders[0];
    const mine = await call('POST', '/api/pay/lookup', { token: shopper, body: { number: o.number } });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.pay.number, o.number);
    const history = await call('GET', '/api/me/orders', { token: shopper });
    assert.equal(history.body.orders.find((x: any) => x.number === o.number).paymentStatus, 'unpaid');
    const notMine = await call('POST', '/api/pay/lookup', { token: shopper, body: { number } });
    assert.equal(notMine.status, 404);
  });
});
