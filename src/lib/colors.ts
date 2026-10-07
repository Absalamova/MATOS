import { L } from './i18n';

export const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', '').padEnd(6, '0'), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** sRGB → CIE Lab (D65) */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export const hexToLab = (hex: string) => rgbToLab(...hexToRgb(hex));

/** CIE94 colour difference — closer to how people judge "same colour" than RGB distance. */
export function deltaE(a: [number, number, number], b: [number, number, number]) {
  const dL = a[0] - b[0];
  const C1 = Math.hypot(a[1], a[2]);
  const C2 = Math.hypot(b[1], b[2]);
  const dC = C1 - C2;
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  const dH2 = Math.max(0, da * da + db * db - dC * dC);
  const sC = 1 + 0.045 * C1;
  const sH = 1 + 0.015 * C1;
  return Math.sqrt(dL * dL + (dC / sC) ** 2 + dH2 / (sH * sH));
}

export type ColorFamily = 'white' | 'black' | 'grey' | 'blue' | 'green' | 'red' | 'pink' | 'yellow' | 'brown';

export const COLOR_FAMILIES: { id: ColorFamily; label: ReturnType<typeof L>; swatch: string }[] = [
  { id: 'white', label: L('Oq', 'Белый', 'White'), swatch: '#F1EEEA' },
  { id: 'black', label: L('Qora', 'Чёрный', 'Black'), swatch: '#1C1B1D' },
  { id: 'grey', label: L('Kulrang', 'Серый', 'Grey'), swatch: '#9A9896' },
  { id: 'blue', label: L('Ko‘k', 'Синий', 'Blue'), swatch: '#2B4A73' },
  { id: 'green', label: L('Yashil', 'Зелёный', 'Green'), swatch: '#3E6B4C' },
  { id: 'red', label: L('Qizil', 'Красный', 'Red'), swatch: '#9E2E32' },
  { id: 'pink', label: L('Pushti', 'Розовый', 'Pink'), swatch: '#DE8FA6' },
  { id: 'yellow', label: L('Sariq', 'Жёлтый', 'Yellow'), swatch: '#E9C84A' },
  { id: 'brown', label: L('Jigarrang', 'Коричневый', 'Brown'), swatch: '#8A5A34' },
];

export function colorFamily(hex: string): ColorFamily {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if (l > 0.86 && s < 0.5) return 'white';
  if (l < 0.16) return 'black';
  if (s < 0.14) return l > 0.8 ? 'white' : 'grey';
  if (h < 15 || h >= 340) return l > 0.62 ? 'pink' : 'red';
  if (h < 45) return l > 0.7 ? 'pink' : l < 0.5 || s < 0.45 ? 'brown' : 'yellow';
  if (h < 70) return l < 0.4 ? 'brown' : 'yellow';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  if (h < 300) return 'blue';
  return l > 0.55 ? 'pink' : 'red';
}

export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
