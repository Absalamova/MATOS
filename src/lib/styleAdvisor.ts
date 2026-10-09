/**
 * Personal style advisor, fully on-device: the photo is never uploaded or stored.
 *
 * 1. Colouring: skin (and hair, when visible) → undertone, depth, contrast → one of four
 *    seasonal palettes. White balance is roughly corrected against a neutral background.
 * 2. Body shape: on a full-length photo against a plain wall the figure is cut out from the
 *    background and its front width is read at shoulder, waist and hip height.
 *    Bust/waist/hip measurements are more reliable and win whenever the shopper gives them.
 * 3. Recommendations: the shop's own silhouettes for that shape, and the catalogue colourways
 *    closest to the palette (and furthest from the colours to avoid).
 *
 * Everything below works on plain pixel arrays so it can be unit-tested without a DOM.
 */
import type { BodyMeasurements, ColorOption, Fabric, GarmentSilhouette, GarmentTypeKey, Localized } from '../types';
import { GARMENTS } from '../data/garments';
import { deltaE, hexToLab, rgbToHex, rgbToLab } from './colors';
import { L } from './i18n';
import { suitability } from './measure';

export type Lab = [number, number, number];
export type Undertone = 'warm' | 'neutral' | 'cool';
export type Depth = 'light' | 'medium' | 'deep';
export type Contrast = 'low' | 'medium' | 'high';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type BodyShape = 'hourglass' | 'pear' | 'inverted' | 'rectangle' | 'apple';
export type Issue = 'no-skin' | 'too-dark' | 'busy-background' | 'not-full-body';

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Coloring {
  skin: string;
  skinLab: Lab;
  hair: string | null;
  /** CIE Lab hue angle of the skin, degrees */
  hue: number;
  undertone: Undertone;
  depth: Depth;
  contrast: Contrast;
  /** share of the frame the face covers: ~0.1–0.5 for a close-up, ~0.01 in a full-length photo */
  faceShare: number;
}

export interface Silhouette {
  shape: BodyShape;
  /** front widths, relative to the widest of shoulder/hip */
  shoulder: number;
  waist: number;
  hip: number;
  /** 0…1, how much we trust the cut-out */
  confidence: number;
}

export interface PortraitAnalysis {
  coloring: Coloring | null;
  silhouette: Silhouette | null;
  issues: Issue[];
}

/* ───────────────────────── pixel helpers ───────────────────────── */

/** YCbCr skin range (works from very light to deep skin) plus a warm-hue guard against grey walls. */
export function isSkin(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  // the lightness floor keeps dark-brown hair out; very deep skin falls back to the manual choice
  return y > 52 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && r > b && r - b > 12 && r > 45;
}

const hueOf = (lab: Lab) => {
  const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
};

/** Mean of the middle of the lightness distribution: drops shadows, highlights and stray pixels. */
function robustMean(labs: Lab[], lo = 0.25, hi = 0.85): Lab {
  const s = [...labs].sort((a, b) => a[0] - b[0]);
  const part = s.slice(Math.floor(s.length * lo), Math.max(Math.floor(s.length * lo) + 1, Math.ceil(s.length * hi)));
  const sum = part.reduce((a, l) => [a[0] + l[0], a[1] + l[1], a[2] + l[2]] as Lab, [0, 0, 0] as Lab);
  return [sum[0] / part.length, sum[1] / part.length, sum[2] / part.length];
}

