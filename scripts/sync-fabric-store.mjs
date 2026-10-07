/**
 * Sync script: downloads the "Exclusive Linens" collection from wearethefabricstore.com
 * (public Shopify JSON endpoint) and stores product photos locally under
 * public/images/fabrics/<handle>/<kind>.jpg so that the catalog, 3D studio and the
 * visual (camera) search can work offline and same-origin (canvas pixel access).
 *
 * Usage:  node scripts/sync-fabric-store.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'images', 'fabrics');
const COLLECTION = 'https://wearethefabricstore.com/collections/exclusive-linens/products.json';

const kindOf = (src) => {
  const name = src.split('/').pop().toLowerCase();
  if (name.includes('swatc')) return 'swatch'; // store has a typo'd file ("Swatcj")
  if (name.includes('hang')) return 'hang';
  if (name.includes('roll')) return 'roll';
  if (name.includes('ruler')) return 'ruler';
  return null;
};

const products = [];
for (let page = 1; page < 10; page++) {
  const res = await fetch(`${COLLECTION}?limit=250&page=${page}`, { headers: { 'User-Agent': 'Mozilla/5.0 MATOS-sync' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.products?.length) break;
  products.push(...json.products);
}

const manifest = [];
for (const p of products) {
  const dir = path.join(outDir, p.handle);
  fs.mkdirSync(dir, { recursive: true });
  const saved = {};
  for (const img of p.images) {
    const kind = kindOf(img.src);
    if (!kind || saved[kind]) continue;
    const url = img.src + (img.src.includes('?') ? '&' : '?') + 'width=900';
    const file = path.join(dir, `${kind}.jpg`);
    if (!fs.existsSync(file)) {
      const r = await fetch(url);
      if (!r.ok) {
        console.warn('skip', url, r.status);
        continue;
      }
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    saved[kind] = `/images/fabrics/${p.handle}/${kind}.jpg`;
  }
  manifest.push({ title: p.title, handle: p.handle, images: saved });
  console.log('✓', p.title, Object.keys(saved).join(','));
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Done: ${manifest.length} products`);
