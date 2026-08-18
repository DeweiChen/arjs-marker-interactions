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
   * 初始化 Three.js 場景與 AR.js 核心
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

    // 2. Camera (AR.js 會在 context init 後更新投影矩陣)
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
    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    // 主方向光（柔和陰影與高光）
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 5, 3);
    this.scene.add(dirLight);

    // 補光
    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.6);
    fillLight.position.set(-2, -3, -1);
    this.scene.add(fillLight);
  }

  _initArToolkit() {
    return new Promise((resolve, reject) => {
      // 1. 初始化攝影機視訊來源
      this.arToolkitSource = new ArToolkitSource({
        sourceType: 'webcam'
      });

      this.arToolkitSource.init(
        () => {
          setTimeout(() => {
            this._onResize();
          }, 500);
        },
        (err) => {
          console.error('AR Toolkit Source init failed:', err);
          reject(err);
        }
      );

      // 2. 初始化 AR Context (追蹤辨識核心)
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
        // 將 AR 攝影機投影矩陣同步至 Three.js 相機
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
   * 註冊每幀更新 callback
   */
  onRender(fn) {
    this.renderCallbacks.push(fn);
  }

  /**
   * 啟動主渲染迴圈
   */
  startLoop() {
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // 1. 更新 ARToolkitContext (處理攝影機影像識別)
      if (this.arToolkitSource && this.arToolkitSource.ready) {
        this.arToolkitContext.update(this.arToolkitSource.domElement);
      }

      // 2. 執行所有註冊的渲染邏輯 (例如 3D 物件旋轉、狀態監聽等)
      for (const cb of this.renderCallbacks) {
        cb(delta, elapsedTime);
      }

      // 3. 繪製 Three.js 場景
      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
  }
}