export function labToHex([Lv, a, b]: Lab) {
  let y = (Lv + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  x = f(x) * 0.95047;
  y = f(y);
  z = f(z) * 1.08883;
  const gam = (c: number) => 255 * (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c);
  return rgbToHex(gam(x * 3.2406 - y * 1.5372 - z * 0.4986), gam(-x * 0.9689 + y * 1.8758 + z * 0.0415), gam(x * 0.0557 - y * 0.204 + z * 1.057));
}

/** Background = the colour most of the photo border agrees on (null for a busy scene). */
export function backgroundOf(labs: Lab[], w: number, h: number): { lab: Lab; agree: number } | null {
  const border: Lab[] = [];
  const bw = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (x < bw || x >= w - bw || y < bw) border.push(labs[y * w + x]); // floor excluded: it rarely matches the wall
  if (!border.length) return null;
  const lab = robustMean(border, 0.1, 0.9);
  const agree = border.filter((l) => deltaE(l, lab) < 14).length / border.length;
  return agree >= 0.55 ? { lab, agree } : null;
}

/* ───────────────────────── colouring ───────────────────────── */

export const undertoneOf = (hue: number): Undertone => (hue >= 58 ? 'warm' : hue <= 49 ? 'cool' : 'neutral');

/** Individual Typology Angle (dermatology standard): > 41° light, 10…41° medium, < 10° deep. */
export function depthOf(lab: Lab): Depth {
  const ita = (Math.atan2(lab[0] - 50, Math.max(1, lab[2])) * 180) / Math.PI;
  return ita > 41 ? 'light' : ita >= 10 ? 'medium' : 'deep';
}

export const contrastOf = (skinL: number, hairL: number | null): Contrast => {
  if (hairL == null) return 'medium';
  const d = skinL - hairL;
  return d >= 42 ? 'high' : d >= 24 ? 'medium' : 'low';
};

export function seasonFor(undertone: Undertone, depth: Depth, contrast: Contrast, hue = 54): Season {
  const warm = undertone === 'warm' || (undertone === 'neutral' && hue >= 53.5);
  if (warm) return depth === 'deep' || (depth === 'medium' && contrast !== 'high') ? 'autumn' : 'spring';
  return depth === 'deep' || contrast === 'high' ? 'winter' : 'summer';
}

export function analyzeColoring(px: Pixels, bg: Lab | null, labs: Lab[]): Coloring | null {
  const { data, width: w, height: h } = px;
  const skin = new Uint8Array(w * h);
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    if (bg && deltaE(labs[i], bg) < 10) continue; // beige walls and wood read as skin
    if (isSkin(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) {
      skin[i] = 1;
      total++;
    }
  }
  if (total < Math.max(30, w * h * 0.004)) return null;

  // Erode once: hair/wall and hair/skin edges blend into skin-like colours and form thin rings.
  const core = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      core[i] = skin[i] & skin[i - 1] & skin[i + 1] & skin[i - w] & skin[i + w];
    }
  // Connected skin regions; the face is the topmost one of a meaningful size (arms and legs tan differently).
  const label = new Int32Array(w * h).fill(-1);
  const regions: { pixels: number[]; top: number; x0: number; x1: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!core[start] || label[start] >= 0) continue;
    const r = { pixels: [] as number[], top: h, x0: w, x1: 0, y1: 0 };
    label[start] = regions.length;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i / w) | 0;
      r.pixels.push(i);
      if (y < r.top) r.top = y;
      if (y > r.y1) r.y1 = y;
      if (x < r.x0) r.x0 = x;
      if (x > r.x1) r.x1 = x;
      for (const j of [i - 1, i + 1, i - w, i + w])
        if (j >= 0 && j < w * h && core[j] && label[j] < 0 && Math.abs((j % w) - x) <= 1) {
          label[j] = regions.length;
          stack.push(j);
        }
    }
    regions.push(r);
  }
  const largest = Math.max(0, ...regions.map((r) => r.pixels.length));
  const faceRegion = regions.filter((r) => r.pixels.length >= Math.max(20, largest * 0.2)).sort((a, b) => a.top - b.top)[0];
  let face: Lab[] = faceRegion ? faceRegion.pixels.map((i) => labs[i]) : [];
  if (face.length < 20) {
    face = [];
    for (let i = 0; i < w * h; i++) if (skin[i]) face.push(labs[i]);
  }
  const top = faceRegion?.top ?? 0;
  const bottom = faceRegion ? Math.min(faceRegion.y1, top + Math.round(h * 0.4)) : h - 1;
  const x0 = faceRegion?.x0 ?? 0;
  const x1 = faceRegion?.x1 ?? w - 1;

  // Grey-world against a near-neutral wall: undo most of the camera's colour cast.
  const cast: [number, number] = bg && bg[0] > 35 && Math.hypot(bg[1], bg[2]) < 22 ? [bg[1] * 0.7, bg[2] * 0.7] : [0, 0];
  const fix = (l: Lab): Lab => [l[0], l[1] - cast[0], l[2] - cast[1]];
  const skinLab = fix(robustMean(face));

  // Hair: darker, non-skin, non-wall pixels just above and beside the face.
  const fh = bottom - top + 1;
  const hair: Lab[] = [];
  const pad = Math.round((x1 - x0) * 0.25);
  for (let y = Math.max(0, top - Math.round(fh * 0.5)); y < Math.min(h, top + fh * 0.45); y++)
    for (let x = Math.max(0, x0 - pad); x <= Math.min(w - 1, x1 + pad); x++) {
      const i = y * w + x;
      if (skin[i] || (bg && deltaE(labs[i], bg) < 16)) continue;
      if (labs[i][0] < skinLab[0] - 8) hair.push(labs[i]);
    }
  const hairLab = hair.length >= Math.max(12, face.length * 0.05) ? fix(robustMean(hair, 0.1, 0.7)) : null;

  const hue = hueOf(skinLab);
  const undertone = undertoneOf(hue);
  return {
    skin: labToHex(skinLab),
    skinLab,
    hair: hairLab ? labToHex(hairLab) : null,
    hue,
    undertone,
    depth: depthOf(skinLab),
    contrast: contrastOf(skinLab[0], hairLab ? hairLab[0] : null),
    faceShare: faceRegion ? faceRegion.pixels.length / (w * h) : 0,
  };
}

