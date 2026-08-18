import * as THREE from 'three';

// AR.js relies on THREE on the global window object
window.THREE = THREE;

import {
  ArToolkitSource,
  ArToolkitContext
} from '@ar-js-org/ar.js/three.js/build/ar-threex.mjs';

export class ARScene {
  constructor(containerId = 'ar-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`AR container #${containerId} not found`);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.arToolkitSource = null;
    this.arToolkitContext = null;
    this.renderCallbacks = [];
    this.isReady = false;
  }

  /**
   * Initialize Three.js scene and AR.js core
   */
  async init() {
    this._initThree();
    this._initLights();
    await this._initArToolkit();
    this._setupResizeHandler();
    this.isReady = true;
  }

  _initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera (AR.js updates the projection matrix after context initialization)
    this.camera = new THREE.Camera();
    this.scene.add(this.camera);

    // 3. WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(new THREE.Color('lightgrey'), 0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  _initLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    // Main directional light (soft shadows & highlights)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 5, 3);
    this.scene.add(dirLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.6);
    fillLight.position.set(-2, -3, -1);
    this.scene.add(fillLight);
  }

  _initArToolkit() {
    return new Promise((resolve, reject) => {
      // 1. Initialize camera video source
      this.arToolkitSource = new ArToolkitSource({
        sourceType: 'webcam'
      });

      this.arToolkitSource.init(
        () => {
          this._onResize();
          setTimeout(() => {
            this._onResize();
          }, 500);
        },
        (err) => {
          console.error('AR Toolkit Source init failed:', err);
          reject(err);
        }
      );

      window.addEventListener('arjs-video-loaded', () => {
        this._onResize();
      });

      // 2. Initialize AR Context (tracking & recognition core)
      const baseUrl = import.meta.env.BASE_URL || '/';
      const cameraParamUrl = `${baseUrl}data/camera_para.dat`;

      this.arToolkitContext = new ArToolkitContext({
        cameraParametersUrl: cameraParamUrl,
        detectionMode: 'mono',
        maxDetectionRate: 60,
        canvasWidth: 800,
        canvasHeight: 600
      });

      this.arToolkitContext.init(() => {
        // Synchronize AR camera projection matrix to Three.js camera
        this.camera.projectionMatrix.copy(this.arToolkitContext.getProjectionMatrix());
        resolve();
      });
    });
  }

  _setupResizeHandler() {
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    if (!this.arToolkitSource || !this.arToolkitSource.ready) return;

    this.arToolkitSource.onResizeElement();
    this.arToolkitSource.copyElementSizeTo(this.renderer.domElement);

    if (this.arToolkitContext && this.arToolkitContext.arController !== null) {
      this.arToolkitSource.copyElementSizeTo(this.arToolkitContext.arController.canvas);
    }
  }

  /**
   * Register per-frame render callback
   */
  onRender(fn) {
    this.renderCallbacks.push(fn);
  }

  /**
   * Start main animation and render loop
   */
  startLoop() {
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // 1. Update ARToolkitContext (process webcam image recognition)
      if (this.arToolkitSource && this.arToolkitSource.ready) {
        this.arToolkitContext.update(this.arToolkitSource.domElement);
      }

      // 2. Execute all registered render callbacks (e.g. 3D object rotation, state monitoring)
      for (const cb of this.renderCallbacks) {
        cb(delta, elapsedTime);
      }

      // 3. Render Three.js scene
      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
  }
}
