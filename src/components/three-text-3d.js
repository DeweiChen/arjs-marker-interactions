/**
 * A-Frame Custom Component: three-text-3d
 * Loads a Three.js Typeface JSON font, generates 3D extruded text geometry,
 * automatically centers it, and applies emissive glowing material.
 */

import { fetchFont, createPaths } from '../core/font-loader.js';

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
      emissiveIntensity: { type: 'number', default: 1.0 },
      pitchFacing: { type: 'boolean', default: true },
      minPitch: { type: 'number', default: -90 },
      maxPitch: { type: 'number', default: 35 },
      smoothingFactor: { type: 'number', default: 0.25 }
    },

    init: function () {
      this._buildMesh = this._buildMesh.bind(this);
      this._onMarkerFound = this._onMarkerFound.bind(this);
      this._onMarkerLost = this._onMarkerLost.bind(this);
      this._onSetPitchFacing = this._onSetPitchFacing.bind(this);

      this._camWorldPos = null;
      this._localCam = null;
      this._currentPitch = null;

      const parentEl = this.el.parentEl;
      if (parentEl) {
        parentEl.addEventListener('markerFound', this._onMarkerFound);
        parentEl.addEventListener('markerLost', this._onMarkerLost);
        parentEl.addEventListener('marker-stabilize-start', this._onMarkerFound);
      }

      if (this.el.sceneEl) {
        this.el.sceneEl.addEventListener('set-text-pitch-facing', this._onSetPitchFacing);
      }

      this._buildMesh();
    },

    _onSetPitchFacing: function (e) {
      if (e && e.detail && typeof e.detail.enabled === 'boolean') {
        this.el.setAttribute('three-text-3d', 'pitchFacing', e.detail.enabled);
      }
    },

    _onMarkerFound: function () {
      this._currentPitch = null;
    },

    _onMarkerLost: function () {
      this._currentPitch = null;
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

    tick: function () {
      if (!this.mesh) return;

      const obj3D = this.el.object3D;
      if (!obj3D || !obj3D.parent) return;

      const THREE = window.THREE || AFRAME.THREE;

      if (!this.data.pitchFacing) {
        if (this._currentPitch !== null && this._currentPitch !== 0) {
          this._currentPitch = THREE.MathUtils.lerp(this._currentPitch, 0, 0.25);
          if (Math.abs(this._currentPitch) < 0.001) {
            this._currentPitch = 0;
          }
          obj3D.rotation.x = this._currentPitch;
        } else if (obj3D.rotation.x !== 0) {
          obj3D.rotation.x = 0;
        }
        return;
      }

      const sceneEl = this.el.sceneEl;
      if (!sceneEl) return;

      const camera = (sceneEl.camera && sceneEl.camera.isCamera) ? sceneEl.camera : (sceneEl.cameraEl && sceneEl.cameraEl.getObject3D('camera'));
      if (!camera) return;

      if (obj3D.parent.visible === false && this._currentPitch !== null) return;

      if (!this._camWorldPos) {
        this._camWorldPos = new THREE.Vector3();
        this._localCam = new THREE.Vector3();
      }

      camera.getWorldPosition(this._camWorldPos);
      this._localCam.copy(this._camWorldPos);

      obj3D.parent.updateMatrixWorld(true);
      obj3D.parent.worldToLocal(this._localCam);

      const relY = this._localCam.y - obj3D.position.y;
      const relZ = this._localCam.z - obj3D.position.z;

      let targetPitch = -Math.atan2(relY, relZ);

      const minPitch = THREE.MathUtils.degToRad(this.data.minPitch);
      const maxPitch = THREE.MathUtils.degToRad(this.data.maxPitch);
      targetPitch = THREE.MathUtils.clamp(targetPitch, minPitch, maxPitch);

      if (this._currentPitch === null || isNaN(this._currentPitch)) {
        this._currentPitch = targetPitch;
      } else {
        const alpha = THREE.MathUtils.clamp(this.data.smoothingFactor, 0.01, 1.0);
        this._currentPitch = THREE.MathUtils.lerp(this._currentPitch, targetPitch, alpha);
      }

      obj3D.rotation.x = this._currentPitch;
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

          geometry.computeBoundingBox();
          geometry.center();

          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(data.color),
            emissive: new THREE.Color(data.emissive),
            emissiveIntensity: data.emissiveIntensity,
            roughness: 0.3,
            metalness: 0.1
          });

          if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.el.removeObject3D('mesh');
          }

          this.mesh = new THREE.Mesh(geometry, material);
          this.mesh.layers.enable(1);
          this.el.setObject3D('mesh', this.mesh);
          this.el.emit('three-text-loaded', { mesh: this.mesh });
        })
        .catch((err) => {
          console.error('[three-text-3d] Failed to build 3D text:', err);
        });
    },

    remove: function () {
      if (this.el.sceneEl) {
        this.el.sceneEl.removeEventListener('set-text-pitch-facing', this._onSetPitchFacing);
      }
      const parentEl = this.el.parentEl;
      if (parentEl) {
        parentEl.removeEventListener('markerFound', this._onMarkerFound);
        parentEl.removeEventListener('markerLost', this._onMarkerLost);
        parentEl.removeEventListener('marker-stabilize-start', this._onMarkerFound);
      }
      if (this.mesh) {
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
        this.el.removeObject3D('mesh');
        this.mesh = null;
      }
    }
  });
}
