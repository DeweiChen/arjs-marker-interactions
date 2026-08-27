/**
 * BaseFX - Standardized Interface & Base Class for Visual Effects Strategies
 * Defines life-cycle methods and layer assignments for pluggable WebAR interactions.
 */

export class BaseFX {
  /**
   * @param {THREE.Scene} scene - Root Three.js scene object
   * @param {Object} options - Effect options
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.THREE = window.THREE || (typeof AFRAME !== 'undefined' ? AFRAME.THREE : null);
    this.options = options;

    // Root container group
    this.group = new this.THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  /**
   * Enables Layer 1 on all child meshes and lights for Selective Bloom Post-Processing.
   */
  enableBloomLayer() {
    this.group.traverse((obj) => {
      if (obj.isMesh || obj.isPoints || obj.isLight) {
        obj.layers.enable(1);
      }
    });
  }

  /**
   * Standard frame update loop. Must be implemented by subclasses.
   *
   * @param {THREE.Vector3|null} pos1 - Target 1 position
   * @param {THREE.Vector3|null} pos2 - Target 2 position
   * @param {number} deltaSec - Frame delta in seconds
   * @param {number} intensity - Effect intensity scalar
   * @param {number} progress - Effect progress (0.0 to 1.0)
   */
  update(pos1, pos2, deltaSec, intensity = 1.0, progress = 0.0) {
    // Override in subclass
  }

  /**
   * Reset effect state machine to standby.
   */
  reset() {
    this.group.visible = false;
  }

  /**
   * Dispose all geometries, materials, and textures to free WebGL GPU memory.
   */
  dispose() {
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
  }
}
