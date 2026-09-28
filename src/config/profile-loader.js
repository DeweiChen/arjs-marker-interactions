/**
 * Profile Loader
 * Collects every `src/config/profiles/<id>.json` at build time. The file name
 * (without extension) is the profile id used by `?p=<id>` / `#<id>`.
 * Files starting with `_` (e.g. `_template.jsonc`) are ignored.
 *
 * Profiles are ordered by their optional `order` field, then by id;
 * `default` always comes first.
 */

const modules = import.meta.glob('./profiles/*.json', { eager: true, import: 'default' });

const entries = Object.entries(modules)
  .map(([path, data]) => [path.match(/\/([^/]+)\.json$/)[1], data])
  .filter(([id]) => !id.startsWith('_'))
  .sort(([idA, a], [idB, b]) => {
    if (idA === 'default') return -1;
    if (idB === 'default') return 1;
    const orderA = a.order ?? Infinity;
    const orderB = b.order ?? Infinity;
    if (orderA !== orderB) return orderA < orderB ? -1 : 1;
    return idA.localeCompare(idB);
  });

if (!entries.some(([id]) => id === 'default')) {
  console.warn('[Profiles] Missing src/config/profiles/default.json — marker fallbacks will use plain numbers.');
}

export const profiles = Object.fromEntries(entries);
export default profiles;
