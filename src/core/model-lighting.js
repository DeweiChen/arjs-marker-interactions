/**
 * On-Demand Model Lighting
 * Scene lights only exist while at least one GLB model is loaded.
 * Text and FX use unlit materials, so a text-only profile renders with zero lights.
 * Reference counted by loaded models (not visibility) so tracking loss never toggles lights,
 * which would force a shader recompile of every lit material.
 */

const AMBIENT = { color: 0xffffff, intensity: 0.8 };
const DIRECTIONAL = { color: 0xffffff, intensity: 1.2, position: [1, 4, 2] };

let refCount = 0;
let lightGroup = null;

export function acquireModelLighting(sceneEl) {
  refCount++;
  if (lightGroup || !sceneEl || !sceneEl.object3D) return;

  const THREE = window.THREE || AFRAME.THREE;
  lightGroup = new THREE.Group();
  lightGroup.name = 'model-lighting';

  const ambient = new THREE.AmbientLight(AMBIENT.color, AMBIENT.intensity);
  const directional = new THREE.DirectionalLight(DIRECTIONAL.color, DIRECTIONAL.intensity);
  directional.position.fromArray(DIRECTIONAL.position);

  lightGroup.add(ambient, directional, directional.target);

  // Mirror bloom-effect's _syncBloomLayers: lights participate in the bloom layer too
  lightGroup.traverse((obj) => obj.layers.enable(1));

  sceneEl.object3D.add(lightGroup);
  console.log('[model-lighting] Lights enabled (first GLB model loaded).');
}

export function releaseModelLighting() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !lightGroup) return;

  lightGroup.traverse((obj) => {
    if (obj.isLight && obj.dispose) obj.dispose();
  });
  if (lightGroup.parent) lightGroup.parent.remove(lightGroup);
  lightGroup = null;
  console.log('[model-lighting] Lights removed (no GLB models loaded).');
}
