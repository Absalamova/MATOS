import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from '../lib/errors.ts';
import { randomHex } from '../lib/crypto.ts';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const FILE_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Identifies the image by its first bytes — the declared Content-Type is not trusted. */
export function sniffImage(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function saveUpload(dir: string, buf: Buffer) {
  if (!buf.length) throw new HttpError(400, 'empty_file', 'Fayl bo‘sh');
  const ext = sniffImage(buf);
  if (!ext) throw new HttpError(415, 'unsupported_image', 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${randomHex(16)}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf, { flag: 'wx' });
  return `/uploads/${name}`;
}

/** Serves /uploads/<file>. Images are shared across origins so the store can use them as WebGL textures. */
export function serveUpload(dir: string, req: IncomingMessage, res: ServerResponse, urlPath: string) {
  const m = /^\/uploads\/([^/]+)$/.exec(urlPath);
  if (!m || !FILE_RE.test(m[1]) || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
  const file = path.join(dir, m[1]);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    res.end();
    return true;
  }
  res.setHeader('Content-Type', TYPES[m[1].split('.').pop()!]);
  res.setHeader('Content-Length', stat.size);
  res.writeHead(200);
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
  return true;
}