/** A face this big can only be a close-up, whichever slot the shopper put the photo in. */
export const CLOSE_UP_SHARE = 0.05;

export type PhotoKind = 'face' | 'body' | 'unknown';

/** What a photo turned out to be: a face close-up, a full-length figure, or neither. */
export function photoKind(a: PortraitAnalysis): PhotoKind {
  if (a.silhouette) return 'body';
  if (a.coloring && a.coloring.faceShare >= CLOSE_UP_SHARE) return 'face';
  return 'unknown';
}

/* ───────────────────────── body shape ───────────────────────── */

/** Classic bust/waist/hip rules (after FFIT), in centimetres. */
export function shapeFromMeasurements({ bustCm: b, waistCm: w, hipsCm: h }: BodyMeasurements): BodyShape {
  if (w >= 0.9 * Math.max(b, h)) return 'apple';
  if (Math.abs(b - h) < 9 && (b - w >= 20 || h - w >= 23)) return 'hourglass';
  if (h - b >= 9) return 'pear';
  if (b - h >= 9) return 'inverted';
  return 'rectangle';
}

/**
 * Front-view widths. A woman's shoulders (deltoid to deltoid) are usually ~8 % wider than her
 * hips seen from the front, so "balanced" is shoulder/hip ≈ 1.0–1.2, not 1.0.
 */
export function shapeFromWidths(shoulder: number, waist: number, hip: number): BodyShape {
  const s = shoulder / hip;
  const wv = waist / Math.max(shoulder, hip);
  if (wv >= 0.86 && waist >= hip * 0.95) return 'apple';
  if (s <= 0.98) return 'pear';
  if (s >= 1.24) return 'inverted';
  if (wv <= 0.74) return 'hourglass';
  return 'rectangle';
}

export function analyzeSilhouette(w: number, h: number, labs: Lab[], bg: { lab: Lab; agree: number } | null): Silhouette | Issue {
  if (!bg) return 'busy-background';
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = deltaE(labs[i], bg.lab) > 13 ? 1 : 0;

  // body axis: mean x of the figure across the middle of the frame
  let sx = 0;
  let n = 0;
  for (let y = Math.round(h * 0.3); y < h * 0.7; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        sx += x;
        n++;
      }
  if (n < w * h * 0.03) return 'not-full-body';
  const cx = Math.round(sx / n);

  // Width per row: grow from the axis across the figure, bridging only single-pixel holes, so arms held
  // even slightly away from the body are left out. Below the crotch this reads one leg, which is
  // narrower than the hips and never wins the max.
  const bridge = 1;
  const widths = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let seed = -1;
    for (let d = 0; d < w * 0.08 && seed < 0; d++) {
      if (cx - d >= 0 && mask[row + cx - d]) seed = cx - d;
      else if (cx + d < w && mask[row + cx + d]) seed = cx + d;
    }
    if (seed < 0) continue;
    let l = seed;
    let r = seed;
    for (let x = seed - 1, g = 0; x >= 0 && g <= bridge; x--) {
      if (!mask[row + x]) g++;
      else {
        l = x;
        g = 0;
      }
    }
    for (let x = seed + 1, g = 0; x < w && g <= bridge; x++) {
      if (!mask[row + x]) g++;
      else {
        r = x;
        g = 0;
      }
    }
    widths[y] = r - l + 1;
  }
  const sm = widths.map((_, y) => {
    const v = [widths[Math.max(0, y - 1)], widths[y], widths[Math.min(h - 1, y + 1)]].sort((a, b) => a - b);
    return v[1];
  });
  const minW = Math.max(2, w * 0.02);
  let top = 0;
  while (top < h && sm[top] < minW) top++;
  let bottom = h - 1;
  while (bottom > top && sm[bottom] < minW) bottom--;
  const H = bottom - top + 1;
  if (H < h * 0.5) return 'not-full-body';

  const at = (a: number, b: number, pick: 'max' | 'min') => {
    let v = pick === 'max' ? 0 : Infinity;
    for (let y = Math.round(top + H * a); y <= Math.round(top + H * b); y++) {
      const x = sm[y];
      if (!x) continue;
      v = pick === 'max' ? Math.max(v, x) : Math.min(v, x);
    }
    return v === Infinity ? 0 : v;
  };
  const shoulder = at(0.15, 0.25, 'max');
  const waist = at(0.33, 0.45, 'min');
  const hip = at(0.46, 0.58, 'max');
  const head = at(0.03, 0.09, 'max');
  // A standing adult is about 4–4.6 shoulder widths tall; a photo cut at the knees is far less.
  if (!shoulder || !waist || !hip || H / shoulder < 3.3) return 'not-full-body';
  // Plausibility: a head narrower than the shoulders, and human proportions. Garment-only photos,
  // headless mannequins and group shots fail here instead of producing a confident wrong answer.
  const m0 = Math.max(shoulder, hip);
  if (head < shoulder * 0.2 || head > shoulder * 0.85 || shoulder / hip < 0.7 || shoulder / hip > 1.6 || waist / m0 < 0.45 || waist / m0 > 1.05)
    return 'not-full-body';

  // Hands resting on the hips show up as a sudden step in width; the hip reading is then unreliable.
  let step = false;
  for (let y = Math.round(top + H * 0.36); y < Math.round(top + H * 0.62); y++)
    if (sm[y] && sm[y + 1] - sm[y] >= Math.max(3, sm[y] * 0.15)) step = true;

  const m = Math.max(shoulder, hip);
  const proportionsOk = waist < m && H / shoulder < 6.5;
  let confidence = Math.max(0.2, Math.min(0.75, (bg.agree - 0.4) * 1.2 + (proportionsOk ? 0.15 : -0.2)));
  if (step) confidence = Math.min(confidence, 0.3);
  return { shape: shapeFromWidths(shoulder, waist, hip), shoulder: shoulder / m, waist: waist / m, hip: hip / m, confidence };
}

