import { DEFAULT_TAILORS, Tailor } from '../data/tailors';
import { KEYS, load, save } from './storage';

/**
 * Tailors list shared with the admin panel. Default ateliers always come from the
 * code (so updates reach returning visitors); ateliers registered on the site are kept.
 */
export function loadTailors(): Tailor[] {
  const stored = load<Tailor[] | null>(KEYS.tailors, null);
  const defaults = new Set(DEFAULT_TAILORS.map((t) => t.id));
  const registered = (Array.isArray(stored) ? stored : [])
    .filter((t) => t && !defaults.has(t.id) && t.name)
    .map((t) => ({
      ...t,
      leadDays: t.leadDays ?? 14,
      // a new atelier has no rating until real reviews arrive
      rating: (t.reviewsCount ?? 0) > 1 ? t.rating : null,
    }));
  const list = [...registered, ...DEFAULT_TAILORS];
  save(KEYS.tailors, list);
  return list;
}

export function saveTailors(list: Tailor[]) {
  save(KEYS.tailors, list);
}
