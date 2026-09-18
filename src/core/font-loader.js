/**
 * Font Loader & 3D Extruded Text Generator
 * Handles TTF JSON font loading, shape path parsing, and Three.js 3D text geometry creation.
 */

const fontCache = new Map();

/**
 * Fetch TTF JSON typeface font with caching and CDN fallback.
 *
 * @param {string} url - Local or remote font JSON URL
 * @returns {Promise<Object>} Font JSON data
 */
export function fetchFont(url) {
  if (fontCache.has(url)) {
    return Promise.resolve(fontCache.get(url));
  }

  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.json();
    })
    .catch(() => {
      // CDN Fallback if local path fails
      const fallbackUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/fonts/helvetiker_bold.typeface.json';
      return fetch(fallbackUrl).then((r) => r.json());
    })
    .then((data) => {
      fontCache.set(url, data);
      return data;
    });
}

/**
 * Convert text string into Three.js ShapePath array using typeface font glyphs.
 *
 * @param {string} text - Input text string
 * @param {number} size - Text font size
 * @param {Object} data - Primary typeface font JSON data
 * @param {Object} THREE - Active Three.js library instance
 * @param {Object} fallbackData - Optional fallback typeface for missing glyphs
 * @returns {Array<THREE.ShapePath>} Array of vector shape paths
 */
export function createPaths(text, size, data, THREE, fallbackData = null) {
  const chars = Array.from(text);
  const scale = size / data.resolution;
  const line_height = (data.boundingBox.yMax - data.boundingBox.yMin + (data.underlineThickness || 0)) * scale;
  const paths = [];

  let offsetX = 0;
  let offsetY = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === '\n') {
      offsetX = 0;
      offsetY -= line_height;
    } else {
      const primaryGlyph = data.glyphs[char];
      const fallbackGlyph = fallbackData?.glyphs[char];
      const isFallback = !primaryGlyph && !!fallbackGlyph;
      const glyph = primaryGlyph || fallbackGlyph || data.glyphs['?'] || fallbackData?.glyphs['?'];
      if (glyph) {
        const path = new THREE.ShapePath();
        const glyphResolution = (isFallback && fallbackData?.resolution) ? fallbackData.resolution : data.resolution;
        const glyphScale = size / glyphResolution;
        let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

        if (glyph.o) {
          const outline = glyph._cachedOutline || (glyph._cachedOutline = glyph.o.split(' '));
          for (let j = 0, l = outline.length; j < l;) {
            const action = outline[j++];
            switch (action) {
              case 'm':
                x = outline[j++] * glyphScale + offsetX;
                y = outline[j++] * glyphScale + offsetY;
                path.moveTo(x, y);
                break;
              case 'l':
                x = outline[j++] * glyphScale + offsetX;
                y = outline[j++] * glyphScale + offsetY;
                path.lineTo(x, y);
                break;
              case 'q':
                cpx = outline[j++] * glyphScale + offsetX;
                cpy = outline[j++] * glyphScale + offsetY;
                cpx1 = outline[j++] * glyphScale + offsetX;
                cpy1 = outline[j++] * glyphScale + offsetY;
                path.quadraticCurveTo(cpx1, cpy1, cpx, cpy);
                break;
              case 'b':
                cpx = outline[j++] * glyphScale + offsetX;
                cpy = outline[j++] * glyphScale + offsetY;
                cpx1 = outline[j++] * glyphScale + offsetX;
                cpy1 = outline[j++] * glyphScale + offsetY;
                cpx2 = outline[j++] * glyphScale + offsetX;
                cpy2 = outline[j++] * glyphScale + offsetY;
                path.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, cpx, cpy);
                break;
            }
          }
        }
        offsetX += glyph.ha * glyphScale;
        paths.push(path);
      }
    }
  }

  return paths;
}

/**
 * Creates a Three.js 3D extruded text mesh centered at its origin.
 *
 * @param {Object} THREE - Three.js library instance
 * @param {Object} fontData - Typeface font JSON data
 * @param {Object} options - Extrusion and material configuration options
 * @returns {THREE.Mesh} Formatted 3D text mesh
 */
export function buildTextMesh(THREE, fontData, options = {}) {
  const {
    text = '',
    size = 0.5,
    depth = 0.08,
    curveSegments = 12,
    bevelEnabled = true,
    bevelThickness = 0.008,
    bevelSize = 0.008,
    bevelSegments = 5,
    color = 0xffffff,
    emissive = 0xffffff,
    emissiveIntensity = 1.0
  } = options;

  const paths = createPaths(text, size, fontData, THREE, options.fallbackFontData);
  const shapes = [];
  for (const p of paths) {
    shapes.push(...p.toShapes());
  }

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    curveSegments,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    bevelOffset: 0,
    bevelSegments
  });

  geometry.computeBoundingBox();
  geometry.center();

  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(emissive || color),
    transparent: true,
    opacity: 1.0
  });

  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
