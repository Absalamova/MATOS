import * as THREE from 'three';
import { ColorOption, Fabric, WeavePattern } from '../types';
import { asset } from '../lib/format';
import { drawWeave } from '../lib/weave';

export interface FabricMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** real-world width of one texture tile, metres */
  tileMeters: number;
}

const cache = new Map<string, Promise<FabricMaps>>();
let maxAnisotropy = 4;
export const setMaxAnisotropy = (n: number) => {
  maxAnisotropy = Math.max(1, Math.min(8, n));
};

const hexToRgb = (hex: string) => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const shadeHex = (hex: string, k: number) => {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** Normal map from the luminance of a canvas (Sobel), wrapping at the edges. */
function normalFromCanvas(src: HTMLCanvasElement, strength: number) {
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  const out = canvas(w);
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const L = (x: number, y: number) => lum[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1)) * strength;
      const dy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1)) * strength;
      const nz = 1;
      const len = Math.hypot(dx, dy, nz);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function toTexture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAnisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${url}`));
    img.src = url;
  });
}

/** Photo tile, levelled so its average matches the colourway swatch colour. */
async function photoMaps(url: string, hex: string): Promise<FabricMaps> {
  const img = await loadImage(asset(url));
  const c = canvas(512);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 512, 512);
  const id = ctx.getImageData(0, 0, 512, 512);
  const d = id.data;
  let mr = 0;
  let mg = 0;
  let mb = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    mr += d[i];
    mg += d[i + 1];
    mb += d[i + 2];
  }
  mr /= n;
  mg /= n;
  mb /= n;
  const [tr, tg, tb] = hexToRgb(hex);
  // Blend 60% toward the declared colour so swatch dots and 3D agree.
  const k = (t: number, m: number) => 1 + ((t / Math.max(m, 1)) - 1) * 0.6;
  const kr = k(tr, mr);
  const kg = k(tg, mg);
  const kb = k(tb, mb);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * kr);
    d[i + 1] = Math.min(255, d[i + 1] * kg);
    d[i + 2] = Math.min(255, d[i + 2] * kb);
  }
  ctx.putImageData(id, 0, 0);
  const nm = normalFromCanvas(c, 2.2);
  return { map: toTexture(c, true), normalMap: toTexture(nm, false), tileMeters: 0.08 };
}

function proceduralMaps(fabric: Fabric, color: ColorOption): FabricMaps {
  const { color: c, height, tileMeters } = drawWeave(fabric.pattern, color.hex, 512, color.id.length * 97 + 3);
  return {
    map: toTexture(c, true),
    normalMap: toTexture(normalFromCanvas(height, fabric.pattern === 'ikat' ? 1.2 : 2.6), false),
    tileMeters,
  };
}

export function fabricMaps(fabric: Fabric, color: ColorOption): Promise<FabricMaps> {
  const key = `${fabric.id}:${color.id}`;
  let p = cache.get(key);
  if (!p) {
    const tile = color.photos?.tile;
    p = tile ? photoMaps(tile, color.hex).catch(() => proceduralMaps(fabric, color)) : Promise.resolve(proceduralMaps(fabric, color));
    cache.set(key, p);
  }
  return p;
}

/** Colour-blocked canvas for the Mondrian dress: fabric colour, ivory, ink and one accent. */
export function mondrianMap(hex: string) {
  const size = 1024;
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const ivory = '#F3EFE6';
  const ink = '#161616';
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const accent = lum > 0.6 ? '#1F3F8F' : '#E0B33A';
  ctx.fillStyle = ivory;
  ctx.fillRect(0, 0, size, size);
  // texture u spans ~1 m around the body (0 = back centre), v spans 0.5–1.5 m height
  const blocks: [number, number, number, number, string][] = [
    [0.36, 0.55, 0.22, 0.25, hex],
    [0.58, 0.2, 0.1, 0.25, accent],
    [0.1, 0.0, 0.18, 0.3, hex],
    [0.72, 0.62, 0.2, 0.2, hex],
    [0.0, 0.62, 0.12, 0.25, accent],
  ];
  for (const [x, y, w, h, col] of blocks) {
    ctx.fillStyle = col;
    ctx.fillRect(x * size, y * size, w * size, h * size);
  }
  ctx.fillStyle = ink;
  const lines = [0.1, 0.28, 0.36, 0.58, 0.68, 0.72, 0.92];
  for (const x of lines) ctx.fillRect(x * size - 7, 0, 14, size);
  for (const y of [0.2, 0.3, 0.45, 0.55, 0.62, 0.8]) ctx.fillRect(0, y * size - 7, size, 14);
  const t = toTexture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
