/**
 * A-Frame Custom Component: marker-model
 * Lazily loads a GLB/glTF model the first time its parent marker is detected,
 * auto-fits it onto the marker, and plays its embedded animations.
 * Scene lights are created on demand via model-lighting (only while a model is loaded).
 */

import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { acquireModelLighting, releaseModelLighting } from '../core/model-lighting.js';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

// url -> Promise<gltf>; shared across markers, each instance renders its own skeleton-safe clone
const gltfCache = new Map();
let sharedLoader = null;

function getLoader(THREE) {
  if (sharedLoader) return sharedLoader;
  sharedLoader = new THREE.GLTFLoader();
  if (THREE.DRACOLoader) {
    // Decoder is only fetched if a model actually uses Draco compression
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    sharedLoader.setDRACOLoader(dracoLoader);
  }
  return sharedLoader;
}

function loadGltf(url, THREE) {
  if (!gltfCache.has(url)) {
    const promise = getLoader(THREE).loadAsync(url);
    promise.catch(() => gltfCache.delete(url));
    gltfCache.set(url, promise);
  }
  return gltfCache.get(url);
}

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('marker-model', {
    schema: {
      url: { type: 'string', default: '' },
      fitSize: { type: 'number', default: 0.9 },
      scale: { type: 'number', default: 1 },
      offset: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
      rotation: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
      clip: { type: 'string', default: '*' },
      loop: { type: 'string', default: 'repeat', oneOf: ['repeat', 'once', 'pingpong'] },
      timeScale: { type: 'number', default: 1 },
      glow: { type: 'boolean', default: false },
      preload: { type: 'boolean', default: false }
    },

    init: function () {
      this._onMarkerFound = this._onMarkerFound.bind(this);

      this.model = null;
      this.mixer = null;
      this._hasLighting = false;
      this._requested = false;
      this._currentBuildId = 0;

      const parentEl = this.el.parentEl;
      if (parentEl) {
        parentEl.addEventListener('markerFound', this._onMarkerFound);
        parentEl.addEventListener('marker-stabilize-start', this._onMarkerFound);
      }
    },

    update: function (oldData) {
      const data = this.data;
      const needsReload = !oldData || oldData.url !== data.url;

      if (needsReload) {
        this._clearModel();
        this._requested = false;
        // AR.js markers start with object3D.visible = true, so rely on the stabilizer's tracked state
        const stabilizer = this.el.parentEl && this.el.parentEl.components['marker-stabilizer'];
        if (data.preload || (stabilizer && stabilizer.isFound)) {
          this._load();
        }
        return;
      }

      if (this.model) {
        this._applyTransform();
        this._applyGlow();
        this._setupAnimation();
      }
    },

    _onMarkerFound: function () {
      if (!this._requested) this._load();
    },

    _load: function () {
      const url = this.data.url;
      if (!url) return;

      this._requested = true;
      const buildId = ++this._currentBuildId;
      const THREE = window.THREE || AFRAME.THREE;

      loadGltf(url, THREE)
        .then((gltf) => {
          if (this._currentBuildId !== buildId) return;
          this._mountModel(gltf, THREE);
        })
        .catch((err) => {
          if (this._currentBuildId !== buildId) return;
          console.warn('[marker-model] Failed to load model:', url, err);
          this._requested = false;
          this.el.emit('marker-model-error', { url, error: err });
        });
    },

    _mountModel: function (gltf, THREE) {
      const source = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      if (!source) {
        this.el.emit('marker-model-error', { url: this.data.url, error: new Error('Empty glTF scene') });
        return;
      }

      const content = cloneSkinned(source);

      // Cloned bones have stale world matrices; skinned bounds computed now would be garbage
      // (e.g. a hand mesh reporting ~300 units, shrinking the whole model to an invisible dot)
      content.updateMatrixWorld(true);
      content.traverse((obj) => {
        if (obj.isSkinnedMesh) {
          obj.skeleton.update();
          obj.boundingBox = null;
          obj.boundingSphere = null;
          // Animated poses can leave the bind-pose bounds, so don't let culling hide them
          obj.frustumCulled = false;
        }
      });

      // Center horizontally and rest the model's bottom on the marker plane
      const box = new THREE.Box3().setFromObject(content);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      content.position.set(-center.x, -box.min.y, -center.z);

      this.model = new THREE.Group();
      this.model.add(content);
      this._fitScale = size.length() > 0 ? 1 / Math.max(size.x, size.y, size.z) : 1;
      this._clips = gltf.animations || [];

      this._applyTransform();
      this._applyGlow();
      this._setupAnimation();

      this.el.setObject3D('model', this.model);
      acquireModelLighting(this.el.sceneEl);
      this._hasLighting = true;

      console.log('[marker-model] Loaded:', this.data.url, `(clips: ${this._clips.map((c) => c.name).join(', ') || 'none'})`);
      this.el.emit('marker-model-loaded', { url: this.data.url, model: this.model });
    },

    _applyTransform: function () {
      const data = this.data;
      const THREE = window.THREE || AFRAME.THREE;
      const scale = this._fitScale * data.fitSize * data.scale;

      this.model.scale.setScalar(isFinite(scale) && scale > 0 ? scale : 1);
      this.model.position.set(data.offset.x, data.offset.y, data.offset.z);
      this.model.rotation.set(
        THREE.MathUtils.degToRad(data.rotation.x),
        THREE.MathUtils.degToRad(data.rotation.y),
        THREE.MathUtils.degToRad(data.rotation.z)
      );
    },

    _applyGlow: function () {
      const glow = this.data.glow;
      this.model.traverse((obj) => {
        if (obj.isMesh || obj.isPoints) {
          if (glow) obj.layers.enable(1);
          else obj.layers.disable(1);
        }
      });
    },

    _setupAnimation: function () {
      const THREE = window.THREE || AFRAME.THREE;
      const data = this.data;

      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.mixer.getRoot());
        this.mixer = null;
      }

      const clips = data.clip === '*'
        ? this._clips
        : this._clips.filter((c) => c.name === data.clip);

      if (!data.clip || clips.length === 0) {
        if (data.clip && data.clip !== '*') {
          console.warn(`[marker-model] Clip "${data.clip}" not found. Available:`, this._clips.map((c) => c.name));
        }
        return;
      }

      const loopMode = {
        repeat: THREE.LoopRepeat,
        once: THREE.LoopOnce,
        pingpong: THREE.LoopPingPong
      }[data.loop] || THREE.LoopRepeat;

      this.mixer = new THREE.AnimationMixer(this.model);
      this.mixer.timeScale = data.timeScale;
      clips.forEach((clip) => {
        const action = this.mixer.clipAction(clip);
        action.setLoop(loopMode, Infinity);
        action.clampWhenFinished = loopMode === THREE.LoopOnce;
        action.play();
      });
    },

    tick: function (time, delta) {
      if (!this.mixer || !delta) return;

      // Skip animation work while the marker is not tracked
      const parentObj = this.el.parentEl && this.el.parentEl.object3D;
      if (!this.el.object3D.visible || (parentObj && !parentObj.visible)) return;

      this.mixer.update(Math.min(delta, 100) / 1000);
    },

    _clearModel: function () {
      this._currentBuildId++;

      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.mixer.getRoot());
        this.mixer = null;
      }

      if (this.model) {
        // Geometry, materials and textures are shared with the cached glTF, so they are not disposed here
        this.el.removeObject3D('model');
        this.model = null;
      }

      if (this._hasLighting) {
        releaseModelLighting();
        this._hasLighting = false;
      }
    },

    remove: function () {
      const parentEl = this.el.parentEl;
      if (parentEl) {
        parentEl.removeEventListener('markerFound', this._onMarkerFound);
        parentEl.removeEventListener('marker-stabilize-start', this._onMarkerFound);
      }
      this._clearModel();
    }
  });
}
