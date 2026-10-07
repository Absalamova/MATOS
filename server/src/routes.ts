import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { Reply, Router, type Ctx } from './http.ts';
import { parse, v } from './lib/validate.ts';
import { badRequest, conflict, forbidden, notFound } from './lib/errors.ts';
import { shortHash } from './lib/crypto.ts';
import type { Notifier } from './lib/telegram.ts';
import type { CatalogResponse, OrderKind, OrderStatus, TailorRequestStatus, TailorStatus } from '../../shared/types.ts';
import { orderStatusesFor, TAILOR_REQUEST_STATUSES } from '../../shared/status.ts';
import * as auth from './modules/auth.ts';
import * as catalog from './modules/catalog.ts';
import * as orders from './modules/orders.ts';
import * as tailors from './modules/tailors.ts';
import * as reports from './modules/reports.ts';
import { getSettings, saveSettings, settingsSchema } from './modules/settings.ts';
import { catalogRevision } from './modules/revision.ts';
import { MAX_UPLOAD_BYTES, saveUpload } from './modules/uploads.ts';

export interface Deps {
  db: Db;
  config: Config;
  notifier: Notifier;
  startedAt: number;
}

const measurementsSchema = v.object({
  heightCm: v.number({ min: 120, max: 220 }),
  bustCm: v.number({ min: 60, max: 160 }),
  waistCm: v.number({ min: 45, max: 150 }),
  hipsCm: v.number({ min: 60, max: 170 }),
});
const password = v.string({ min: 6, max: 200, trim: false });

function paging(ctx: Ctx, max = 100) {
  const page = Math.max(1, Math.floor(Number(ctx.query.get('page')) || 1));
  const pageSize = Math.min(max, Math.max(1, Math.floor(Number(ctx.query.get('pageSize')) || 20)));
  return { page, pageSize };
}

const idParam = (ctx: Ctx) => {
  const n = Number(ctx.params.id);
  if (!Number.isInteger(n) || n <= 0) throw notFound();
  return n;
};

