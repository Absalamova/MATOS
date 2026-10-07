import type { Currency, DeliveryMethod, StoreSettings } from './types.ts';

/** Used until the API answers, and as the server's first-run settings. */
export const DEFAULT_SETTINGS: StoreSettings = {
  rates: { USD: 12700, EUR: 13650 },
  deliveryFeeUZS: 25000,
  freeDeliveryFromUZS: 1000000,
  pickupAddress: 'Toshkent, Chilonzor showroom — har kuni 10:00–20:00',
  supportPhone: '',
  maxSamples: 5,
};

export const MAX_ITEM_METERS = 100;
export const MIN_ITEM_METERS = 0.5;

/** Delivery is free for pickup, for sample-only orders and above the free-delivery threshold. */
export function deliveryFeeUZS(subtotalUZS: number, method: DeliveryMethod, settings: Pick<StoreSettings, 'deliveryFeeUZS' | 'freeDeliveryFromUZS'>, hasFabric: boolean) {
  if (!hasFabric || method === 'pickup') return 0;
  return subtotalUZS >= settings.freeDeliveryFromUZS ? 0 : settings.deliveryFeeUZS;
}

/** Converts a so‘m amount for display in another currency. */
export function fromUZS(amountUZS: number, currency: Currency, rates: StoreSettings['rates']) {
  if (currency === 'UZS') return amountUZS;
  const rate = currency === 'USD' ? rates.USD : rates.EUR;
  return rate > 0 ? amountUZS / rate : 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
