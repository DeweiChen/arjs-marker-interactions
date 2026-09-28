/**
 * Profile Loader
 * Collects every `src/config/profiles/<id>.json` at build time. The file name
 * (without extension) is the profile id used by `?p=<id>` / `#<id>`.
 * Files starting with `_` (e.g. `_template.jsonc`) are ignored.
 *
 * Profiles are ordered by their optional `order` field, then by id;
 * `default` always comes first.
 *
 * Every marker entry is normalized into one shape (see `normalizeMarker`), so
 * consumers never need to know which JSON form it was written in.
 */

export const MARKER_IDS = ['0', '1', '2', '3', '4', '5', '6', '7'];
export const MARKER_TYPES = ['text', 'glb'];

const DEFAULT_COLOR = '#ffffff';

/**
 * Normalize a raw profile marker entry.
 *
 * Accepted JSON forms:
 *   { "type": "text", "text": "Hi", "color": "#..", "emissive": "#.." }
 *   { "type": "glb", "name": "Robot", "model": { "url": ".." }, "fallback": { "text", "color", "emissive" } }
 * Legacy forms (still accepted): a text marker without `type`, and a glb marker
 * carrying `text` / `color` / `emissive` at the top level instead of `fallback`.
 *
 * @returns {{ id: string, type: 'text'|'glb', name: string,
 *              text: { text: string, color: string, emissive: string },
 *              model: Object|null }}
 *   `text` is what the 3D text renders (the GLB load-error fallback for glb markers).
 */
export function normalizeMarker(id, raw, source = '') {
  const where = `[Profiles] ${source}marker ${id}`;
  const entry = raw && typeof raw === 'object' ? raw : {};
  let type = entry.type ?? 'text';

  if (!MARKER_TYPES.includes(type)) {
    console.warn(`${where}: unknown type "${type}", rendering as text.`);
    type = 'text';
  }
  if (type === 'glb' && !entry.model?.url) {
    console.warn(`${where}: type "glb" requires model.url, rendering fallback text.`);
    type = 'text';
  }

  if (type === 'text') {
    const fallback = entry.fallback || {};
    const text = String(entry.text ?? fallback.text ?? entry.name ?? id);
    const color = entry.color ?? fallback.color ?? DEFAULT_COLOR;
    return {
      id,
      type,
      name: String(entry.name ?? text),
      text: { text, color, emissive: entry.emissive ?? fallback.emissive ?? color },
      model: null
    };
  }

  // glb — legacy top-level text/color/emissive act as the fallback
  const fallback = entry.fallback || {};
  const name = String(entry.name ?? fallback.text ?? entry.text ?? id);
  const color = fallback.color ?? entry.color ?? DEFAULT_COLOR;
  return {
    id,
    type,
    name,
    text: {
      text: String(fallback.text ?? entry.text ?? name),
      color,
      emissive: fallback.emissive ?? entry.emissive ?? color
    },
    model: entry.model
  };
}

const normalizeProfile = (id, data) => {
  const markers = {};
  for (const [markerId, raw] of Object.entries(data.markers || {})) {
    if (!MARKER_IDS.includes(markerId)) {
      console.warn(`[Profiles] ${id}: marker id "${markerId}" is out of range (0–7), ignored.`);
      continue;
    }
    markers[markerId] = normalizeMarker(markerId, raw, `${id}: `);
  }
  return { ...data, markers };
};

const modules = import.meta.glob('./profiles/*.json', { eager: true, import: 'default' });

const entries = Object.entries(modules)
  .map(([path, data]) => [path.match(/\/([^/]+)\.json$/)[1], data])
  .filter(([id]) => !id.startsWith('_'))
  .map(([id, data]) => [id, normalizeProfile(id, data)])
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

/**
 * Resolve the effective marker for a profile: its own entry, else the same
 * marker from `default.json`, else a plain white number.
 *
 * @returns {{ marker: ReturnType<typeof normalizeMarker>, listed: boolean }}
 *   `listed` = the profile itself configures this marker.
 */
export function resolveMarker(profile, markerId) {
  const id = String(markerId);
  const own = profile?.markers?.[id];
  if (own) return { marker: own, listed: true };
  const marker = profiles.default?.markers?.[id] || normalizeMarker(id, { type: 'text', text: id });
  return { marker, listed: false };
}

export default profiles;