export function analyzePixels(px: Pixels): PortraitAnalysis {
  const { data, width: w, height: h } = px;
  const labs: Lab[] = new Array(w * h);
  let lsum = 0;
  for (let i = 0; i < w * h; i++) {
    labs[i] = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    lsum += labs[i][0];
  }
  const issues: Issue[] = [];
  if (lsum / (w * h) < 22) issues.push('too-dark');
  const bg = backgroundOf(labs, w, h);
  const coloring = analyzeColoring(px, bg?.lab ?? null, labs);
  if (!coloring) issues.push('no-skin');
  const sil = analyzeSilhouette(w, h, labs, bg);
  if (typeof sil === 'string') issues.push(sil);
  return { coloring, silhouette: typeof sil === 'string' ? null : sil, issues };
}

/** Decode an image (object URL or data URL) into a small pixel array and analyse it. */
export async function analyzePortrait(src: string): Promise<PortraitAnalysis> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image'));
    el.src = src;
  });
  const k = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(16, Math.round(img.naturalWidth * k));
  const h = Math.max(16, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, w, h);
  return analyzePixels({ data: ctx.getImageData(0, 0, w, h).data, width: w, height: h });
}

/* ───────────────────────── palettes ───────────────────────── */

export interface Swatch {
  hex: string;
  name: Localized;
}

const sw = (hex: string, uz: string, ru: string, en: string): Swatch => ({ hex, name: L(uz, ru, en) });

