import type { Db } from '../db.ts';
import { json, nowIso } from '../db.ts';
import { DEFAULT_SETTINGS } from '../../../shared/pricing.ts';
import type { StoreSettings } from '../../../shared/types.ts';
import { v } from '../lib/validate.ts';
import { bumpCatalog } from './revision.ts';

export function getSettings(db: Db): StoreSettings {
  const row = db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'store'");
  const saved = json<Partial<StoreSettings>>(row?.value, {});
  return { ...DEFAULT_SETTINGS, ...saved, rates: { ...DEFAULT_SETTINGS.rates, ...(saved.rates ?? {}) } };
}

export function saveSettings(db: Db, next: StoreSettings) {
  db.run(
    "INSERT INTO settings (key, value, updated_at) VALUES ('store', ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    JSON.stringify(next),
    nowIso(),
  );
  bumpCatalog();
  return getSettings(db);
}

export const settingsSchema = v.object({
  rates: v.object({
    USD: v.number({ min: 1000, max: 100000 }),
    EUR: v.number({ min: 1000, max: 100000 }),
  }),
  deliveryFeeUZS: v.number({ min: 0, max: 5_000_000, int: true }),
  freeDeliveryFromUZS: v.number({ min: 0, max: 1_000_000_000, int: true }),
  pickupAddress: v.string({ max: 300 }),
  supportPhone: v.string({ min: 0, max: 40 }).default(''),
  maxSamples: v.number({ min: 1, max: 10, int: true }),
});
