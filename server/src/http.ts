import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { HttpError, notFound } from './lib/errors.ts';
import { log } from './lib/log.ts';
import type { Config } from './config.ts';

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  ip: string;
  reqId: string;
  /** Parsed JSON body (POST/PUT/PATCH with application/json), otherwise undefined. */
  body: unknown;
  /** Raw body for upload routes. */
  raw?: Buffer;
  header: (name: string) => string;
  /** Filled by auth guards. */
  state: Record<string, unknown>;
}

/** A handler may return plain data (sent as JSON 200) or a Reply for full control. */
export class Reply {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  constructor(status: number, body?: unknown, headers: Record<string, string> = {}) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
  raw?: { maxBytes: number };
}

const JSON_LIMIT = 1024 * 1024;

export class Router {
  private routes: Route[] = [];

  on(method: string, pattern: string, handler: Handler, opts: { raw?: { maxBytes: number } } = {}) {
    const keys: string[] = [];
    const re = new RegExp(
      '^' +
        pattern.replace(/\/:([a-zA-Z]+)/g, (_, k: string) => {
          keys.push(k);
          return '/([^/]+)';
        }) +
        '/?$',
    );
    this.routes.push({ method, re, keys, handler, raw: opts.raw });
    return this;
  }
  get = (p: string, h: Handler) => this.on('GET', p, h);
  post = (p: string, h: Handler, o?: { raw?: { maxBytes: number } }) => this.on('POST', p, h, o);
  put = (p: string, h: Handler) => this.on('PUT', p, h);
  patch = (p: string, h: Handler) => this.on('PATCH', p, h);
  delete = (p: string, h: Handler) => this.on('DELETE', p, h);

  match(method: string, path: string) {
    let allowed = false;
    for (const r of this.routes) {
      const m = r.re.exec(path);
      if (!m) continue;
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) {
        allowed = true;
        continue;
      }
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]);
        } catch {
          params[k] = m[i + 1];
        }
      });
      return { route: r, params };
    }
    return allowed ? 'method' : null;
  }
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > maxBytes) {
      reject(new HttpError(413, 'too_large', 'Yuborilgan ma’lumot juda katta'));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'too_large', 'Yuborilgan ma’lumot juda katta'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Client IP for rate limits. Behind N trusted proxies (TRUST_PROXY=N) the real address is the N-th entry
 * from the END of X-Forwarded-For — earlier entries can be forged by the client, so they are never used.
 */
export function clientIp(req: IncomingMessage, trustProxyHops: number) {
  if (trustProxyHops > 0) {
    const chain = String(req.headers['x-forwarded-for'] ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (chain.length) return chain[Math.max(0, chain.length - trustProxyHops)];
  }
  return req.socket.remoteAddress ?? '';
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string>, head: boolean) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined || status === 204 || status === 304) {
    res.writeHead(status);
    res.end();
    return;
  }
  let payload: Buffer;
  if (Buffer.isBuffer(body)) payload = body;
  else if (typeof body === 'string' && res.getHeader('Content-Type')) payload = Buffer.from(body);
  else {
    payload = Buffer.from(JSON.stringify(body));
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.setHeader('Content-Length', payload.length);
  res.writeHead(status);
  res.end(head ? undefined : payload);
}

export interface AppOptions {
  config: Config;
  router: Router;
  /** Optional non-API handler (static uploads). Return true when handled. */
  fallback?: (req: IncomingMessage, res: ServerResponse, path: string) => boolean | Promise<boolean>;
  rateLimit: (ctx: Ctx) => void;
}

/** Exact origins, plus `http://localhost:*`-style entries that allow any port (handy in development). */
export function originMatcher(list: string[]) {
  const exact = new Set(list.filter((o) => !o.includes('*')));
  const patterns = list
    .filter((o) => o.includes('*'))
    .map((o) => new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}$`));
  return (origin: string) => !!origin && (exact.has(origin) || patterns.some((re) => re.test(origin)));
}

export function createHandler({ config, router, fallback, rateLimit }: AppOptions) {
  const allowed = originMatcher(config.corsOrigins);

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const started = performance.now();
    const reqId = String(req.headers['x-request-id'] ?? '').slice(0, 64) || randomUUID();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/{2,}/g, '/');
    const method = (req.method ?? 'GET').toUpperCase();
    const ip = clientIp(req, config.trustProxy);
    const head = method === 'HEAD';
    res.setHeader('X-Request-Id', reqId);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

    const origin = String(req.headers.origin ?? '');
    const corsOk = allowed(origin);
    if (corsOk) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, ETag');
    }

    let status = 500;
    try {
      if (method === 'OPTIONS') {
        if (corsOk) {
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, If-None-Match, X-Request-Id');
          res.setHeader('Access-Control-Max-Age', '600');
        }
        status = 204;
        send(res, 204, undefined, {}, head);
        return;
      }

      if (!path.startsWith('/api/')) {
        if (fallback && (await fallback(req, res, path))) {
          status = res.statusCode;
          return;
        }
        throw notFound('Sahifa topilmadi');
      }

      const m = router.match(method, path);
      if (m === 'method') throw new HttpError(405, 'method_not_allowed', 'Bu usul qo‘llab-quvvatlanmaydi');
      if (!m) throw notFound('API manzili topilmadi');

      const ctx: Ctx = {
        req,
        res,
        method,
        path,
        query: url.searchParams,
        params: m.params,
        ip,
        reqId,
        body: undefined,
        header: (name) => String(req.headers[name.toLowerCase()] ?? ''),
        state: {},
      };
      rateLimit(ctx);

      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        if (m.route.raw) {
          ctx.raw = await readBody(req, m.route.raw.maxBytes);
        } else {
          const buf = await readBody(req, JSON_LIMIT);
          if (buf.length) {
            const type = String(req.headers['content-type'] ?? '');
            if (!type.includes('application/json')) throw new HttpError(415, 'unsupported_media_type', 'Content-Type: application/json bo‘lishi kerak');
            try {
              ctx.body = JSON.parse(buf.toString('utf8'));
            } catch {
              throw new HttpError(400, 'invalid_json', 'JSON noto‘g‘ri');
            }
          }
        }
      }

      const out = await m.route.handler(ctx);
      const reply = out instanceof Reply ? out : new Reply(out === undefined ? 204 : 200, out);
      status = reply.status;
      send(res, reply.status, reply.body, { 'Cache-Control': 'no-store', ...reply.headers }, head);
    } catch (err) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (err instanceof HttpError) {
        status = err.status;
        const body: Record<string, unknown> = { code: err.code, message: err.message };
        if (err.fields) body.fields = err.fields;
        if (err.details) body.details = err.details;
        send(res, err.status, { error: body }, { 'Cache-Control': 'no-store', ...(err.status === 429 ? { 'Retry-After': '60' } : {}) }, head);
      } else {
        status = 500;
        log.error('Kutilmagan xato', { reqId, method, path, err: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
        send(res, 500, { error: { code: 'internal', message: 'Serverda xatolik yuz berdi. Birozdan keyin qayta urinib ko‘ring.', requestId: reqId } }, { 'Cache-Control': 'no-store' }, head);
      }
    } finally {
      const ms = Math.round(performance.now() - started);
      if (path !== '/api/health') log.info(`${method} ${path} ${status} ${ms}ms`, config.logFormat === 'json' ? { reqId, ip, status, ms } : undefined);
    }
  };
}