export const SEASONS: Record<Season, { name: Localized; about: Localized; best: Swatch[]; avoid: Swatch[] }> = {
  spring: {
    name: L('Bahor', 'Весна', 'Spring'),
    about: L(
      'Iliq va yorqin tus. Toza, quyoshli ranglar yuzingizni yoritadi; juda to‘q va kulrang ranglar charchagan ko‘rsatadi.',
      'Тёплый и светлый тип. Чистые, солнечные цвета освежают лицо; очень тёмные и серые — утомляют.',
      'Warm and clear. Clean, sunny colours light up your face; very dark and greyed colours look tired on you.',
    ),
    best: [
      sw('#F08A6C', 'Marjon', 'Коралл', 'Coral'),
      sw('#F6B48F', 'Shaftoli', 'Персик', 'Peach'),
      sw('#EBD460', 'Nargis sarig‘i', 'Нарцисс', 'Daffodil'),
      sw('#86C24A', 'Olma yashili', 'Яблочно-зелёный', 'Apple green'),
      sw('#3FB6B0', 'Firuza', 'Бирюза', 'Turquoise'),
      sw('#C9A27A', 'Och tuya juni', 'Светлый кэмел', 'Light camel'),
      sw('#F3EBD8', 'Fil suyagi', 'Слоновая кость', 'Ivory'),
      sw('#2E4A73', 'Iliq to‘q ko‘k', 'Тёплый тёмно-синий', 'Warm navy'),
    ],
    avoid: [sw('#151517', 'Qora', 'Чёрный', 'Black'), sw('#5B6064', 'Sovuq kulrang', 'Холодный серый', 'Cool grey'), sw('#5E2B38', 'To‘q olxo‘ri', 'Тёмная слива', 'Dark plum')],
  },
  summer: {
    name: L('Yoz', 'Лето', 'Summer'),
    about: L(
      'Sovuq va yumshoq tus. Changlangan, salqin ranglar sizga nafis turadi; to‘q sariq va oltinrang yuzni sarg‘aytiradi.',
      'Холодный и мягкий тип. Приглушённые прохладные цвета смотрятся изящно; оранжевый и золотистый желтят лицо.',
      'Cool and soft. Dusty, cool colours look refined on you; orange and gold make the skin look sallow.',
    ),
    best: [
      sw('#DDAEA2', 'Changlangan atirgul', 'Пыльная роза', 'Dusty rose'),
      sw('#B8A9D6', 'Lavanda', 'Лаванда', 'Lavender'),
      sw('#A9C4DE', 'Havo rang', 'Пудрово-голубой', 'Powder blue'),
      sw('#C7E3DE', 'Muzlik', 'Ледник', 'Glacier'),
      sw('#AFACAB', 'Tuman kulrangi', 'Туманный серый', 'Fog grey'),
      sw('#DE6A94', 'Gulxayri pushtisi', 'Мальва', 'Rose pink'),
      sw('#6A7FA0', 'Shifer ko‘ki', 'Сине-серый', 'Slate blue'),
      sw('#3A4A66', 'Yumshoq to‘q ko‘k', 'Мягкий тёмно-синий', 'Soft navy'),
    ],
    avoid: [sw('#E07B2A', 'To‘q sariq', 'Оранжевый', 'Orange'), sw('#D18E28', 'Za’faron', 'Шафран', 'Saffron'), sw('#865528', 'Dolchin', 'Корица', 'Cinnamon')],
  },
  autumn: {
    name: L('Kuz', 'Осень', 'Autumn'),
    about: L(
      'Iliq va chuqur tus. Yer ranglari, ziravor va o‘rmon tuslari sizga boylik beradi; muzdek pastel va qorday oq rang o‘chirib qo‘yadi.',
      'Тёплый и глубокий тип. Земляные, пряные и лесные оттенки — ваши; ледяные пастели и белоснежный гасят лицо.',
      'Warm and deep. Earth, spice and forest tones look rich on you; icy pastels and stark white wash you out.',
    ),
    best: [
      sw('#B5523A', 'Terrakota', 'Терракота', 'Terracotta'),
      sw('#D18E28', 'Za’faron', 'Шафран', 'Saffron'),
      sw('#865528', 'Dolchin', 'Корица', 'Cinnamon'),
      sw('#525B49', 'Zaytun', 'Олива', 'Olive'),
      sw('#B59473', 'Tuya juni', 'Кэмел', 'Camel'),
      sw('#1E5848', 'Zumrad', 'Изумруд', 'Emerald'),
      sw('#A79883', 'Xaki', 'Хаки', 'Khaki'),
      sw('#DED7C8', 'Ekru', 'Экрю', 'Ecru'),
    ],
    avoid: [sw('#CFE6EE', 'Muzdek ko‘k', 'Ледяной голубой', 'Icy blue'), sw('#C2185B', 'Fuksiya', 'Фуксия', 'Fuchsia'), sw('#FFFFFF', 'Qorday oq', 'Белоснежный', 'Stark white')],
  },
  winter: {
    name: L('Qish', 'Зима', 'Winter'),
    about: L(
      'Sovuq va kontrastli tus. Toza, to‘yingan va qora-oq ranglar sizga ajoyib turadi; xira bej va to‘q sariq yuzni xiralashtiradi.',
      'Холодный контрастный тип. Чистые насыщенные цвета и чёрно-белое — ваши; блёклый беж и оранжевый тускнят лицо.',
      'Cool and high-contrast. Clear, saturated colours and black-and-white suit you; muted beige and orange dull your face.',
    ),
    best: [
      sw('#F1EEEA', 'Oq', 'Белый', 'White'),
      sw('#151517', 'Qora', 'Чёрный', 'Black'),
      sw('#1C3149', 'To‘q indigo', 'Глубокий индиго', 'Deep indigo'),
      sw('#23698A', 'Samarqand ko‘ki', 'Самаркандская лазурь', 'Samarkand azure'),
      sw('#1D5A47', 'Zumrad', 'Изумруд', 'Emerald'),
      sw('#8D2432', 'Yoqut', 'Рубин', 'Ruby'),
      sw('#DE6A94', 'Yorqin pushti', 'Яркий розовый', 'Bright pink'),
      sw('#2A2D33', 'Ko‘mir', 'Уголь', 'Charcoal'),
    ],
    avoid: [sw('#D5CCBF', 'Suli rang', 'Овсяный', 'Oatmeal'), sw('#D18E28', 'Za’faron', 'Шафран', 'Saffron'), sw('#B59473', 'Tuya juni', 'Кэмел', 'Camel')],
  },
};

