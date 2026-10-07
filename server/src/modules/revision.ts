/** Incremented on every write that changes what /api/catalog returns, so the cached response can be reused until then. */
let revision = 1;
export const bumpCatalog = () => {
  revision++;
};
export const catalogRevision = () => revision;