export function buildRouter({ db, config, notifier, startedAt }: Deps) {
  const r = new Router();
  const userTtl = config.sessionDaysUser * 86400000;
  const adminTtl = config.sessionHoursAdmin * 3600000;
  const pub = config.publicUrl;
  const admin = (ctx: Ctx) => auth.requireAdmin(db, ctx);

  /* ───────────── Public ───────────── */

  r.get('/api/health', () => ({ ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000), version: 1 }));

  let cache: { rev: number; body: CatalogResponse; etag: string } | null = null;
  r.get('/api/catalog', (ctx) => {
    if (!cache || cache.rev !== catalogRevision()) {
      const settings = getSettings(db);
      const body: CatalogResponse = { fabrics: catalog.listPublicFabrics(db, settings, pub), settings, updatedAt: new Date().toISOString() };
      cache = { rev: catalogRevision(), body, etag: `"${shortHash(JSON.stringify({ ...body, updatedAt: '' }))}"` };
    }
    const headers = { ETag: cache.etag, 'Cache-Control': 'no-cache' };
    if (ctx.header('if-none-match') === cache.etag) return new Reply(304, undefined, headers);
    return new Reply(200, cache.body, headers);
  });

  r.get('/api/tailors', () => ({ tailors: tailors.listPublicTailors(db) }));

  r.post('/api/tailors/apply', (ctx) => new Reply(201, tailors.applyTailor(db, parse(tailors.applicationSchema, ctx.body), notifier, config.adminUrl)));

  r.post('/api/tailor-requests', (ctx) => {
    const user = auth.currentUser(db, ctx, userTtl);
    return new Reply(201, { request: tailors.createTailorRequest(db, parse(tailors.requestSchema, ctx.body), user?.id ?? null, notifier, config.adminUrl) });
  });

  r.post('/api/orders', (ctx) => {
    const user = auth.currentUser(db, ctx, userTtl);
    const input = parse(orders.checkoutSchema, ctx.body);
    const key = ctx.header('idempotency-key').trim();
    if (key && !/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw badRequest('Idempotency-Key noto‘g‘ri');
    const result = orders.checkout({ db, settings: getSettings(db), notifier, adminUrl: config.adminUrl }, input, user?.id ?? null, key || null);
    return new Reply(201, result);
  });

  /* ───────────── Shopper account ───────────── */

  r.post('/api/auth/register', async (ctx) => {
    const input = parse(v.object({ name: v.string({ min: 2, max: 80 }), phone: v.phone(), password, measurements: measurementsSchema.optional() }), ctx.body);
    const user = await auth.registerUser(db, input);
    return new Reply(201, { token: auth.createSession(db, 'user', user.id, userTtl, ctx), user });
  });

  r.post('/api/auth/login', async (ctx) => {
    const input = parse(v.object({ phone: v.phone(), password: v.string({ max: 200, trim: false }) }), ctx.body);
    const user = await auth.loginUser(db, input.phone, input.password);
    return { token: auth.createSession(db, 'user', user.id, userTtl, ctx), user };
  });

  r.post('/api/auth/logout', (ctx) => {
    auth.revokeSession(db, auth.bearer(ctx));
    return undefined;
  });

  r.get('/api/me', (ctx) => ({ user: auth.requireUser(db, ctx, userTtl) }));

  r.patch('/api/me', (ctx) => {
    const user = auth.requireUser(db, ctx, userTtl);
    const input = parse(
      v.object({ name: v.string({ min: 2, max: 80 }).optional(), email: v.email().nullable(), measurements: measurementsSchema.optional() }),
      ctx.body ?? {},
    );
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    return { user: auth.updateUser(db, user.id, { name: input.name, email: 'email' in body ? input.email : undefined, measurements: input.measurements }) };
  });

  r.post('/api/me/password', async (ctx) => {
    const user = auth.requireUser(db, ctx, userTtl);
    const input = parse(v.object({ currentPassword: v.string({ max: 200, trim: false }), newPassword: password }), ctx.body);
    await auth.changeUserPassword(db, user.id, input.currentPassword, input.newPassword);
    return undefined;
  });

  r.get('/api/me/orders', (ctx) => {
    const user = auth.requireUser(db, ctx, userTtl);
    return { orders: orders.ordersForUser(db, user.id, pub), tailorRequests: tailors.requestsForUser(db, user.id) };
  });

  /* ───────────── Admin: session ───────────── */

  r.post('/api/admin/auth/login', async (ctx) => {
    const input = parse(v.object({ email: v.email(), password: v.string({ max: 200, trim: false }) }), ctx.body);
    const a = await auth.loginAdmin(db, input.email, input.password);
    return { token: auth.createSession(db, 'admin', a.id, adminTtl, ctx), admin: a };
  });

  r.post('/api/admin/auth/logout', (ctx) => {
    auth.revokeSession(db, auth.bearer(ctx));
    return undefined;
  });

  r.get('/api/admin/me', (ctx) => ({ admin: admin(ctx) }));

  r.post('/api/admin/me/password', async (ctx) => {
    const a = admin(ctx);
    const input = parse(v.object({ currentPassword: v.string({ max: 200, trim: false }), newPassword: v.string({ min: 8, max: 200, trim: false }) }), ctx.body);
    await auth.changeAdminPassword(db, a.id, input.currentPassword, input.newPassword);
    return undefined;
  });

  /* ───────────── Admin: dashboard ───────────── */

  r.get('/api/admin/stats', (ctx) => {
    admin(ctx);
    return reports.stats(db, { tzOffsetMin: config.tzOffsetMin, lowStockM: config.lowStockM, publicUrl: pub });
  });

  /* ───────────── Admin: orders & samples ───────────── */

  const orderFilter = (ctx: Ctx) => {
    const kind = ctx.query.get('kind') as OrderKind | null;
    const status = ctx.query.get('status') as OrderStatus | null;
    return {
      kind: kind === 'fabric' || kind === 'sample' ? kind : undefined,
      status: status && orderStatusesFor('fabric').concat(orderStatusesFor('sample')).includes(status) ? status : undefined,
      q: ctx.query.get('q') ?? undefined,
    };
  };

  r.get('/api/admin/orders', (ctx) => {
    admin(ctx);
    return orders.listOrders(db, { ...orderFilter(ctx), ...paging(ctx) }, pub);
  });

  r.get('/api/admin/orders/export', (ctx) => {
    admin(ctx);
    const f = orderFilter(ctx);
    const csv = orders.exportOrdersCsv(db, f, config.tzOffsetMin);
    const name = `matos-${f.kind === 'sample' ? 'namunalar' : 'buyurtmalar'}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Reply(200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
  });

  r.get('/api/admin/orders/:id', (ctx) => {
    admin(ctx);
    return { order: orders.getAdminOrder(db, idParam(ctx), pub) };
  });

  r.patch('/api/admin/orders/:id', (ctx) => {
    const a = admin(ctx);
    const input = parse(
      v.object({
        status: v.enum(['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as const).optional(),
        adminNote: v.string({ min: 0, max: 1000 }).nullable(),
        note: v.string({ max: 300 }).optional(),
      }),
      ctx.body ?? {},
    );
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    return { order: orders.updateOrder(db, idParam(ctx), { status: input.status, note: input.note, adminNote: 'adminNote' in body ? input.adminNote : undefined }, a.name, pub) };
  });

  /* ───────────── Admin: tailoring ───────────── */

  r.get('/api/admin/tailor-requests', (ctx) => {
    admin(ctx);
    const s = ctx.query.get('status') as TailorRequestStatus | null;
    return tailors.listTailorRequests(db, { status: s && TAILOR_REQUEST_STATUSES.includes(s) ? s : undefined, q: ctx.query.get('q') ?? undefined, ...paging(ctx) });
  });

  r.get('/api/admin/tailor-requests/:id', (ctx) => {
    admin(ctx);
    return { request: tailors.getTailorRequest(db, idParam(ctx)) };
  });

  r.patch('/api/admin/tailor-requests/:id', (ctx) => {
    admin(ctx);
    const input = parse(v.object({ status: v.enum(TAILOR_REQUEST_STATUSES).optional(), adminNote: v.string({ min: 0, max: 1000 }).nullable() }), ctx.body ?? {});
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    return { request: tailors.updateTailorRequest(db, idParam(ctx), { status: input.status, adminNote: 'adminNote' in body ? input.adminNote : undefined }) };
  });

  r.get('/api/admin/tailors', (ctx) => {
    admin(ctx);
    const s = ctx.query.get('status') as TailorStatus | null;
    return { tailors: tailors.listAdminTailors(db, s && ['pending', 'approved', 'rejected', 'hidden'].includes(s) ? s : undefined) };
  });

  r.post('/api/admin/tailors', (ctx) => {
    admin(ctx);
    return new Reply(201, { tailor: tailors.saveTailor(db, undefined, parse(tailors.tailorAdminSchema, ctx.body)) });
  });

  r.put('/api/admin/tailors/:id', (ctx) => {
    admin(ctx);
    return { tailor: tailors.saveTailor(db, ctx.params.id, parse(tailors.tailorAdminSchema, ctx.body)) };
  });

  r.patch('/api/admin/tailors/:id', (ctx) => {
    admin(ctx);
    const input = parse(v.object({ status: v.enum(['pending', 'approved', 'rejected', 'hidden'] as const) }), ctx.body);
    return { tailor: tailors.setTailorStatus(db, ctx.params.id, input.status) };
  });

  r.delete('/api/admin/tailors/:id', (ctx) => {
    admin(ctx);
    return tailors.deleteTailor(db, ctx.params.id);
  });

  /* ───────────── Admin: catalog ───────────── */

  r.get('/api/admin/fabrics', (ctx) => {
    admin(ctx);
    return { fabrics: catalog.listAdminFabrics(db, pub) };
  });

  r.get('/api/admin/fabrics/:id', (ctx) => {
    admin(ctx);
    return { fabric: catalog.getAdminFabric(db, ctx.params.id, pub) };
  });

  r.post('/api/admin/fabrics', (ctx) => {
    admin(ctx);
    return new Reply(201, { fabric: catalog.saveFabric(db, parse(catalog.fabricInputSchema, ctx.body), undefined, pub) });
  });

  r.put('/api/admin/fabrics/:id', (ctx) => {
    admin(ctx);
    return { fabric: catalog.saveFabric(db, parse(catalog.fabricInputSchema, ctx.body), ctx.params.id, pub) };
  });

  r.delete('/api/admin/fabrics/:id', (ctx) => {
    admin(ctx);
    catalog.archiveFabric(db, ctx.params.id);
    return undefined;
  });

  r.post(
    '/api/admin/uploads',
    (ctx) => {
      admin(ctx);
      return new Reply(201, { url: `${pub}${saveUpload(config.uploadsDir, ctx.raw ?? Buffer.alloc(0))}` });
    },
    { raw: { maxBytes: MAX_UPLOAD_BYTES } },
  );

  /* ───────────── Admin: customers ───────────── */

  r.get('/api/admin/customers', (ctx) => {
    admin(ctx);
    return reports.listCustomers(db, { q: ctx.query.get('q') ?? undefined, ...paging(ctx) });
  });

  r.get('/api/admin/customers/:id', (ctx) => {
    admin(ctx);
    const id = idParam(ctx);
    return { ...reports.getCustomer(db, id, pub), tailorRequests: tailors.listTailorRequests(db, { userId: id, page: 1, pageSize: 100 }).items };
  });

  r.patch('/api/admin/customers/:id', (ctx) => {
    admin(ctx);
    const input = parse(v.object({ status: v.enum(['active', 'blocked'] as const) }), ctx.body);
    return { customer: reports.setCustomerStatus(db, idParam(ctx), input.status) };
  });

  /* ───────────── Admin: settings & staff ───────────── */

  r.get('/api/admin/settings', (ctx) => {
    admin(ctx);
    return { settings: getSettings(db) };
  });

  r.put('/api/admin/settings', (ctx) => {
    admin(ctx);
    return { settings: saveSettings(db, parse(settingsSchema, ctx.body)) };
  });

  r.get('/api/admin/staff', (ctx) => {
    auth.requireAdmin(db, ctx, 'owner');
    return { staff: auth.listAdmins(db) };
  });

  r.post('/api/admin/staff', async (ctx) => {
    auth.requireAdmin(db, ctx, 'owner');
    const input = parse(
      v.object({ email: v.email(), name: v.string({ min: 2, max: 80 }), password: v.string({ min: 8, max: 200, trim: false }), role: v.enum(['owner', 'manager'] as const).default('manager') }),
      ctx.body,
    );
    return new Reply(201, { admin: await auth.createAdmin(db, input) });
  });

  r.delete('/api/admin/staff/:id', (ctx) => {
    const me = auth.requireAdmin(db, ctx, 'owner');
    const id = idParam(ctx);
    if (id === me.id) throw forbidden('O‘zingizni o‘chira olmaysiz');
    const target = db.get<{ role: string }>('SELECT role FROM admins WHERE id = ?', id);
    if (!target) throw notFound('Xodim topilmadi');
    if (target.role === 'owner' && Number(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM admins WHERE role = 'owner'")!.n) <= 1) {
      throw conflict('Kamida bitta ega qolishi kerak');
    }
    db.run('DELETE FROM admins WHERE id = ?', id);
    auth.revokeAll(db, 'admin', id);
    return undefined;
  });

  return r;
}