export const UNDERTONE_LABEL: Record<Undertone, Localized> = {
  warm: L('Iliq', 'Тёплый', 'Warm'),
  neutral: L('Neytral', 'Нейтральный', 'Neutral'),
  cool: L('Sovuq', 'Холодный', 'Cool'),
};
export const DEPTH_LABEL: Record<Depth, Localized> = {
  light: L('Och', 'Светлая', 'Light'),
  medium: L('O‘rta', 'Средняя', 'Medium'),
  deep: L('To‘q', 'Тёмная', 'Deep'),
};
export const CONTRAST_LABEL: Record<Contrast, Localized> = {
  low: L('past', 'низкий', 'low'),
  medium: L('o‘rtacha', 'средний', 'medium'),
  high: L('yuqori', 'высокий', 'high'),
};

/* ───────────────────────── styles ───────────────────────── */

interface Pick {
  key: GarmentTypeKey;
  why: Localized;
}

export const SHAPES: Record<BodyShape, { name: Localized; about: Localized; good: Pick[]; careful: Pick[] }> = {
  hourglass: {
    name: L('Qum soat', 'Песочные часы', 'Hourglass'),
    about: L('Yelka va son bir xil kenglikda, bel aniq ingichka. Belni ko‘rsatadigan fasonlar eng yaxshi.', 'Плечи и бёдра одной ширины, выраженная талия. Лучше всего фасоны, подчёркивающие талию.', 'Shoulders and hips match, with a defined waist. Styles that show the waist work best.'),
    good: [
      { key: 'slip_dress', why: L('Qiya bichim tana chizig‘i bo‘ylab tushadi', 'Крой по косой повторяет линии тела', 'The bias cut follows your curves') },
      { key: 'evening_gown', why: L('Belga yopishgan ustki qism belni ko‘rsatadi', 'Приталенный лиф подчёркивает талию', 'The fitted bodice shows off the waist') },
      { key: 'trench', why: L('Belbog‘ siluetni muvozanatli saqlaydi', 'Пояс сохраняет баланс силуэта', 'The belt keeps the silhouette balanced') },
      { key: 'strapless_cocktail', why: L('Korset beli va bando yelka chizig‘ini ochadi', 'Корсет и бандо открывают линию плеч', 'The corset and bandeau frame the shoulders') },
    ],
    careful: [
      { key: 'shirt', why: L('Oversayz bichim belni yashiradi — belbog‘ bilan kiying', 'Оверсайз скрывает талию — носите с поясом', 'Oversized hides the waist — add a belt') },
      { key: 'mondrian_dress', why: L('To‘g‘ri siluet belni yo‘qotadi', 'Прямой силуэт теряет талию', 'The straight cut loses your waist') },
    ],
  },
  pear: {
    name: L('Nok (uchburchak)', 'Груша (треугольник)', 'Pear (triangle)'),
    about: L('Son yelkadan kengroq. Ko‘zni yuqoriga tortadigan, etagi erkin tushadigan fasonlar mos.', 'Бёдра шире плеч. Подходят фасоны, уводящие взгляд вверх, со свободной юбкой.', 'Hips are wider than shoulders. Draw the eye up and let skirts fall freely.'),
    good: [
      { key: 'pleated_dress', why: L('A-siluet sonni yengil yopib o‘tadi', 'А-силуэт мягко скрывает бёдра', 'The A-line skims the hips') },
      { key: 'one_shoulder_gown', why: L('Asimmetrik yoqa e’tiborni yelkaga tortadi', 'Асимметричный вырез уводит взгляд к плечам', 'The asymmetric neckline draws the eye up') },
      { key: 'blazer', why: L('Aniq yelka chizig‘i sonni muvozanatlaydi', 'Чёткие плечи уравновешивают бёдра', 'Sharp shoulders balance the hips') },
      { key: 'jumpsuit', why: L('Keng shimlar son chizig‘ini tekislaydi', 'Широкие брюки выравнивают линию бёдер', 'Wide legs even out the hip line') },
    ],
    careful: [
      { key: 'slip_dress', why: L('Yupqa mato sonni ta’kidlaydi — og‘irroq mato tanlang', 'Тонкая ткань подчёркивает бёдра — выберите плотнее', 'Thin cloth clings to the hips — choose a heavier one') },
      { key: 'mondrian_dress', why: L('To‘g‘ri bichim son qismida tor bo‘ladi', 'Прямой крой узок в бёдрах', 'The straight cut is tight at the hips') },
    ],
  },
  inverted: {
    name: L('Teskari uchburchak', 'Перевёрнутый треугольник', 'Inverted triangle'),
    about: L('Yelka sondan keng. Pastki qismga hajm beradigan, yelkani yumshatadigan fasonlar mos.', 'Плечи шире бёдер. Подходят фасоны с объёмом внизу и мягкой линией плеч.', 'Shoulders are wider than hips. Add volume below and soften the shoulders.'),
    good: [
      { key: 'pleated_dress', why: L('Burmali etak pastga hajm qo‘shadi', 'Юбка в складку добавляет объём внизу', 'The pleated skirt adds volume below') },
      { key: 'jumpsuit', why: L('Keng shimlar yelkani muvozanatlaydi', 'Широкие брюки уравновешивают плечи', 'Wide legs balance the shoulders') },
      { key: 'evening_gown', why: L('Keng etak siluetni tenglashtiradi', 'Пышная юбка выравнивает силуэт', 'The full skirt evens the silhouette') },
      { key: 'slip_dress', why: L('Ingichka bog‘ichlar yelkani yengil ko‘rsatadi', 'Тонкие бретели облегчают плечи', 'Thin straps make the shoulders look lighter') },
    ],
    careful: [
      { key: 'blazer', why: L('Qattiq yelka yelkani yanada kengaytiradi', 'Жёсткие плечи ещё больше расширяют', 'Structured shoulders widen you further') },
      { key: 'strapless_cocktail', why: L('Gorizontal yoqa yelkani kengaytiradi', 'Горизонтальный вырез расширяет плечи', 'The straight neckline widens the shoulders') },
    ],
  },
  rectangle: {
    name: L('To‘g‘ri to‘rtburchak', 'Прямоугольник', 'Rectangle'),
    about: L('Yelka, bel va son deyarli bir xil. Belni “yaratadigan” belbog‘li va burmali fasonlar mos.', 'Плечи, талия и бёдра почти одинаковы. Подходят фасоны с поясом и складками, «создающие» талию.', 'Shoulders, waist and hips are close. Belts and pleats that create a waist work best.'),
    good: [
      { key: 'trench', why: L('Belbog‘ belni hosil qiladi', 'Пояс создаёт талию', 'The belt creates a waist') },
      { key: 'kimono', why: L('O‘ralma old qism va belbog‘ egri chiziq beradi', 'Запах и пояс добавляют изгибы', 'The wrap and sash add curves') },
      { key: 'pleated_dress', why: L('Burmalar beldan hajm beradi', 'Складки дают объём от талии', 'Pleats add shape from the waist') },
      { key: 'jumpsuit', why: L('Baland bel proporsiyani yaxshilaydi', 'Высокая талия улучшает пропорции', 'The high waist improves proportions') },
    ],
    careful: [{ key: 'mondrian_dress', why: L('To‘g‘ri bichim — belbog‘ bilan kiying', 'Прямой крой — носите с поясом', 'Straight cut — wear it with a belt') }],
  },
  apple: {
    name: L('Olma (oval)', 'Яблоко (овал)', 'Apple (oval)'),
    about: L('Hajm tananing o‘rtasida. Vertikal chiziq beradigan, beldan yopishmaydigan fasonlar mos.', 'Объём в центре фигуры. Подходят фасоны с вертикальной линией, не облегающие талию.', 'Volume sits at the middle. Vertical lines and styles that skim the waist work best.'),
    good: [
      { key: 'kimono', why: L('Ochiq old qism uzun vertikal chiziq beradi', 'Открытый перёд даёт длинную вертикаль', 'The open front makes a long vertical line') },
      { key: 'shirt', why: L('Erkin bichim belga yopishmaydi', 'Свободный крой не облегает талию', 'The relaxed cut skims the waist') },
      { key: 'one_shoulder_gown', why: L('Diagonal yoqa va tik siluet cho‘zib ko‘rsatadi', 'Диагональ и прямой силуэт вытягивают', 'The diagonal neckline and column lengthen you') },
      { key: 'mondrian_dress', why: L('To‘g‘ri siluet o‘rtani yengil yopadi', 'Прямой силуэт мягко скрывает середину', 'The shift skims the middle') },
    ],
    careful: [
      { key: 'strapless_cocktail', why: L('Korset bel qismini siqadi', 'Корсет стягивает талию', 'The corset squeezes the middle') },
      { key: 'trench', why: L('Belbog‘siz, ochiq holda kiying', 'Носите без пояса, нараспашку', 'Wear it open, without the belt') },
    ],
  },
};

