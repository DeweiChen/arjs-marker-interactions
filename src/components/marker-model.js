/**
 * A-Frame Custom Component: marker-model
 * Lazily loads a GLB/glTF model the first time its parent marker is detected,
 * auto-fits it onto the marker, and plays its embedded animations.
 * Scene lights are created on demand via model-lighting (only while a model is loaded).
 *
 * Pose smoothing: AR.js re-estimates the marker pose every frame from a 640x480 detection image,
 * so it carries sub-pixel corner noise. Flat text hides it, but a tall, hard-edged model amplifies
 * it (the head swings like a lever). Models are therefore rendered at an adaptively smoothed pose:
 * small jitter is filtered heavily, real motion is followed quickly.
 */

import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { acquireModelLighting, releaseModelLighting } from '../core/model-lighting.js';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

// url -> Promise<gltf>; shared across markers, each instance renders its own skeleton-safe clone
const gltfCache = new Map();
let sharedLoader = null;

// Pose deltas at which smoothing fully releases (raw pose is followed immediately)
const SMOOTH_POS_RANGE = 0.2; // marker units
const SMOOTH_ANGLE_RANGE = 10 * Math.PI / 180; // radians

// Smoothing runs in scene.onBeforeRender: after AR.js has written this frame's marker pose and
// the scene's world matrices are updated, right before drawing. Doing it in tick() instead could
// run before AR.js updates the marker, making the correction one frame stale (re-adding jitter).
const smoothers = new Set();
let hookedScene = null;

