/**
 * FXFactory - Pluggable Visual Effects Registry & Factory Manager
 * Manages creation and dynamic switching of proximity visual effects strategies.
 */

import { LightningFX } from './lightning-fx.js';
import { BirthdayFX } from './birthday-fx.js';

export class FXFactory {
  constructor() {
    this.registry = new Map();
    // Register default built-in FX strategies
    this.register('lightning', LightningFX);
    this.register('birthday', BirthdayFX);
  }

  /**
   * Register a new FX strategy class under a unique type key.
   *
   * @param {string} typeKey - Unique identifier (e.g., 'lightning', 'laser', 'fire')
   * @param {Class} fxClass - Class extending BaseFX
   */
  register(typeKey, fxClass) {
    this.registry.set(typeKey.toLowerCase(), fxClass);
  }

  /**
   * Instantiate an FX strategy registered under typeKey.
   *
   * @param {string} typeKey - Registered identifier
   * @param {THREE.Scene} scene - Root Three.js scene
   * @param {Object} options - Config options for the effect
   * @returns {BaseFX} Instantiated FX strategy
   */
  create(typeKey, scene, options = {}) {
    const key = typeKey ? typeKey.toLowerCase() : 'lightning';
    const FXClass = this.registry.get(key) || LightningFX;
    return new FXClass(scene, options);
  }

  /**
   * Check if a type key is registered in the factory.
   *
   * @param {string} typeKey - Identifier to check
   * @returns {boolean} True if registered
   */
  has(typeKey) {
    return this.registry.has(typeKey ? typeKey.toLowerCase() : '');
  }
}

export const globalFXFactory = new FXFactory();
