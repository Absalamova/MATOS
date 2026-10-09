/**
 * On-device photo analysis for "find this fabric": no upload, no server.
 * 1. drop the background (colour that dominates the photo border) and damp skin tones,
 * 2. k-means in Lab space → the garment's palette,
 * 3. surface cues (fine texture, highlights, two-colour patterns),
 * 4. rank every colourway by perceptual colour distance plus fabric/garment fit.
 */
import { ColorOption, Fabric, GarmentSilhouette } from '../types';
import { deltaE, hexToLab, rgbToHex, rgbToLab } from './colors';
import { suitability } from './measure';

type Lab = [number, number, number];

export interface PaletteColor {
  hex: string;
  lab: Lab;
  share: number;
}

export interface Analysis {
  palette: PaletteColor[];
  surface: 'smooth' | 'textured' | 'patterned';
  sheen: number;
}

export interface Match {
  fabric: Fabric;
  color: ColorOption;
  colorScore: number;
  score: number;
  /** matched as a print (check / ikat) rather than a single colour */
  print?: boolean;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

const isSkin = (r: number, g: number, b: number) => {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 70 && cb > 80 && cb < 122 && cr > 138 && cr < 170;
};

export async function analyzePhoto(src: string): Promise<Analysis> {
  const img = await loadImage(src);
  const max = 180;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * k));
  const h = Math.max(8, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const labs: Lab[] = new Array(w * h);
  for (let i = 0; i < w * h; i++) labs[i] = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);

  // Background = the colour most of the border agrees on.
  const border: Lab[] = [];
  const bw = Math.max(2, Math.round(Math.min(w, h) * 0.05));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (x < bw || y < bw || x >= w - bw || y >= h - bw) border.push(labs[y * w + x]);
  const mean = border.reduce((a, l) => [a[0] + l[0], a[1] + l[1], a[2] + l[2]] as Lab, [0, 0, 0] as Lab).map((v) => v / border.length) as Lab;
  const agree = border.filter((l) => deltaE(l, mean) < 14).length / border.length;
  const bg = agree > 0.5 ? mean : null;

  // Weighted samples
  const samples: { lab: Lab; w: number; i: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const lab = labs[i];
      if (bg && deltaE(lab, bg) < 16) continue;
      const dx = (x / w - 0.5) * 2;
      const dy = (y / h - 0.5) * 2;
      let wt = 1 - 0.55 * Math.min(1, dx * dx + dy * dy);
      if (isSkin(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) wt *= 0.15;
      samples.push({ lab, w: wt, i });
    }
  }
  const pool = samples.length > 40 ? samples : labs.map((lab, i) => ({ lab, w: 1, i }));

  // k-means (k-means++ seeding, deterministic)
  const K = Math.min(5, pool.length);
  const centers: Lab[] = [pool[Math.floor(pool.length / 2)].lab];
  while (centers.length < K) {
    let best = pool[0];
    let bd = -1;
    for (let s = 0; s < pool.length; s += 3) {
      const d = Math.min(...centers.map((cc) => deltaE(pool[s].lab, cc))) * pool[s].w;
      if (d > bd) {
        bd = d;
        best = pool[s];
      }
    }
    centers.push(best.lab);
  }
  const assign = new Int32Array(pool.length);
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    pool.forEach((p, idx) => {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((cc, ci) => {
        const d = (p.lab[0] - cc[0]) ** 2 + (p.lab[1] - cc[1]) ** 2 + (p.lab[2] - cc[2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = ci;
        }
      });
      assign[idx] = bi;
      acc[bi][0] += p.lab[0] * p.w;
      acc[bi][1] += p.lab[1] * p.w;
      acc[bi][2] += p.lab[2] * p.w;
      acc[bi][3] += p.w;
    });
    acc.forEach((a, ci) => {
      if (a[3] > 0) centers[ci] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    });
  }
  const weight = centers.map(() => 0);
  pool.forEach((p, idx) => (weight[assign[idx]] += p.w));
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  let clusters = centers.map((lab, ci) => ({ lab, share: weight[ci] / total, ci })).sort((a, b) => b.share - a.share);
  // merge near-identical clusters
  const merged: typeof clusters = [];
  for (const cl of clusters) {
    const m = merged.find((x) => deltaE(x.lab, cl.lab) < 9);
    if (m) m.share += cl.share;
    else merged.push({ ...cl });
  }
  clusters = merged.filter((x) => x.share >= 0.04).slice(0, 4);

  // Surface cues inside the dominant cluster
  const main = clusters[0];
  let hf = 0;
  let n = 0;
  let bright = 0;
  pool.forEach((p, idx) => {
    if (assign[idx] !== main.ci) return;
    const i = p.i;
    const x = i % w;
    const y = (i / w) | 0;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return;
    const l = labs[i][0];
    const lap = Math.abs(4 * l - labs[i - 1][0] - labs[i + 1][0] - labs[i - w][0] - labs[i + w][0]);
    hf += lap;
    n++;
    if (l > main.lab[0] + 16) bright++;
  });
  const texture = n ? hf / n : 0;
  const sheen = n ? bright / n : 0;
  // two strongly different colours, both well represented → a print or check
  // ...but only if they interleave. Two separate garments (navy shirt over pale jeans) are two
  // big blocks with a short shared edge; a check or ikat has an edge every few pixels.
  const clusterAt = new Int16Array(w * h).fill(-1);
  pool.forEach((p, idx) => (clusterAt[p.i] = assign[idx]));
  const interleaved = (a: number, b: number) => {
    let edges = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < w * h; i++) {
      const c = clusterAt[i];
      if (c === a) na++;
      else if (c === b) nb++;
      else continue;
      const other = c === a ? b : a;
      if (i % w < w - 1 && clusterAt[i + 1] === other) edges++;
      if (i + w < w * h && clusterAt[i + w] === other) edges++;
    }
    return edges / Math.max(1, Math.min(na, nb)) > 0.18;
  };
  const contrasting = clusters.filter((x) => x.share > 0.12);
  let patterned = false;
  for (let i = 0; i < contrasting.length && !patterned; i++)
    for (let j = i + 1; j < contrasting.length; j++)
      if (deltaE(contrasting[i].lab, contrasting[j].lab) > 40 && texture > 4 && interleaved(contrasting[i].ci, contrasting[j].ci)) patterned = true;

  const toRgb = (lab: Lab) => labToRgb(lab);
  return {
    palette: clusters.map((x) => ({ lab: x.lab, share: x.share, hex: rgbToHex(...toRgb(x.lab)) })),
    surface: patterned ? 'patterned' : texture > 5.5 ? 'textured' : 'smooth',
    sheen,
  };
}