function ensureRenderHook(scene) {
  if (hookedScene === scene) return;
  hookedScene = scene;
  const previous = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    previous.apply(this, args);
    smoothers.forEach((component) => component._applySmoothing());
  };
}

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
      preload: { type: 'boolean', default: false },
      smoothing: { type: 'number', default: 0.8 }
    },

    init: function () {
      this._onMarkerFound = this._onMarkerFound.bind(this);

      this.model = null;
      this.mixer = null;
      this._hasLighting = false;
      this._requested = false;
      this._currentBuildId = 0;
      this._smooth = null;
      this._pendingSmoothDelta = 0;

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
      if (this._smooth) this._smooth.initialized = false; // snap to the fresh pose, don't glide in
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
        if (obj.isMesh) {
          // The scene renders at low shader precision for FX performance; models need highp,
          // otherwise skinning / depth jitter makes thin layered parts (eyes, mouth) z-fight and flicker
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => {
            if (mat && mat.precision !== 'highp') {
              mat.precision = 'highp';
              mat.needsUpdate = true;
            }
          });
        }
      });

      // Center horizontally and rest the model's bottom on the marker plane
      const box = this._computeFitBox(content, THREE);
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
      ensureRenderHook(this.el.sceneEl.object3D);
      smoothers.add(this);
      acquireModelLighting(this.el.sceneEl);
      this._hasLighting = true;

      console.log('[marker-model] Loaded:', this.data.url, `(clips: ${this._clips.map((c) => c.name).join(', ') || 'none'})`);
      this.el.emit('marker-model-loaded', { url: this.data.url, model: this.model });
    },

    /**
     * Bounds used for auto-fit, ignoring stray meshes. Some exported models (e.g. Sketchfab
     * auto-converted GLBs) contain a mesh thousands of units away from the rest, which would
     * otherwise shrink the whole model to an invisible dot. Such outliers are hidden.
     */
    _computeFitBox: function (content, THREE) {
      const entries = [];
      content.traverse((obj) => {
        if (!obj.isMesh) return;
        const box = new THREE.Box3().setFromObject(obj);
        if (!box.isEmpty()) entries.push({ obj, box, center: box.getCenter(new THREE.Vector3()) });
      });
      if (entries.length === 0) return new THREE.Box3().setFromObject(content);

      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      const refCenter = new THREE.Vector3(
        median(entries.map((e) => e.center.x)),
        median(entries.map((e) => e.center.y)),
        median(entries.map((e) => e.center.z))
      );
      const refSize = median(entries.map((e) => {
        const s = e.box.getSize(new THREE.Vector3());
        return Math.max(s.x, s.y, s.z);
      })) || 1;

      const fitBox = new THREE.Box3();
      entries.forEach((e) => {
        if (entries.length > 2 && e.center.distanceTo(refCenter) > refSize * 20) {
          e.obj.visible = false;
          console.warn(`[marker-model] Hiding stray mesh "${e.obj.name}" far from the model in`, this.data.url);
        } else {
          fitBox.union(e.box);
        }
      });
      return fitBox.isEmpty() ? new THREE.Box3().setFromObject(content) : fitBox;
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

      // Unsmoothed local transform; smoothing re-derives the model's local pose from it every frame
      this.model.updateMatrix();
      if (!this._smooth) {
        this._smooth = {
          baseLocal: new THREE.Matrix4(),
          rawWorld: new THREE.Matrix4(),
          invSlotWorld: new THREE.Matrix4(),
          rawPos: new THREE.Vector3(),
          rawQuat: new THREE.Quaternion(),
          rawScale: new THREE.Vector3(),
          pos: new THREE.Vector3(),
          quat: new THREE.Quaternion(),
          initialized: false
        };
      }
      this._smooth.baseLocal.copy(this.model.matrix);
      this._smooth.initialized = false;
    },

    _applySmoothing: function () {
      const sm = this._smooth;
      const delta = this._pendingSmoothDelta;
      if (!this.model || !sm || !delta) return; // at most once per frame (bloom renders several passes)
      this._pendingSmoothDelta = 0;

      const slotObj = this.el.object3D;
      const markerObj = this.el.parentEl && this.el.parentEl.object3D;
      if (this.data.smoothing <= 0) {
        sm.baseLocal.decompose(this.model.position, this.model.quaternion, this.model.scale);
        sm.initialized = false;
        return;
      }
      if (!slotObj.visible || (markerObj && !markerObj.visible)) {
        sm.initialized = false;
        return;
      }

      sm.rawWorld.multiplyMatrices(slotObj.matrixWorld, sm.baseLocal);
      sm.rawWorld.decompose(sm.rawPos, sm.rawQuat, sm.rawScale);

      if (!sm.initialized) {
        sm.pos.copy(sm.rawPos);
        sm.quat.copy(sm.rawQuat);
        sm.initialized = true;
      } else {
        // Adaptive: follow slowly while the pose only jitters, catch up fast when it really moves
        const motion = Math.min(1, Math.max(
          sm.pos.distanceTo(sm.rawPos) / SMOOTH_POS_RANGE,
          sm.quat.angleTo(sm.rawQuat) / SMOOTH_ANGLE_RANGE
        ));
        const minAlpha = 1 - Math.min(0.98, this.data.smoothing);
        const alpha = minAlpha + (1 - minAlpha) * motion;
        const frameAlpha = 1 - Math.pow(1 - alpha, Math.min(delta, 100) / (1000 / 60));
        sm.pos.lerp(sm.rawPos, frameAlpha);
        sm.quat.slerp(sm.rawQuat, frameAlpha);
      }

      // Express the smoothed world pose in the slot's local space
      sm.rawWorld.compose(sm.pos, sm.quat, sm.rawScale);
      sm.invSlotWorld.copy(slotObj.matrixWorld).invert();
      sm.rawWorld.premultiply(sm.invSlotWorld);
      sm.rawWorld.decompose(this.model.position, this.model.quaternion, this.model.scale);
      this.model.updateMatrixWorld(true);
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
      if (this.model && delta) this._pendingSmoothDelta = delta;
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
      smoothers.delete(this);
      this._smooth = null;

      if (this._hasLighting) {
        releaseModelLighting(this.el.sceneEl);
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
