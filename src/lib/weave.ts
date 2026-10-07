/** Canvas-only fabric drawing (no three.js), shared by catalog thumbnails and the 3D textures. */
import { ColorOption, Fabric, WeavePattern } from '../types';

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexToRgb = (hex: string) => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const shadeHex = (hex: string, k: number) => {
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

/** Procedural weave for colourways without photos. Returns colour + height canvases. */
export function drawWeave(pattern: WeavePattern, hex: string, size = 512, seed = 11) {
  const c = canvas(size);
  const h = canvas(size);
  const ctx = c.getContext('2d')!;
  const hx = h.getContext('2d')!;
  const r = rng(seed);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  hx.fillStyle = '#808080';
  hx.fillRect(0, 0, size, size);
  let tileMeters = 0.05;

  const grain = (amount: number, step = 1) => {
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const v = (r() - 0.5) * amount;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  };

  switch (pattern) {
    case 'gingham': {
      tileMeters = 0.05;
      const cell = size / 2;
      ctx.fillStyle = '#F4F2EE';
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, cell, size);
      ctx.fillRect(0, 0, size, cell);
      ctx.globalAlpha = 1;
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, cell, cell);
      for (let i = 0; i < size; i += 3) {
        hx.fillStyle = i % 6 ? '#909090' : '#707070';
        hx.fillRect(i, 0, 1, size);
        hx.fillRect(0, i, size, 1);
      }
      grain(0.06, 2);
      break;
    }
    case 'ikat': {
      // Margilan abr: feathered medallions in ivory and a deep shade on the base colour.
      tileMeters = 0.26;
      const ivory = '#F1E8D6';
      const deep = shadeHex(hex, -0.55);
      const accent = '#E2B04A';
      const motif = (cx: number, cy: number, w: number, hgt: number, fill: string, inner: string) => {
        for (let y = -hgt; y <= hgt; y += 2) {
          const t = 1 - Math.abs(y) / hgt;
          const half = w * Math.pow(t, 0.9);
          const jitter = (r() - 0.5) * 14;
          ctx.fillStyle = fill;
          ctx.fillRect(cx - half + jitter, cy + y, half * 2, 2);
          const ih = half * 0.45;
          if (ih > 2) {
            ctx.fillStyle = inner;
            ctx.fillRect(cx - ih + jitter * 0.6, cy + y, ih * 2, 2);
          }
        }
      };
      const cw = size / 2;
      for (let row = -1; row < 3; row++) {
        for (let col = -1; col < 3; col++) {
          const cx = col * cw + (row % 2 ? cw / 2 : 0);
          const cy = row * (size / 2) + size / 4;
          motif(cx, cy, cw * 0.36, size * 0.2, ivory, deep);
        }
      }
      // thin accent stripes between motif columns
      for (let col = 0; col < 4; col++) {
        const x = col * (size / 4) + size / 8;
        for (let y = 0; y < size; y += 2) {
          ctx.fillStyle = accent;
          ctx.fillRect(x + (r() - 0.5) * 6, y, 3, 2);
        }
      }
      // warp threads
      for (let x = 0; x < size; x += 2) {
        ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`;
        ctx.fillRect(x, 0, 1, size);
        hx.fillStyle = x % 4 ? '#8a8a8a' : '#767676';
        hx.fillRect(x, 0, 1, size);
      }
      break;
    }
    case 'crepe': {
      tileMeters = 0.04;
      grain(0.07, 1);
      for (let i = 0; i < size * 30; i++) {
        const x = r() * size;
        const y = r() * size;
        const v = r();
        hx.fillStyle = v > 0.5 ? '#9a9a9a' : '#666';
        hx.fillRect(x, y, 2, 2);
      }
      break;
    }
    case 'jersey': {
      tileMeters = 0.05;
      const sw = 8;
      const sh = 10;
      for (let y = 0; y < size; y += sh) {
        for (let x = 0; x < size; x += sw) {
          const g = ctx.createLinearGradient(x, 0, x + sw, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.18)');
          g.addColorStop(0.5, 'rgba(255,255,255,0.10)');
          g.addColorStop(1, 'rgba(0,0,0,0.18)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + sw / 2, y + sh);
          ctx.lineTo(x + sw, y);
          ctx.lineTo(x + sw / 2, y + sh * 0.45);
          ctx.closePath();
          ctx.fill();
          hx.fillStyle = '#a0a0a0';
          hx.beginPath();
          hx.moveTo(x + 1, y);
          hx.lineTo(x + sw / 2, y + sh - 1);
          hx.lineTo(x + sw - 1, y);
          hx.lineTo(x + sw / 2, y + sh * 0.5);
          hx.closePath();
          hx.fill();
        }
      }
      grain(0.05, 2);
      break;
    }
    case 'twill': {
      tileMeters = 0.04;
      ctx.lineWidth = 3;
      hx.lineWidth = 3;
      for (let i = -size; i < size * 2; i += 6) {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.moveTo(i + 3, 0);
        ctx.lineTo(i + 3 + size, size);
        ctx.stroke();
        hx.strokeStyle = '#b0b0b0';
        hx.beginPath();
        hx.moveTo(i, 0);
        hx.lineTo(i + size, size);
        hx.stroke();
      }
      grain(0.05, 2);
      break;
    }
    default: {
      // plain / canvas weave
      tileMeters = pattern === 'canvas' ? 0.04 : 0.05;
      const step = pattern === 'canvas' ? 4 : 3;
      for (let i = 0; i < size; i += step) {
        ctx.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.06})`;
        ctx.fillRect(i, 0, 1, size);
        ctx.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
        ctx.fillRect(0, i, size, 1);
        hx.fillStyle = '#a8a8a8';
        hx.fillRect(i, 0, step - 1, size);
        hx.fillStyle = 'rgba(80,80,80,0.5)';
        hx.fillRect(0, i, size, 1);
      }
      grain(0.05, 2);
    }
  }
  return { color: c, height: h, tileMeters };
}


const thumbCache = new Map<string, string>();

/** Data-URL swatch for colourways that have no photo (silk, merino, twill …). */
export function weaveThumb(fabric: Fabric, color: ColorOption, size = 320) {
  const key = `${fabric.id}:${color.id}:${size}`;
  let url = thumbCache.get(key);
  if (!url) {
    const { color: c } = drawWeave(fabric.pattern, color.hex, size, color.id.length * 97 + 3);
    // soft studio light so flat swatches read like photographed cloth
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size * 0.5, size * 0.5, size * 0.8);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    url = c.toDataURL('image/jpeg', 0.86);
    thumbCache.set(key, url);
  }
  return url;
}
