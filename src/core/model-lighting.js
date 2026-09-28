/**
 * On-Demand Model Lighting
 * Scene lights only exist while at least one GLB model is loaded.
 * Text and FX use unlit materials, so a text-only profile renders with zero lights.
 * Reference counted by loaded models (not visibility) so tracking loss never toggles lights,
 * which would force a shader recompile of every lit material.
 *
 * Setup:
 *  - Headlight: a directional light parented to the camera. AR.js moves markers, not the camera,
 *    so a world-fixed light ends up behind a model lying on a table; a camera-relative light
 *    always lights the side facing the viewer.
 *  - Environment: a prefiltered RoomEnvironment (scene.environment) for soft image-based fill
 *    and subtle reflections on PBR materials. Unlit text / FX materials ignore it.
 */

import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Tuned so a front-facing model reaches ~85% of its unlit texture brightness with no clipping
const AMBIENT = { color: 0xffffff, intensity: 0.4 };
// Camera-local offset: close to the view axis, slightly up and right, pointing forward
const HEADLIGHT = { color: 0xffffff, intensity: 2.5, position: [0.4, 0.6, 0], target: [0, 0, -3] };
const ENVIRONMENT_INTENSITY = 1.4;

let refCount = 0;
let state = null;

function createEnvironmentMap(sceneEl, THREE) {
  const renderer = sceneEl.renderer;
  if (!renderer || !THREE.PMREMGenerator) return null;

  // The scene renders at low precision for FX performance; prefilter the env map at highp
  // so it doesn't band. Program cache keys include precision, so this doesn't leak into FX shaders.
  const capabilities = renderer.capabilities;
  const originalPrecision = capabilities.precision;
  capabilities.precision = capabilities.getMaxPrecision('highp');

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomScene = new RoomEnvironment();
    const renderTarget = pmrem.fromScene(roomScene, 0.04);
    roomScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    pmrem.dispose();
    return renderTarget;
  } catch (err) {
    console.warn('[model-lighting] Environment map unavailable, using lights only:', err);
    return null;
  } finally {
    capabilities.precision = originalPrecision;
  }
}

export function acquireModelLighting(sceneEl) {
  refCount++;
  if (state || !sceneEl || !sceneEl.object3D) return;

  const THREE = window.THREE || AFRAME.THREE;
  const scene = sceneEl.object3D;
  const camera = sceneEl.camera;

  const ambient = new THREE.AmbientLight(AMBIENT.color, AMBIENT.intensity);
  scene.add(ambient);

  const headlight = new THREE.DirectionalLight(HEADLIGHT.color, HEADLIGHT.intensity);
  headlight.position.fromArray(HEADLIGHT.position);
  headlight.target.position.fromArray(HEADLIGHT.target);
  const lightParent = camera || scene;
  lightParent.add(headlight, headlight.target);

  // Mirror bloom-effect's _syncBloomLayers: lights participate in the bloom layer too
  [ambient, headlight].forEach((light) => light.layers.enable(1));

  const envTarget = createEnvironmentMap(sceneEl, THREE);
  const previousEnvironment = scene.environment;
  if (envTarget) {
    scene.environment = envTarget.texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  }

  state = { ambient, headlight, envTarget, previousEnvironment };
  console.log(`[model-lighting] Lights enabled (first GLB model loaded${envTarget ? ', with environment map' : ''}).`);
}

export function releaseModelLighting(sceneEl) {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !state) return;

  const { ambient, headlight, envTarget, previousEnvironment } = state;
  [ambient, headlight].forEach((light) => {
    if (light.parent) light.parent.remove(light);
    if (light.dispose) light.dispose();
  });
  if (headlight.target.parent) headlight.target.parent.remove(headlight.target);

  if (envTarget) {
    const scene = sceneEl && sceneEl.object3D;
    if (scene && scene.environment === envTarget.texture) scene.environment = previousEnvironment || null;
    envTarget.dispose();
  }

  state = null;
  console.log('[model-lighting] Lights removed (no GLB models loaded).');
}
