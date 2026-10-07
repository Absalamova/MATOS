import { BodyMeasurements, Fabric, GarmentSilhouette } from '../types';

export const DEFAULT_MEASUREMENTS: BodyMeasurements = { heightCm: 168, bustCm: 88, waistCm: 68, hipsCm: 94 };

export const MEASURE_LIMITS = {
  heightCm: [140, 200],
  bustCm: [70, 140],
  waistCm: [52, 130],
  hipsCm: [76, 150],
} as const;

export const clampMeasurements = (m: BodyMeasurements): BodyMeasurements => ({
  heightCm: Math.min(MEASURE_LIMITS.heightCm[1], Math.max(MEASURE_LIMITS.heightCm[0], m.heightCm)),
  bustCm: Math.min(MEASURE_LIMITS.bustCm[1], Math.max(MEASURE_LIMITS.bustCm[0], m.bustCm)),
  waistCm: Math.min(MEASURE_LIMITS.waistCm[1], Math.max(MEASURE_LIMITS.waistCm[0], m.waistCm)),
  hipsCm: Math.min(MEASURE_LIMITS.hipsCm[1], Math.max(MEASURE_LIMITS.hipsCm[0], m.hipsCm)),
});

/** Women's size from bust/hips (EU table 80/86 … 112/118). */
export function sizeFor(m: BodyMeasurements) {
  const table = [
    { eu: 32, int: 'XXS', us: 0, uk: 4, bust: 80, hips: 86 },
    { eu: 34, int: 'XS', us: 2, uk: 6, bust: 84, hips: 90 },
    { eu: 36, int: 'S', us: 4, uk: 8, bust: 88, hips: 94 },
    { eu: 38, int: 'M', us: 6, uk: 10, bust: 92, hips: 98 },
    { eu: 40, int: 'M', us: 8, uk: 12, bust: 96, hips: 102 },
    { eu: 42, int: 'L', us: 10, uk: 14, bust: 100, hips: 106 },
    { eu: 44, int: 'XL', us: 12, uk: 16, bust: 104, hips: 110 },
    { eu: 46, int: 'XL', us: 14, uk: 18, bust: 108, hips: 114 },
    { eu: 48, int: 'XXL', us: 16, uk: 20, bust: 112, hips: 118 },
  ];
  const row = table.find((r) => m.bustCm <= r.bust + 1 && m.hipsCm <= r.hips + 1) ?? table[table.length - 1];
  return { INT: row.int, EU: `EU ${row.eu}`, US: `US ${row.us}`, UK: `UK ${row.uk}` };
}

export interface MetersBreakdown {
  meters: number;
  base: number;
  heightAdd: number;
  sizeAdd: number;
  widthFactor: number;
  shrinkAdd: number;
  patternAdd: number;
}

/**
 * Fabric length for one garment. Pattern estimates assume 140–150 cm wide cloth,
 * a 168 cm figure and size S; we scale for height, size, width, shrinkage and print matching.
 */
export function requiredMeters(g: GarmentSilhouette, f: Fabric, m: BodyMeasurements): MetersBreakdown {
  const base = g.estimatedMeters;
  const longGarment = ['evening_gown', 'one_shoulder_gown', 'trench', 'jumpsuit', 'kimono'].includes(g.typeKey);
  const heightAdd = (m.heightCm - 168) * (longGarment ? 0.014 : 0.008);
  const girth = Math.max(m.bustCm / 88, m.hipsCm / 94, m.waistCm / 68 * 0.9);
  const sizeAdd = Math.max(-0.2, (girth - 1) * base * 0.55);
  const widthFactor = f.widthCm >= 140 ? 1 : f.widthCm >= 110 ? 1.25 : 140 / f.widthCm * 0.92;
  const subtotal = (base + heightAdd + sizeAdd) * widthFactor;
  const shrinkAdd = subtotal * (f.shrinkageRate / 100);
  const patternAdd = f.pattern === 'gingham' || f.pattern === 'ikat' ? subtotal * 0.08 : 0;
  const meters = Math.max(1, Math.ceil((subtotal + shrinkAdd + patternAdd) * 10) / 10);
  return { meters, base, heightAdd, sizeAdd, widthFactor, shrinkAdd, patternAdd };
}

/** How well a fabric suits a silhouette, 0…1 (weight range, drape, and the seller's own recommendation). */
export function suitability(g: GarmentSilhouette, f: Fabric) {
  let s = 0;
  if (f.gsm >= g.fit.minGsm && f.gsm <= g.fit.maxGsm) s += 0.45;
  else s += Math.max(0, 0.45 - Math.min(Math.abs(f.gsm - g.fit.minGsm), Math.abs(f.gsm - g.fit.maxGsm)) / 200);
  if (f.drapeFactor >= g.fit.minDrape) s += 0.3;
  else s += Math.max(0, 0.3 - (g.fit.minDrape - f.drapeFactor) * 0.15);
  if (f.bestFor.includes(g.typeKey)) s += 0.25;
  return Math.min(1, s);
}
