export type Language = 'uz' | 'ru' | 'en';
export type Currency = 'UZS' | 'USD' | 'EUR';
export type UnitSystem = 'metric' | 'imperial';
export type SizeStandard = 'INT' | 'EU' | 'US' | 'UK';

export interface Localized {
  uz: string;
  ru: string;
  en: string;
}

/** How the weave looks up close — drives procedural textures and the 3D material. */
export type WeavePattern = 'plain' | 'gingham' | 'canvas' | 'ikat' | 'crepe' | 'jersey' | 'twill';

export interface FabricPhotos {
  swatch: string;
  hang: string;
  roll: string;
  ruler: string;
  /** Seamless 512px tile made from the ruler photo, used as the 3D texture. */
  tile: string;
}

export interface ColorOption {
  id: string;
  name: Localized;
  hex: string;
  roughness: number;
  metalness: number;
  sheen?: number;
  photos?: FabricPhotos;
}

export type FabricCategory = 'linen' | 'silk' | 'wool' | 'cotton';

export interface Fabric {
  id: string;
  name: Localized;
  category: FabricCategory;
  categoryLabel: Localized;
  organic: boolean;
  pattern: WeavePattern;
  origin: Localized;
  seller: { name: string; city: Localized };
  weightCategory: 'light' | 'mid' | 'heavy';
  gsm: number;
  ozPerSqYd: number;
  widthCm: number;
  widthInches: number;
  composition: Localized;
  priceUZS: number;
  priceUSD: number;
  priceEUR: number;
  /** 1 (stiff) … 10 (liquid) */
  drapeFactor: number;
  drapeText: Localized;
  certifications: string[];
  shrinkageRate: number;
  care: Localized;
  description: Localized;
  colors: ColorOption[];
  /** Garment type keys this fabric suits best (used for recommendations). */
  bestFor: GarmentTypeKey[];
}

export type GarmentTypeKey =
  | 'slip_dress'
  | 'evening_gown'
  | 'blazer'
  | 'trench'
  | 'kimono'
  | 'jumpsuit'
  | 'shirt'
  | 'pleated_dress'
  | 'one_shoulder_gown'
  | 'strapless_cocktail'
  | 'mondrian_dress';

export interface GarmentSilhouette {
  id: string;
  name: Localized;
  typeKey: GarmentTypeKey;
  group: 'dress' | 'outerwear' | 'top' | 'set';
  estimatedMeters: number;
  estimatedYards: number;
  /** Fabrics in this range sit best on the silhouette. */
  fit: { minGsm: number; maxGsm: number; minDrape: number };
  difficulty: Localized;
  description: Localized;
}

export interface SavedMeasurements {
  heightCm: number;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
  sizeINT: string;
  sizeEU: string;
  sizeUS: string;
  sizeUK: string;
}

export interface User {
  id: string;
  name: string;
  identifier: string; // phone or email
  password?: string;
  measurements: SavedMeasurements;
  registeredAt: string;
}

/** Cart lines are stored in metres and priced live from the catalog, so currency/unit switches stay correct. */
export interface CartItem {
  id: string;
  fabricId: string;
  colorId: string;
  meters: number;
  garmentKey?: GarmentTypeKey;
}

export interface SwatchItem {
  fabricId: string;
  colorId: string;
}

export type LightingPreset = 'daylight' | 'atelier' | 'evening';

export interface BodyMeasurements {
  heightCm: number;
  bustCm: number;
  waistCm: number;
  hipsCm: number;
}
