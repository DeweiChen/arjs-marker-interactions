/**
 * A-Frame Custom Component: three-text-3d
 * Loads a Three.js Typeface JSON font, generates 3D extruded text geometry,
 * automatically centers it, and applies emissive glowing material.
 */

const fontCache = new Map();

function createPaths(text, size, data, THREE) {
  const chars = Array.from(text);
  const scale = size / data.resolution;
  const line_height = (data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness) * scale;
  const paths = [];

  let offsetX = 0;
  let offsetY = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === '\n') {
      offsetX = 0;
      offsetY -= line_height;
    } else {
      const glyph = data.glyphs[char] || data.glyphs['?'];
      if (glyph) {
        const path = new THREE.ShapePath();
        let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

        if (glyph.o) {
          const outline = glyph._cachedOutline || (glyph._cachedOutline = glyph.o.split(' '));
          for (let j = 0, l = outline.length; j < l;) {
            const action = outline[j++];
            switch (action) {
              case 'm':
                x = outline[j++] * scale + offsetX;
                y = outline[j++] * scale + offsetY;
                path.moveTo(x, y);
                break;
              case 'l':
                x = outline[j++] * scale + offsetX;
                y = outline[j++] * scale + offsetY;
                path.lineTo(x, y);
                break;
              case 'q':
                cpx = outline[j++] * scale + offsetX;
                cpy = outline[j++] * scale + offsetY;
                cpx1 = outline[j++] * scale + offsetX;
                cpy1 = outline[j++] * scale + offsetY;
                path.quadraticCurveTo(cpx1, cpy1, cpx, cpy);
                break;
              case 'b':
                cpx = outline[j++] * scale + offsetX;
                cpy = outline[j++] * scale + offsetY;
                cpx1 = outline[j++] * scale + offsetX;
                cpy1 = outline[j++] * scale + offsetY;
                cpx2 = outline[j++] * scale + offsetX;
                cpy2 = outline[j++] * scale + offsetY;
                path.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, cpx, cpy);
                break;
            }
          }
        }
        offsetX += glyph.ha * scale;
        paths.push(path);
      }
    }
  }

  return paths;
}

function fetchFont(url) {
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

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('three-text-3d', {
    schema: {
      text: { type: 'string', default: 'Hello' },
      fontUrl: { type: 'string', default: './fonts/fredoka_light_regular.json' },
      size: { type: 'number', default: 0.5 },
      depth: { type: 'number', default: 0.1 },
      curveSegments: { type: 'int', default: 12 },
      bevelEnabled: { type: 'boolean', default: true },
      bevelThickness: { type: 'number', default: 0.01 },
      bevelSize: { type: 'number', default: 0.01 },
      bevelSegments: { type: 'int', default: 5 },
      color: { type: 'color', default: '#ffffff' },
      emissive: { type: 'color', default: '#ffffff' },
      emissiveIntensity: { type: 'number', default: 1.0 }
    },

    init: function () {
      this._buildMesh = this._buildMesh.bind(this);
      this._buildMesh();
    },

    update: function (oldData) {
      if (oldData && (oldData.text !== this.data.text || oldData.fontUrl !== this.data.fontUrl || oldData.size !== this.data.size || oldData.depth !== this.data.depth)) {
        this._buildMesh();
      } else if (this.mesh && this.mesh.material) {
        const THREE = window.THREE || AFRAME.THREE;
        this.mesh.material.color.set(this.data.color);
        this.mesh.material.emissive.set(this.data.emissive);
        this.mesh.material.emissiveIntensity = this.data.emissiveIntensity;
      }
    },

    _buildMesh: function () {
      const data = this.data;
      const THREE = window.THREE || AFRAME.THREE;
      if (!data.text) return;

      fetchFont(data.fontUrl)
        .then((fontData) => {
          const paths = createPaths(data.text, data.size, fontData, THREE);
          const shapes = [];
          for (let p = 0; p < paths.length; p++) {
            shapes.push(...paths[p].toShapes());
          }

          const geometry = new THREE.ExtrudeGeometry(shapes, {
            depth: data.depth,
            curveSegments: data.curveSegments,
            bevelEnabled: data.bevelEnabled,
            bevelThickness: data.bevelThickness,
            bevelSize: data.bevelSize,
            bevelOffset: 0,
            bevelSegments: data.bevelSegments
          });

          // Auto-center geometry bounding box around local origin
          geometry.computeBoundingBox();
          geometry.center();

          // Create standard emissive material
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(data.color),
            emissive: new THREE.Color(data.emissive),
            emissiveIntensity: data.emissiveIntensity,
            roughness: 0.3,
            metalness: 0.1
          });

          // Clean up old mesh if existing
          if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.el.removeObject3D('mesh');
          }

          this.mesh = new THREE.Mesh(geometry, material);
          this.mesh.layers.enable(1); // Enable Layer 1 for Bloom Post-Processing
          this.el.setObject3D('mesh', this.mesh);
          this.el.emit('three-text-loaded', { mesh: this.mesh });
        })
        .catch((err) => {
          console.error('[three-text-3d] Failed to build 3D text:', err);
        });
    },

    remove: function () {
      if (this.mesh) {
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
        this.el.removeObject3D('mesh');
        this.mesh = null;
      }
    }
  });
}
