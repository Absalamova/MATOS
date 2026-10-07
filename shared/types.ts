/**
 * Domain and API types shared by the store (src/), the admin app (admin/) and the API server (server/).
 * Server code runs these files directly with Node's type stripping, so: type-only exports,
 * no enums/namespaces, and relative imports with explicit `.ts` extensions.
 */

export type Language = 'uz' | 'ru' | 'en';
export type Currency = 'UZS' | 'USD' | 'EUR';
export type UnitSystem = 'metric' | 'imperial';

export interface Localized {
  uz: string;
  ru: string;
  en: string;
}

/* ───────────── Catalog ───────────── */

/** How the weave looks up close — drives procedural textures and the 3D material. */
export type WeavePattern = 'plain' | 'gingham' | 'canvas' | 'ikat' | 'crepe' | 'jersey' | 'twill';
export type FabricCategory = 'linen' | 'silk' | 'wool' | 'cotton';
export type WeightCategory = 'light' | 'mid' | 'heavy';

export interface FabricPhotos {
  swatch: string;
  hang: string;
  roll: string;
  ruler: string;
  /** Seamless 512px tile used as the 3D texture. Empty → a procedural weave is drawn. */
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
  /** Metres in stock. Undefined in the bundled offline catalog (treated as available). */
  stockM?: number;
}

export interface Fabric {
  id: string;
  name: Localized;
  category: FabricCategory;
  categoryLabel: Localized;
  organic: boolean;
  pattern: WeavePattern;
  origin: Localized;
  seller: { name: string; city: Localized };
  weightCategory: WeightCategory;
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

/* ───────────── People ───────────── */

export interface BodyMeasurements {
  heightCm: number;
  bustCm: number;
  waistCm: number;
  hipsCm: number;
}

/** A signed-in shopper. */
export interface User {
  id: number;
  name: string;
  /** Normalised: 998901234567 */
  phone: string;
  email: string | null;
  measurements: BodyMeasurements | null;
  createdAt: string;
}

export type SpecialtyKey = 'couture' | 'suit' | 'linen' | 'silk_chopon' | 'pants_jumpsuit';

export interface Tailor {
  id: string;
  name: string;
  atelierName: string;
  city: string;
  district: string;
  specialtyKey: SpecialtyKey;
  specialtyLabel: Localized;
  experienceYears: number;
  /** null until the atelier has real reviews */
  rating: number | null;
  reviewsCount: number;
  completedOrders: number;
  priceStartingUZS: number;
  /** Typical lead time in days */
  leadDays: number;
  phone: string;
  telegram: string;
  address: string;
  description: Localized;
}

export type TailorStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

/* ───────────── Cart & orders ───────────── */

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

export type OrderKind = 'fabric' | 'sample';
export type OrderStatus = 'new' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export type TailorRequestStatus = 'new' | 'contacted' | 'in_progress' | 'done' | 'cancelled';
export type DeliveryMethod = 'courier' | 'pickup';
export type PaymentMethod = 'cash' | 'card';

export interface OrderItemDTO {
  fabricId: string;
  colorId: string;
  fabricName: Localized;
  colorName: Localized;
  colorHex: string;
  /** Snapshot of the colour's main photo at order time (may be empty). */
  photo: string;
  meters: number;
  /** Price of one metre at order time. */
  priceUZS: number;
  amountUZS: number;
  garmentKey: GarmentTypeKey | null;
}

export interface OrderDTO {
  id: number;
  number: string;
  kind: OrderKind;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  delivery: { method: DeliveryMethod; city: string | null; address: string | null };
  payment: PaymentMethod | null;
  note: string | null;
  subtotalUZS: number;
  deliveryUZS: number;
  totalUZS: number;
  items: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderEventDTO {
  status: OrderStatus;
  note: string | null;
  actor: string;
  createdAt: string;
}

export interface AdminOrderDTO extends OrderDTO {
  userId: number | null;
  adminNote: string | null;
  events: OrderEventDTO[];
}

export interface TailorRequestDTO {
  id: number;
  number: string;
  status: TailorRequestStatus;
  tailor: { id: string; name: string; atelierName: string; city: string; phone: string; telegram: string };
  garmentKey: GarmentTypeKey;
  fabricId: string | null;
  colorId: string | null;
  fabricLabel: string;
  measurements: BodyMeasurements | null;
  note: string | null;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTailorRequestDTO extends TailorRequestDTO {
  userId: number | null;
  adminNote: string | null;
}

/* ───────────── API payloads ───────────── */

export interface StoreSettings {
  /** UZS per 1 USD / 1 EUR */
  rates: { USD: number; EUR: number };
  deliveryFeeUZS: number;
  freeDeliveryFromUZS: number;
  pickupAddress: string;
  supportPhone: string;
  maxSamples: number;
}

export interface CatalogResponse {
  fabrics: Fabric[];
  settings: StoreSettings;
  updatedAt: string;
}

export interface CheckoutInput {
  customer: { name: string; phone: string };
  delivery: { method: DeliveryMethod; city?: string; address?: string };
  payment: PaymentMethod;
  note?: string;
  items: { fabricId: string; colorId: string; meters: number; garmentKey?: GarmentTypeKey }[];
  samples: { fabricId: string; colorId: string }[];
}

export interface CheckoutResult {
  orders: { number: string; kind: OrderKind; totalUZS: number }[];
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface MyHistory {
  orders: OrderDTO[];
  tailorRequests: TailorRequestDTO[];
}

export interface TailorApplication {
  name: string;
  atelierName: string;
  city: string;
  district?: string;
  specialtyKey: SpecialtyKey;
  experienceYears: number;
  priceStartingUZS: number;
  phone: string;
  telegram?: string;
  description?: string;
}

export interface TailorRequestInput {
  tailorId: string;
  garmentKey: GarmentTypeKey;
  fabricId?: string;
  colorId?: string;
  customer: { name: string; phone: string };
  measurements?: BodyMeasurements;
  note?: string;
}

/** Error body returned by the API: `{ error: ApiErrorBody }` */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** Per-field validation messages (field path → message). */
  fields?: Record<string, string>;
}

/* ───────────── Admin ───────────── */

export type AdminRole = 'owner' | 'manager';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
}

export type FabricStatus = 'active' | 'hidden';

export interface AdminColor extends ColorOption {
  stockM: number;
  active: boolean;
}

/** Full fabric record as edited in the admin app. */
export interface AdminFabric extends Omit<Fabric, 'colors' | 'priceUSD' | 'priceEUR' | 'ozPerSqYd' | 'widthInches' | 'weightCategory' | 'categoryLabel'> {
  status: FabricStatus;
  sort: number;
  colors: AdminColor[];
  createdAt: string;
  updatedAt: string;
}

/** What the admin form sends: new colours have no id yet. */
export type AdminColorInput = Omit<AdminColor, 'id'> & { id?: string };
export type AdminFabricInput = Omit<AdminFabric, 'id' | 'createdAt' | 'updatedAt' | 'colors'> & { colors: AdminColorInput[] };

export interface AdminCustomer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  status: 'active' | 'blocked';
  ordersCount: number;
  totalSpentUZS: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminTailor extends Tailor {
  status: TailorStatus;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  counts: {
    newOrders: number;
    newSamples: number;
    newTailorRequests: number;
    pendingTailors: number;
    customers: number;
    lowStock: number;
  };
  revenue: { todayUZS: number; weekUZS: number; monthUZS: number };
  ordersByDay: { date: string; count: number; totalUZS: number }[];
  latest: OrderDTO[];
  lowStock: { fabricId: string; fabricName: string; colorId: string; colorName: string; stockM: number }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
