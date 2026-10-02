export type Language = 'uz' | 'ru' | 'en';
export type Currency = 'UZS' | 'USD' | 'EUR';
export type UnitSystem = 'metric' | 'imperial';
export type SizeStandard = 'INT' | 'EU' | 'US' | 'UK';

export interface ColorOption {
  id: string;
  name: {
    uz: string;
    ru: string;
    en: string;
  };
  hex: string;
  roughness: number;
  metalness: number;
  sheen?: number;
}

export interface Fabric {
  id: string;
  name: string;
  category: 'linen-mid' | 'linen-heavy' | 'linen-organic' | 'milliy-silk' | 'wool-cashmere' | 'cotton-twill';
  categoryLabel: {
    uz: string;
    ru: string;
    en: string;
  };
  origin: string;
  weightCategory: 'light' | 'mid' | 'heavy';
  gsm: number;
  ozPerSqYd: number;
  widthCm: number;
  widthInches: number;
  composition: {
    uz: string;
    ru: string;
    en: string;
  };
  priceUZS: number;
  priceUSD: number;
  priceEUR: number;
  drapeFactor: number; // 1-10
  drapeText: {
    uz: string;
    ru: string;
    en: string;
  };
  certifications: string[];
  shrinkageRate: number; // percentage, e.g. 2.5%
  cssClass: string;
  description: {
    uz: string;
    ru: string;
    en: string;
  };
  colors: ColorOption[];
}

export interface GarmentSilhouette {
  id: string;
  name: {
    uz: string;
    ru: string;
    en: string;
  };
  typeKey:
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
  estimatedMeters: number;
  estimatedYards: number;
  difficulty: {
    uz: string;
    ru: string;
    en: string;
  };
  description: {
    uz: string;
    ru: string;
    en: string;
  };
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

export interface CartItem {
  id: string;
  fabricId: string;
  fabricName: string;
  color: ColorOption;
  quantity: number; // in meters or yards
  unit: 'm' | 'yd';
  pricePerUnit: number;
  totalPrice: number;
  currency: Currency;
  cssClass: string;
  gsm: number;
  width: string;
}

export interface DrapePreset {
  lighting: 'daylight' | 'atelier' | 'evening';
  windSpeed: number;
  viewAngle: 'front' | 'threeQuarter' | 'side' | 'back';
}
