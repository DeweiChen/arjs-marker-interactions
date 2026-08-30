/**
 * A-Frame Custom Component: bloom-effect
 * High-Performance Single-Composer Selective Bloom with Direct Screen Blending.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Additive Screen Glow Shader with ACES Filmic Tone Preservation
const GlowAdditiveShader = {
  name: 'GlowAdditiveShader',
  uniforms: {
    tDiffuse: { value: null },
    opacity: { value: 1.0 },
    exposure: { value: 1.1 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float opacity;
    uniform float exposure;
    varying vec2 vUv;

    vec3 ACESFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec4 glow = texture2D(tDiffuse, vUv);
      vec3 tonemapped = ACESFilm(glow.rgb * exposure);
      float alpha = clamp(dot(tonemapped, vec3(0.299, 0.587, 0.114)) * 1.5, 0.0, 1.0) * opacity;
      gl_FragColor = vec4(tonemapped, alpha);
    }
  `
};

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('bloom-effect', {
    schema: {
      enabled: { type: 'boolean', default: true },
      strength: { type: 'number', default: 1.3 },
      radius: { type: 'number', default: 0.3 },
      threshold: { type: 'number', default: 0.0 },
      downscale: { type: 'number', default: 0.25 },
      pulseRange: { type: 'number', default: 0.4 }
    },

    init: function () {
      this.sceneEl = this.el.sceneEl || this.el;
      this.isInitialized = false;
      this.enabled = this.data.enabled !== undefined ? this.data.enabled : true;

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

      this.sceneEl.addEventListener('set-bloom-enabled', (e) => {
        const { enabled } = e.detail || {};
        if (enabled !== undefined) this.setEnabled(enabled);
      });

      this.sceneEl.addEventListener('set-bloom-strength', (e) => {
        const { strength } = e.detail || {};
        if (strength !== undefined) this.setStrength(strength);
      });

      this.sceneEl.addEventListener('set-bloom-pulse-range', (e) => {
        const { pulseRange } = e.detail || {};
        if (pulseRange !== undefined) this.setPulseRange(pulseRange);
      });

      this.sceneEl.addEventListener('set-bloom-params', (e) => {
        const { enabled, strength, radius, threshold, pulseRange } = e.detail || {};
        if (enabled !== undefined) this.setEnabled(enabled);
        if (strength !== undefined) this.setStrength(strength);
        if (radius !== undefined) this.setRadius(radius);
        if (threshold !== undefined) this.setThreshold(threshold);
        if (pulseRange !== undefined) this.setPulseRange(pulseRange);
      });

      this.sceneEl.addEventListener('set-dpr', (e) => {
        const { dpr } = e.detail || {};
        if (dpr && this.sceneEl && this.sceneEl.renderer) {
          this.sceneEl.renderer.setPixelRatio(dpr);
          this._onResize();
        }
      });
    },

    update: function (oldData) {
      if (oldData && this.data.enabled !== oldData.enabled) {
        this.setEnabled(this.data.enabled);
      }
      if (this.bloomPass) {
        if (this.data.radius !== undefined) {
          this.bloomPass.radius = this.data.radius;
        }
        if (this.data.threshold !== undefined) {
          this.bloomPass.threshold = this.data.threshold;
        }
        if (this.data.strength !== undefined) {
          this.bloomPass.strength = this.data.strength;
        }
      }
    },

    setEnabled: function (val) {
      this.data.enabled = !!val;
      this.enabled = !!val;
      const renderer = this.sceneEl && this.sceneEl.renderer;
      if (renderer) {
        renderer.setRenderTarget(null);
        renderer.setClearColor(0x000000, 0);
        renderer.autoClear = !this.enabled;
      }
      if (this.sceneEl && this.sceneEl.object3D && this.sceneEl.object3D.background) {
        this.sceneEl.object3D.background = null;
      }
      if (this.sceneEl && this.sceneEl.camera) {
        const activeCamera = (this.sceneEl.camera && this.sceneEl.camera.isCamera) 
          ? this.sceneEl.camera 
          : (this.sceneEl.camera && this.sceneEl.camera.el && this.sceneEl.camera.el.getObject3D('camera'));
        if (activeCamera && activeCamera.layers) {
          activeCamera.layers.enableAll();
        }
      }
    },

    setStrength: function (val) {
      this.data.strength = Math.max(0, parseFloat(val) || 0);
      if (this.bloomPass) {
        this.bloomPass.strength = this.data.strength;
      }
    },

    setRadius: function (val) {
      this.data.radius = Math.max(0, parseFloat(val) || 0);
      if (this.bloomPass) {
        this.bloomPass.radius = this.data.radius;
      }
    },

    setThreshold: function (val) {
      this.data.threshold = Math.max(0, parseFloat(val) || 0);
      if (this.bloomPass) {
        this.bloomPass.threshold = this.data.threshold;
      }
    },

    setPulseRange: function (val) {
      this.data.pulseRange = Math.max(0, parseFloat(val) || 0);
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
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = !this.enabled;
      if (sceneEl.object3D && sceneEl.object3D.background) {
        sceneEl.object3D.background = null;
      }

      const targetDpr = window.devicePixelRatio || 1;
      renderer.setPixelRatio(targetDpr);

      this._syncBloomLayers();
      sceneEl.addEventListener('three-text-loaded', () => this._syncBloomLayers());
      sceneEl.addEventListener('child-attached', () => this._syncBloomLayers());

      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pr = renderer.getPixelRatio() || 1;
      const width = Math.max(1, Math.floor(size.x * pr));
      const height = Math.max(1, Math.floor(size.y * pr));
      const downscale = this.data.downscale || 0.25;

      const bloomW = Math.max(1, Math.floor(width * downscale));
      const bloomH = Math.max(1, Math.floor(height * downscale));

      const bloomRenderTarget = new THREE.WebGLRenderTarget(bloomW, bloomH, {
        type: THREE.UnsignedByteType,
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

      this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.postQuadGeom = new THREE.PlaneGeometry(2, 2);
      this.postQuadMat = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          opacity: { value: 1.0 },
          exposure: { value: 1.1 }
        },
        vertexShader: GlowAdditiveShader.vertexShader,
        fragmentShader: GlowAdditiveShader.fragmentShader,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      this.postQuadScene = new THREE.Scene();
      this.postQuadScene.add(new THREE.Mesh(this.postQuadGeom, this.postQuadMat));

      const self = this;
      const originalRender = renderer.render.bind(renderer);
      this._originalRender = originalRender;
      let isRenderingComposer = false;

      renderer.render = function (scene, camera) {
        if (isRenderingComposer) {
          originalRender(scene, camera);
          return;
        }

        const activeCamera = (sceneEl.camera && sceneEl.camera.isCamera) ? sceneEl.camera : camera;
        const activeScene = sceneEl.object3D || scene;

        if (!self.data.enabled || !self.enabled || self.data.strength <= 0) {
          if (activeScene && activeScene.background) {
            activeScene.background = null;
          }
          renderer.setRenderTarget(null);
          renderer.setClearColor(0x000000, 0);
          if (!renderer.autoClear) {
            renderer.autoClear = true;
          }
          if (activeCamera && activeCamera.layers) {
            activeCamera.layers.enableAll();
          }
          originalRender(activeScene, activeCamera);
          return;
        }

        isRenderingComposer = true;
        try {
          if (!activeCamera || !activeScene || !self.bloomComposer) {
            renderer.setRenderTarget(null);
            renderer.setClearColor(0x000000, 0);
            originalRender(activeScene || scene, activeCamera || camera);
            return;
          }

          self.bloomRenderPass.camera = activeCamera;
          self.bloomRenderPass.scene = activeScene;

          const now = performance.now();
          const pulseRange = self.data.pulseRange !== undefined ? self.data.pulseRange : 0.25;
          const breathOffset = (self.data.strength > 0 && pulseRange > 0)
            ? Math.sin((now / 1500) * Math.PI) * pulseRange
            : 0;
          const baseStrength = Math.max(0, self.data.strength + breathOffset);

          self.bloomPass.strength = baseStrength;

          activeCamera.layers.set(1);
          self.bloomComposer.render();

          activeCamera.layers.enableAll();
          renderer.setRenderTarget(null);
          renderer.setClearColor(0x000000, 0);
          renderer.autoClear = true;
          originalRender(activeScene, activeCamera);

          renderer.autoClear = false;
          self.postQuadMat.uniforms.tDiffuse.value = self.bloomComposer.readBuffer.texture;
          originalRender(self.postQuadScene, self.postCamera);
        } catch (err) {
          console.error('[bloom-effect] Render pipeline error:', err);
          renderer.setRenderTarget(null);
          renderer.setClearColor(0x000000, 0);
          originalRender(activeScene || scene, activeCamera || camera);
        } finally {
          isRenderingComposer = false;
        }
      };

      this._onResize = this._onResize.bind(this);
      window.addEventListener('resize', this._onResize);

      console.log('[bloom-effect] Streamlined Single-Composer Post-processing initialized.');
    },

    _onResize: function () {
      if (!this.sceneEl || !this.sceneEl.renderer || !this.bloomComposer) return;

      const renderer = this.sceneEl.renderer;
      const size = new THREE.Vector2();
      renderer.getSize(size);
      const pr = renderer.getPixelRatio() || 1;
      const w = Math.max(1, Math.floor(size.x * pr));
      const h = Math.max(1, Math.floor(size.y * pr));
      const downscale = this.data.downscale || 0.25;

      const bloomW = Math.max(1, Math.floor(w * downscale));
      const bloomH = Math.max(1, Math.floor(h * downscale));

      this.bloomComposer.setSize(bloomW, bloomH);
      this.bloomPass.setSize(bloomW, bloomH);
    },

    _syncBloomLayers: function () {
      if (!this.sceneEl || !this.sceneEl.object3D) return;

      this.sceneEl.object3D.traverse((obj) => {
        if (obj.isLight) {
          obj.layers.enable(1);
        }
      });

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

    remove: function () {
      if (this._onResize) {
        window.removeEventListener('resize', this._onResize);
      }
      if (this.sceneEl && this.sceneEl.renderer && this._originalRender) {
        this.sceneEl.renderer.render = this._originalRender;
        this.sceneEl.renderer.setRenderTarget(null);
        this.sceneEl.renderer.setClearColor(0x000000, 0);
        this.sceneEl.renderer.autoClear = true;
      }
      if (this.bloomComposer) {
        this.bloomComposer.dispose();
      }
      if (this.postQuadGeom) {
        this.postQuadGeom.dispose();
      }
      if (this.postQuadMat) {
        this.postQuadMat.dispose();
      }
    }
  });
}