function labToRgb([L, a, b]: Lab): [number, number, number] {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  x = f(x) * 0.95047;
  y = f(y);
  z = f(z) * 1.08883;
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bb = x * 0.0557 + y * -0.204 + z * 1.057;
  const gam = (c: number) => (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c);
  r = gam(r);
  g = gam(g);
  bb = gam(bb);
  return [r * 255, g * 255, bb * 255];
}

const GROUND = hexToLab('#F2EEE6');

export function rankFabrics(fabrics: Fabric[], target: PaletteColor, analysis: Analysis, garment?: GarmentSilhouette): Match[] {
  const out: Match[] = [];
  // the two most different well-represented colours of a print
  const pal = analysis.palette.filter((p) => p.share > 0.1);
  let pair: [PaletteColor, PaletteColor] | null = null;
  let best = 0;
  for (let i = 0; i < pal.length; i++)
    for (let j = i + 1; j < pal.length; j++) {
      const d = deltaE(pal[i].lab, pal[j].lab);
      if (d > best) {
        best = d;
        pair = [pal[i], pal[j]];
      }
    }
  for (const f of fabrics) {
    for (const c of f.colors) {
      let d = deltaE(target.lab, hexToLab(c.hex));
      if (analysis.surface === 'patterned' && pair && (f.pattern === 'gingham' || f.pattern === 'ikat')) {
        // compare both colours of the print with the cloth's colour + its light ground
        const lab = hexToLab(c.hex);
        const a = deltaE(pair[0].lab, lab) + deltaE(pair[1].lab, GROUND);
        const b = deltaE(pair[1].lab, lab) + deltaE(pair[0].lab, GROUND);
        d = Math.min(d, Math.min(a, b) / 2);
      }
      const colorScore = Math.max(0, Math.min(99, 100 - d * 2.3));
      let bonus = 0;
      if (analysis.surface === 'smooth' && analysis.sheen > 0.06 && f.category === 'silk') bonus += 7;
      if (analysis.surface === 'textured' && (f.category === 'linen' || f.pattern === 'canvas')) bonus += 5;
      const printed = f.pattern === 'gingham' || f.pattern === 'ikat';
      if (analysis.surface === 'patterned') bonus += printed ? 18 : -6;
      if (garment) bonus += suitability(garment, f) * 12;
      out.push({ fabric: f, color: c, colorScore: Math.round(colorScore), score: colorScore + bonus, print: analysis.surface === 'patterned' && printed });
    }
  }
  out.sort((a, b) => b.score - a.score);
  const perFabric = new Map<string, number>();
  return out.filter((m) => {
    const k = (perFabric.get(m.fabric.id) ?? 0) + 1;
    perFabric.set(m.fabric.id, k);
    return k <= 2;
  }).slice(0, 6);
}