/* ───────────────────────── catalogue matching ───────────────────────── */

export interface ColorMatch {
  fabric: Fabric;
  color: ColorOption;
  /** 0…99, closeness to the palette */
  score: number;
  swatch: Swatch;
}

const labCache = new Map<string, Lab>();
const lab = (hex: string) => {
  let v = labCache.get(hex);
  if (!v) labCache.set(hex, (v = hexToLab(hex)));
  return v;
};

export function colorScore(hex: string, season: Season) {
  const p = SEASONS[season];
  const c = lab(hex);
  let best = p.best[0];
  let d = Infinity;
  for (const s of p.best) {
    const x = deltaE(c, lab(s.hex));
    if (x < d) {
      d = x;
      best = s;
    }
  }
  const avoid = Math.min(...p.avoid.map((s) => deltaE(c, lab(s.hex))));
  const score = 100 - d * 2.4 - Math.max(0, 16 - avoid) * 2;
  return { score: Math.round(Math.max(0, Math.min(99, score))), swatch: best };
}

const inStock = (c: ColorOption) => c.stockM === undefined || c.stockM > 0;

/** Best colourways for the season, at most `perFabric` per fabric. */
export function matchFabrics(fabrics: Fabric[], season: Season, limit = 8, perFabric = 2): ColorMatch[] {
  const all: ColorMatch[] = [];
  for (const f of fabrics)
    for (const c of f.colors) {
      if (!inStock(c)) continue;
      const { score, swatch } = colorScore(c.hex, season);
      if (score >= 40) all.push({ fabric: f, color: c, score, swatch });
    }
  all.sort((a, b) => b.score - a.score);
  const count = new Map<string, number>();
  return all
    .filter((m) => {
      const k = (count.get(m.fabric.id) ?? 0) + 1;
      count.set(m.fabric.id, k);
      return k <= perFabric;
    })
    .slice(0, limit);
}

