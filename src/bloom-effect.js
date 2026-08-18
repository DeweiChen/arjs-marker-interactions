/**
 * A-Frame Custom Component: bloom-effect
 * Professional WebGL Post-Processing Pipeline with Selective Layer-Based Bloom.
 * Intercepts A-Frame's internal renderer.render loop to provide real-time cinema-grade
 * Bloom on 3D Text, High-Voltage Lightning, Plasma Cores, and Explosive Sparks.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Custom Additive Composite Shader preserving WebAR Camera Transparency
// Custom Additive Composite Shader with ACES Filmic Tone Preservation for WebAR
const AdditiveAlphaCompositeShader = {
  name: 'AdditiveAlphaCompositeShader',
  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: null },
    exposure: { value: 1.05 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    uniform float exposure;
    varying vec2 vUv;

    // ACES Filmic Tone Mapping curve to prevent color burnout / overexposure
    vec3 ACESFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec4 base = texture2D(baseTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);

      // Extract soft glow luminance for transparent edge feathering
      float bloomLuminance = dot(bloom.rgb, vec3(0.299, 0.587, 0.114));
      float bloomAlpha = clamp(bloomLuminance * 1.2, 0.0, 1.0);

      // Combine base color and bloom glow with gentle exposure scaling
      vec3 combined = (base.rgb + bloom.rgb) * exposure;

      // Tone map combined output to preserve rich emerald & blue hues without white burnout
      vec3 finalColor = ACESFilm(combined);

      // Retain background transparency so AR camera feeds through cleanly
      float finalAlpha = clamp(base.a + bloomAlpha * 0.75, 0.0, 1.0);

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
};

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('bloom-effect', {
    schema: {
      strength: { type: 'number', default: 1.1 },
      radius: { type: 'number', default: 0.55 },
      threshold: { type: 'number', default: 0.05 },
      downscale: { type: 'number', default: 0.5 },
      dynamicIntensity: { type: 'boolean', default: true }
    },

    init: function () {
      this.sceneEl = this.el.sceneEl || this.el;
      this.currentProximity = 0;
      this.isInitialized = false;

      const setup = () => {
        if (!this.isInitialized && this.sceneEl.renderer) {
          this._setupPostProcessing();
        }
      };

      if (this.sceneEl.renderer && this.sceneEl.camera) {
        setup();
      } else {
        this.sceneEl.addEventListener('renderstart', setup, { once: true });
        this.sceneEl.addEventListener('loaded', setup, { once: true });
      }

      // Listen to proximity updates to dynamically scale bloom intensity
      this.sceneEl.addEventListener('proximity-update', (e) => {
        const { proximity, active } = e.detail;
        this.currentProximity = active ? proximity : 0;
      });
    },

    _setupPostProcessing: function () {
      if (this.isInitialized) return;

      const sceneEl = this.sceneEl;
      const renderer = sceneEl.renderer;

      if (!renderer) {
        console.warn('[bloom-effect] Renderer not ready.');
        return;
      }

      this.isInitialized = true;
      renderer.autoClear = false;

      // Initial Layer 1 synchronization
      this._syncBloomLayers();
      sceneEl.addEventListener('three-text-loaded', () => this._syncBloomLayers());
      sceneEl.addEventListener('child-attached', () => this._syncBloomLayers());

      // Resolution & Downscale setup
      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pr = renderer.getPixelRatio() || 1;
      const width = Math.max(1, Math.floor(size.x * pr));
      const height = Math.max(1, Math.floor(size.y * pr));
      const downscale = this.data.downscale;

      const bloomW = Math.max(1, Math.floor(width * downscale));
      const bloomH = Math.max(1, Math.floor(height * downscale));

      // ----------------------------------------------------------------------
      // 1. Bloom Composer (Calculates Glow on Layer 1)
      // ----------------------------------------------------------------------
      const bloomRenderTarget = new THREE.WebGLRenderTarget(bloomW, bloomH, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
      });

      this.bloomComposer = new EffectComposer(renderer, bloomRenderTarget);
      this.bloomComposer.renderToScreen = false;

      this.bloomRenderPass = new RenderPass(sceneEl.object3D, sceneEl.camera);
      this.bloomRenderPass.clearColor = new THREE.Color(0x000000);
      this.bloomRenderPass.clearAlpha = 0;
      this.bloomComposer.addPass(this.bloomRenderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(bloomW, bloomH),
        this.data.strength,
        this.data.radius,
        this.data.threshold
      );
      this.bloomPass.renderToScreen = false;
      this.bloomComposer.addPass(this.bloomPass);

      // ----------------------------------------------------------------------
      // 2. Final Composer (Renders Base Scene + Composites Additive Glow)
      // ----------------------------------------------------------------------
      const finalRenderTarget = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
      });

      this.finalComposer = new EffectComposer(renderer, finalRenderTarget);

      this.finalRenderPass = new RenderPass(sceneEl.object3D, sceneEl.camera);
      this.finalRenderPass.clearColor = new THREE.Color(0x000000);
      this.finalRenderPass.clearAlpha = 0;
      this.finalComposer.addPass(this.finalRenderPass);

      this.compositePass = new ShaderPass(AdditiveAlphaCompositeShader, 'baseTexture');
      this.compositePass.renderToScreen = true;
      this.finalComposer.addPass(this.compositePass);

      // ----------------------------------------------------------------------
      // 3. Intercept A-Frame's renderer.render Loop
      // ----------------------------------------------------------------------
      const self = this;
      const originalRender = renderer.render.bind(renderer);
      this._originalRender = originalRender;
      let isRenderingComposer = false;

      renderer.render = function (scene, camera) {
        if (isRenderingComposer) {
          originalRender(scene, camera);
          return;
        }

        isRenderingComposer = true;
        try {
          const activeCamera = (sceneEl.camera && sceneEl.camera.isCamera) ? sceneEl.camera : camera;
          const activeScene = sceneEl.object3D || scene;

          if (!activeCamera || !activeScene || !self.bloomComposer || !self.finalComposer) {
            originalRender(scene, camera);
            return;
          }

          // Ensure pass references point to active scene and camera
          self.bloomRenderPass.camera = activeCamera;
          self.bloomRenderPass.scene = activeScene;
          self.finalRenderPass.camera = activeCamera;
          self.finalRenderPass.scene = activeScene;

          // Dynamic bloom intensity modulation based on proximity
          if (self.data.dynamicIntensity) {
            const prox = self.currentProximity;
            const now = performance.now();
            // Smooth scaling from 1.0x (idle) to 1.8x (intense discharge)
            let dynamicMult = 1.0 + Math.pow(prox, 1.2) * 0.8;
            if (prox > 0.8) {
              dynamicMult += Math.sin(now * 0.02) * 0.2;
            }
            self.bloomPass.strength = self.data.strength * dynamicMult;
          } else {
            self.bloomPass.strength = self.data.strength;
          }

          // Step 1: Render Layer 1 Only (3D Text, Lightning, Beacons, Sparks) to Bloom Composer
          activeCamera.layers.set(1);
          self.bloomComposer.render();

          // Step 2: Render All Layers (Base Hologram Platform + FX) and composite to canvas
          activeCamera.layers.enableAll();
          self.compositePass.uniforms.bloomTexture.value = self.bloomComposer.readBuffer.texture;
          self.finalComposer.render();
        } catch (err) {
          console.error('[bloom-effect] Render pipeline error:', err);
          originalRender(scene, camera);
        } finally {
          isRenderingComposer = false;
        }
      };

      // ----------------------------------------------------------------------
      // 4. Handle Window Resize
      // ----------------------------------------------------------------------
      this._onResize = this._onResize.bind(this);
      window.addEventListener('resize', this._onResize);

      console.log('[bloom-effect] Post-processing pipeline hooked into renderer.render.');
    },

    _onResize: function () {
      if (!this.sceneEl || !this.sceneEl.renderer || !this.bloomComposer || !this.finalComposer) return;

      const renderer = this.sceneEl.renderer;
      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pr = renderer.getPixelRatio() || 1;
      const w = Math.max(1, Math.floor(size.x * pr));
      const h = Math.max(1, Math.floor(size.y * pr));
      const downscale = this.data.downscale;

      const bloomW = Math.max(1, Math.floor(w * downscale));
      const bloomH = Math.max(1, Math.floor(h * downscale));

      this.bloomComposer.setSize(bloomW, bloomH);
      this.bloomPass.setSize(bloomW, bloomH);
      this.finalComposer.setSize(w, h);
    },

    _syncBloomLayers: function () {
      if (!this.sceneEl || !this.sceneEl.object3D) return;

      // Enable lights on Layer 1
      this.sceneEl.object3D.traverse((obj) => {
        if (obj.isLight) {
          obj.layers.enable(1);
        }
      });

      // Enable Layer 1 on bloom elements
      const bloomEntities = this.sceneEl.querySelectorAll('.bloom-fx, [three-text-3d]');
      bloomEntities.forEach((el) => {
        if (el.object3D) {
          el.object3D.traverse((child) => {
            if (child.isMesh || child.isPoints) {
              child.layers.enable(1);
            }
          });
        }
      });
    },

    tick: function () {
      // Periodically sync layers for newly spawned procedural meshes (e.g. 3D fonts loaded asynchronously)
      if (!this._lastSync || performance.now() - this._lastSync > 1000) {
        this._lastSync = performance.now();
        this._syncBloomLayers();
      }
    },

    remove: function () {
      if (this._onResize) {
        window.removeEventListener('resize', this._onResize);
      }
      if (this.sceneEl && this.sceneEl.renderer && this._originalRender) {
        this.sceneEl.renderer.render = this._originalRender;
      }
      if (this.bloomComposer) {
        this.bloomComposer.dispose();
      }
      if (this.finalComposer) {
        this.finalComposer.dispose();
      }
    }
  });
}