export interface StyleRec {
  garment: GarmentSilhouette;
  why: Localized;
  fabric?: Fabric;
  color?: ColorOption;
  colorScore?: number;
}

/** For each recommended silhouette, the catalogue colourway that both flatters and drapes right. */
export function recommendStyles(fabrics: Fabric[], shape: BodyShape, season: Season): { good: StyleRec[]; careful: StyleRec[] } {
  // spread the suggestions over different colourways instead of one favourite for every style
  const usedColors = new Set<string>();
  const usedFabrics = new Set<string>();
  const build = (p: Pick): StyleRec | null => {
    const garment = GARMENTS.find((g) => g.typeKey === p.key);
    if (!garment) return null;
    let best: { f: Fabric; c: ColorOption; s: number; cs: number } | null = null;
    for (const f of fabrics) {
      const fit = suitability(garment, f);
      if (fit < 0.55) continue;
      for (const c of f.colors) {
        if (!inStock(c)) continue;
        const cs = colorScore(c.hex, season).score;
        const s = cs * 0.65 + fit * 35 - (usedColors.has(`${f.id}/${c.id}`) ? 18 : 0) - (usedFabrics.has(f.id) ? 5 : 0);
        if (!best || s > best.s) best = { f, c, s, cs };
      }
    }
    if (best) {
      usedColors.add(`${best.f.id}/${best.c.id}`);
      usedFabrics.add(best.f.id);
    }
    return { garment, why: p.why, fabric: best?.f, color: best?.c, colorScore: best?.cs };
  };
  const s = SHAPES[shape];
  return {
    good: s.good.map(build).filter((x): x is StyleRec => !!x),
    careful: s.careful.map(build).filter((x): x is StyleRec => !!x),
  };
}
