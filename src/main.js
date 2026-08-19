/**
 * Application Bootstrap, HUD Controller & Real-Time Performance Telemetry
 * Monitors AR tracking states, calculates FPS / Frame Latency, and synchronizes HUD telemetry.
 */

import './style.css';
import './marker-stabilizer.js';
import './proximity-component.js';
import './three-text-3d.js';
import './bloom-effect.js';

document.addEventListener('DOMContentLoaded', () => {
  const sceneEl = document.querySelector('a-scene');

  // Top Telemetry DOM Elements
  const badgeFps = document.getElementById('badge-fps');
  const fpsVal = document.getElementById('fps-val');
  const frametimeVal = document.getElementById('frametime-val');

  // Bottom Status & Energy DOM Elements
  const distanceVal = document.getElementById('distance-val');
  const energyBar = document.getElementById('energy-bar');
  const energyStatusText = document.getElementById('energy-status-text');

  // Modal elements
  const btnShowMarkers = document.getElementById('btn-show-markers');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalBackdrop = document.getElementById('markers-modal');

  // Fullscreen & Immersive Mode Elements
  const btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
  const iconFsEnter = document.getElementById('icon-fs-enter');
  const iconFsExit = document.getElementById('icon-fs-exit');
  const fsBtnText = document.getElementById('fs-btn-text');
  const btnRestoreHud = document.getElementById('btn-restore-hud');
  const hudToast = document.getElementById('hud-toast');

  // Bloom Control 2D Panel DOM Elements
  const btnToggleBloom = document.getElementById('btn-toggle-bloom');
  const bloomHudDot = document.getElementById('bloom-hud-dot');
  const bloomPanel = document.getElementById('bloom-control-panel');
  const btnCloseBloom = document.getElementById('btn-close-bloom');
  const btnResetBloom = document.getElementById('btn-reset-bloom');
  const chkMasterBloom = document.getElementById('chk-master-bloom');
  const valBloomStatus = document.getElementById('val-bloom-status');
  const bloomStrengthGroup = document.getElementById('bloom-strength-group');
  const sliderBloomStrength = document.getElementById('slider-bloom-strength');
  const valBloomStrength = document.getElementById('val-bloom-strength');
  const presetBtns = document.querySelectorAll('.bloom-preset-btn');
  const bloomPulseGroup = document.getElementById('bloom-pulse-group');
  const sliderPulseRange = document.getElementById('slider-pulse-range');
  const valPulseRange = document.getElementById('val-pulse-range');
  const pulsePresetBtns = document.querySelectorAll('.pulse-preset-btn');
  const chkDynamicIntensity = document.getElementById('chk-dynamic-intensity');
  const chkPitchFacing = document.getElementById('chk-pitch-facing');

  // DPR Resolution Control DOM Elements
  const valDpr = document.getElementById('val-dpr');
  const dprBtns = document.querySelectorAll('.dpr-preset-btn');
  const resRenderPx = document.getElementById('res-render-px');
  const resRenderMp = document.getElementById('res-render-mp');
  const resCameraPx = document.getElementById('res-camera-px');
  const resCameraMp = document.getElementById('res-camera-mp');
  const resViewportAspect = document.getElementById('res-viewport-aspect');
  const resViewportBadge = document.getElementById('res-viewport-badge');
  let currentDprSetting = localStorage.getItem('ar_custom_dpr') || 'native';

  // Tracking state store
  const stateStore = {
    isHiroVisible: false,
    isKanjiVisible: false,
    proximityPercent: 0,
    proximityActive: false,
    distance: null
  };

  // ------------------------------------------------------------------------
  // Prevent Unintended Browser Zooming & Gesture Scaling
  // ------------------------------------------------------------------------
  function initAntiZoomProtection() {
    // 1. Prevent iOS gesture-based zooming (Pinch / Rotate gesture on Safari)
    const preventGesture = (e) => {
      e.preventDefault();
    };
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });

    // 2. Prevent multi-touch pinch zoom on document touchmove
    document.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // 3. Prevent rapid double-tap to zoom on mobile browsers
    let lastTouchTime = 0;
    document.addEventListener('touchend', (e) => {
      const now = performance.now();
      if (now - lastTouchTime <= 300) {
        e.preventDefault();
        // Trigger click if it was an interactive button so button actions remain responsive
        if (e.target && typeof e.target.click === 'function' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
          e.target.click();
        }
      }
      lastTouchTime = now;
    }, { passive: false });

    // 4. Prevent Ctrl / Meta + Wheel zoom on desktop browsers
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    }, { passive: false });

    // 5. Prevent keyboard zoom shortcuts (Ctrl/Cmd +/-/0)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '0')) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  initAntiZoomProtection();

  // ------------------------------------------------------------------------
  // AR.js Dynamic Viewport Aspect Ratio & Projection Matrix Correction System
  // ------------------------------------------------------------------------
  let isCorrectionInitialized = false;

  function getARObjects() {
    const arSystem = sceneEl && sceneEl.systems && sceneEl.systems.arjs;
    const arSession = arSystem && (arSystem._arSession || arSystem);
    const arSource = arSession && (arSession.arSource || arSystem.arSource);
    const arContext = arSession && (arSession.arContext || arSystem.arContext);
    const video = (arSource && arSource.domElement) || document.querySelector('#arjs-video') || document.querySelector('video');
    return { arSystem, arSession, arSource, arContext, video };
  }

  /**
   * Mathematically corrects the AR projection matrix to compensate for viewport aspect ratio cropping.
   * Eliminates the ~3.8x horizontal/vertical stretch distortion in mobile portrait & ultra-wide landscape.
   *
   * @param {THREE.Matrix4} originalMatrix - Raw projection matrix from ARToolKit
   * @param {HTMLVideoElement} videoEl - Active camera video element
   * @returns {THREE.Matrix4} Corrected projection matrix matching visible screen viewport
   */
  function calculateCorrectedProjectionMatrix(originalMatrix, videoEl) {
    if (!originalMatrix || !originalMatrix.elements) return originalMatrix;

    const Ws = window.innerWidth;
    const Hs = window.innerHeight;
    if (Ws <= 0 || Hs <= 0) return originalMatrix;

    const { arSource } = getARObjects();
    const Wv = (videoEl && videoEl.videoWidth > 0) ? videoEl.videoWidth : ((arSource && arSource.parameters && arSource.parameters.sourceWidth) || 1280);
    const Hv = (videoEl && videoEl.videoHeight > 0) ? videoEl.videoHeight : ((arSource && arSource.parameters && arSource.parameters.sourceHeight) || 720);

    if (Wv <= 0 || Hv <= 0) return originalMatrix;

    const Rs = Ws / Hs; // Viewport aspect ratio (e.g. 0.46 on mobile portrait)
    const Rv = Wv / Hv; // Camera stream aspect ratio (e.g. 1.777 for 16:9)

    const corrected = originalMatrix.clone();
    const el = corrected.elements;

    if (Rs < Rv) {
      // Portrait mode (or screen taller/narrower than camera stream):
      // The video fills height and is cropped on left & right.
      // Visible horizontal fraction: kx = Rs / Rv.
      // Multiply horizontal focal scale (el[0]) and principal point x (el[8]) by 1 / kx:
      const kx = Rs / Rv;
      el[0] /= kx;
      el[8] /= kx;
    } else if (Rs > Rv) {
      // Ultra-wide Landscape mode (or screen wider than camera stream):
      // The video fills width and is cropped on top & bottom.
      // Visible vertical fraction: ky = Rv / Rs.
      // Multiply vertical focal scale (el[5]) and principal point y (el[9]) by 1 / ky:
      const ky = Rv / Rs;
      el[5] /= ky;
      el[9] /= ky;
    }
    // If Rs === Rv (e.g. 4:3 screen with 4:3 camera): exact match, no modification needed.

    return corrected;
  }

  function tryInitAspectCorrection() {
    if (isCorrectionInitialized) return;

    const { arSource, arContext, video } = getARObjects();
    if (!arContext) {
      return;
    }

    isCorrectionInitialized = true;

    // 1. Override arSource.copyElementSizeTo to PREVENT AR.js from altering document.body
    // and from enforcing obsolete 4/3 aspect ratio in portrait mode!
    if (arSource && typeof arSource.copyElementSizeTo === 'function') {
      arSource.copyElementSizeTo = function (target) {
        if (!target || target === document.body) {
          return; // Never allow AR.js to alter document.body dimensions or margin!
        }
        if (target.tagName === 'CANVAS' || target.classList.contains('a-canvas')) {
          target.style.width = '100vw';
          target.style.height = '100dvh';
          target.style.marginLeft = '0px';
          target.style.marginTop = '0px';
          target.style.top = '0px';
          target.style.left = '0px';
          return;
        }
        if (this.domElement) {
          target.style.width = this.domElement.style.width;
          target.style.height = this.domElement.style.height;
          target.style.marginLeft = this.domElement.style.marginLeft;
          target.style.marginTop = this.domElement.style.marginTop;
        }
      };
    }

    // 2. Wrap arContext.getProjectionMatrix to return mathematically corrected projection matrix
    if (typeof arContext.getProjectionMatrix === 'function') {
      const originalGetProjectionMatrix = arContext.getProjectionMatrix.bind(arContext);
      arContext.getProjectionMatrix = function () {
        const originalMat = originalGetProjectionMatrix();
        const curVideo = (arSource && arSource.domElement) || document.querySelector('#arjs-video') || document.querySelector('video');
        return calculateCorrectedProjectionMatrix(originalMat, curVideo);
      };
    }

    console.log('[AR Aspect Correction] Dynamic projection matrix and viewport synchronizer hooked successfully.');
  }

  // ------------------------------------------------------------------------
  // App-Switch Recovery, Viewport Scale Reset & Camera Sync System
  // ------------------------------------------------------------------------
  let resizeTimer = null;

  function resetVisualViewportZoom() {
    // Prevent iOS / mobile browser visual viewport auto-zoom glitch when switching apps
    try {
      window.scrollTo(0, 0);
      if (window.visualViewport && window.visualViewport.scale !== 1.0) {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          const originalContent = viewportMeta.getAttribute('content');
          viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
          setTimeout(() => {
            viewportMeta.setAttribute('content', originalContent || 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
          }, 60);
        }
      }
    } catch (_) {}
  }

  function syncARViewport() {
    resetVisualViewportZoom();

    // Ensure Aspect Correction is hooked as soon as AR session is available
    tryInitAspectCorrection();

    const { arSource, arContext, video } = getARObjects();

    // 1. If camera video was paused by OS when switching apps, resume it
    if (video && video.tagName === 'VIDEO') {
      if (video.paused) {
        video.play().catch(() => {});
      }
      // If video stream is still recovering (dimensions not yet available), wait for metadata
      if (!video.videoWidth || !video.videoHeight) {
        video.onloadedmetadata = () => {
          syncARViewport();
        };
      }
    }

    // 2. Force AR.js to recalculate video element layout styles
    if (arSource && typeof arSource.onResizeElement === 'function') {
      arSource.onResizeElement();
    }

    // 3. Synchronize AR controller canvas & update context projection matrix
    if (arContext && arContext.arController && arContext.arController.canvas && arSource) {
      arSource.copyElementSizeTo(arContext.arController.canvas);
      arContext.update();
    }

    // 4. Synchronize A-Frame camera & renderer viewport
    if (sceneEl && sceneEl.renderer) {
      const activeDpr = getEffectiveDPR(currentDprSetting);
      if (sceneEl.renderer.getPixelRatio() !== activeDpr) {
        sceneEl.renderer.setPixelRatio(activeDpr);
      }
      sceneEl.renderer.setSize(window.innerWidth, window.innerHeight, false);
      sceneEl.renderer.setClearColor(0x000000, 0);

      // Update camera projection matrix with mathematically corrected AR matrix
      if (sceneEl.camera && sceneEl.camera.isCamera) {
        if (arContext && typeof arContext.getProjectionMatrix === 'function') {
          try {
            const correctedMatrix = arContext.getProjectionMatrix();
            if (correctedMatrix) {
              sceneEl.camera.projectionMatrix.copy(correctedMatrix);
            }
          } catch (_) {
            sceneEl.camera.aspect = window.innerWidth / window.innerHeight;
            sceneEl.camera.updateProjectionMatrix();
          }
        } else {
          sceneEl.camera.aspect = window.innerWidth / window.innerHeight;
          sceneEl.camera.updateProjectionMatrix();
        }
      }
    }

    // 5. Update Bloom Effect post-processing buffers if active
    const bloomComponent = sceneEl && sceneEl.components && sceneEl.components['bloom-effect'];
    if (bloomComponent && typeof bloomComponent._onResize === 'function') {
      bloomComponent._onResize();
    }

    // 6. Update Resolution Metrics in Settings Panel
    updateResolutionDisplay();
  }

  function debouncedSyncARViewport() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      syncARViewport();
    }, 100);
  }

  function multiStageSyncARViewport() {
    syncARViewport();
    setTimeout(syncARViewport, 100);
    setTimeout(syncARViewport, 300);
    setTimeout(syncARViewport, 600);
    setTimeout(syncARViewport, 1000);
  }

  window.addEventListener('resize', debouncedSyncARViewport);
  window.addEventListener('orientationchange', () => {
    multiStageSyncARViewport();
  });

  // Handle App Switching (Background <-> Foreground Lifecycle)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      multiStageSyncARViewport();
    }
  });

  window.addEventListener('pageshow', () => {
    multiStageSyncARViewport();
  });

  window.addEventListener('focus', () => {
    multiStageSyncARViewport();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedSyncARViewport);
  }

  window.addEventListener('arjs-video-loaded', (e) => {
    tryInitAspectCorrection();
    const video = (e && e.detail && e.detail.component) || document.querySelector('#arjs-video') || document.querySelector('video');
    if (video) {
      const onVideoReady = () => {
        multiStageSyncARViewport();
      };
      video.addEventListener('loadedmetadata', onVideoReady);
      video.addEventListener('playing', onVideoReady);
      video.addEventListener('canplay', onVideoReady);
    }
    multiStageSyncARViewport();
  });

  window.addEventListener('arToolkitContext-loaded', () => {
    tryInitAspectCorrection();
    multiStageSyncARViewport();
  });

  if (sceneEl) {
    sceneEl.addEventListener('renderstart', () => {
      tryInitAspectCorrection();
      multiStageSyncARViewport();
    });
    sceneEl.addEventListener('loaded', () => {
      tryInitAspectCorrection();
      multiStageSyncARViewport();
    });
  }

  // ------------------------------------------------------------------------
  // Setup Fullscreen & Immersive Mode Controller
  // ------------------------------------------------------------------------
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let isImmersiveMode = false;
  let toastTimer = null;

  function showToast(message, duration = 3200) {
    if (!hudToast) return;
    hudToast.textContent = message;
    hudToast.classList.remove('hidden');
    hudToast.style.opacity = '1';
    hudToast.style.transform = 'translate(-50%, -50%) scale(1)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hudToast.style.opacity = '0';
      hudToast.style.transform = 'translate(-50%, -50%) scale(0.95)';
      setTimeout(() => {
        hudToast.classList.add('hidden');
      }, 300);
    }, duration);
  }

  function isNativeFullscreen() {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function setImmersiveMode(active) {
    isImmersiveMode = active;
    document.body.classList.toggle('hud-collapsed', active);

    if (btnRestoreHud) {
      btnRestoreHud.classList.toggle('hidden', !active);
    }
    if (btnToggleFullscreen) {
      btnToggleFullscreen.classList.toggle('active', active);
      btnToggleFullscreen.setAttribute('title', active ? 'Restore HUD (還原控制列)' : 'Toggle Fullscreen Mode (全螢幕沉浸模式)');
      btnToggleFullscreen.setAttribute('aria-label', active ? 'Restore HUD' : 'Toggle Fullscreen Mode');
    }
    if (iconFsEnter) iconFsEnter.classList.toggle('hidden', active);
    if (iconFsExit) iconFsExit.classList.toggle('hidden', !active);
    if (fsBtnText) fsBtnText.textContent = active ? 'Exit' : 'Full';

    // If panel is open when collapsing, close panel
    if (active && bloomPanel && !bloomPanel.classList.contains('hidden')) {
      bloomPanel.classList.add('hidden');
      if (btnToggleBloom) {
        btnToggleBloom.classList.remove('active');
        btnToggleBloom.setAttribute('aria-expanded', 'false');
      }
    }

    syncARViewport();
    setTimeout(syncARViewport, 150);
    setTimeout(syncARViewport, 350);
    setTimeout(syncARViewport, 600);
  }

  let wasInNativeFullscreen = false;

  async function toggleFullscreen() {
    const isCurrentlyFs = isImmersiveMode || isNativeFullscreen();
    const willActivate = !isCurrentlyFs;

    if (willActivate) {
      let nativeSuccess = false;
      const target = document.documentElement;

      // 1. Attempt native Fullscreen API with fallbacks
      try {
        if (target.requestFullscreen) {
          try {
            await target.requestFullscreen({ navigationUI: 'hide' });
            nativeSuccess = true;
          } catch {
            await target.requestFullscreen();
            nativeSuccess = true;
          }
        } else if (target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen();
          nativeSuccess = true;
        } else if (document.body && document.body.webkitRequestFullscreen) {
          await document.body.webkitRequestFullscreen();
          nativeSuccess = true;
        }
      } catch (err) {
        console.warn('Native Fullscreen API not allowed/supported in this browser context:', err);
      }

      wasInNativeFullscreen = nativeSuccess || isNativeFullscreen();

      // 2. Hide mobile URL bar scroll nudge if applicable
      try { window.scrollTo(0, 1); } catch (_) {}

      // 3. Activate Immersive Mode (Collapses HUD to maximize AR camera area)
      setImmersiveMode(true);

      // 4. Platform-tailored user feedback
      if (isIOS) {
        const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        if (!isStandalone) {
          showToast('📱 已進入純淨滿版模式！(iOS 限制瀏覽器網址列無法自動隱藏，建議點選分享加入主畫面)', 4500);
        } else {
          showToast('✨ 已啟用滿版全螢幕模式', 2500);
        }
      } else {
        if (nativeSuccess) {
          showToast('⚡ 已進入原生全螢幕沉浸模式', 3000);
        } else {
          showToast('✨ 已啟用滿版純淨視角 (點擊右上角按鈕可隨時還原介面)', 3500);
        }
      }
    } else {
      // Exit Fullscreen & Restore HUD
      try {
        if (isNativeFullscreen()) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          }
        }
      } catch (err) {
        console.warn('exitFullscreen error:', err);
      }
      wasInNativeFullscreen = false;
      setImmersiveMode(false);
      showToast('已還原正常 HUD 介面', 2000);
    }
  }

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', toggleFullscreen);
  }

  if (btnRestoreHud) {
    btnRestoreHud.addEventListener('click', () => {
      setImmersiveMode(false);
      showToast('已還原控制列', 2000);
    });
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      const inNative = isNativeFullscreen();
      // Only auto-exit if the user actually exited from an active native fullscreen session (e.g. system back/gesture)
      if (wasInNativeFullscreen && !inNative && isImmersiveMode) {
        setImmersiveMode(false);
      }
      wasInNativeFullscreen = inNative;
    });
  });

  // ------------------------------------------------------------------------
  // Setup Marker Pattern Modal Dialog
  // ------------------------------------------------------------------------
  if (btnShowMarkers && modalBackdrop && btnCloseModal) {
    btnShowMarkers.addEventListener('click', () => {
      modalBackdrop.classList.remove('hidden');
    });

    btnCloseModal.addEventListener('click', () => {
      modalBackdrop.classList.add('hidden');
    });

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.add('hidden');
      }
    });
  }

  // ------------------------------------------------------------------------
  // Setup 2D Bloom & AR Settings Control Panel
  // ------------------------------------------------------------------------
  const defaultBloomSettings = {
    enabled: true,
    strength: 1.3,
    radius: 0.3,
    threshold: 0.0,
    pulseRange: 0.4,
    dynamicIntensity: true,
    pitchFacing: true
  };

  let isBloomActive = localStorage.getItem('ar_bloom_enabled') !== 'false';
  let lastPositiveStrength = 1.3;
  let currentPulseRange = parseFloat(localStorage.getItem('ar_pulse_range') || '0.4');

  function updateBloomPresetsUI(currentStrength, isEnabled = true) {
    if (!isEnabled) {
      presetBtns.forEach((btn) => {
        btn.classList.toggle('active', parseFloat(btn.dataset.strength) === 0);
      });
      return;
    }
    const roundedStrength = Math.round(currentStrength * 10) / 10;
    presetBtns.forEach((btn) => {
      const presetVal = parseFloat(btn.dataset.strength);
      btn.classList.toggle('active', Math.abs(presetVal - roundedStrength) < 0.05);
    });
  }

  function applyBloomEnabled(enabled, showToastMsg = false) {
    isBloomActive = !!enabled;

    if (chkMasterBloom) {
      chkMasterBloom.checked = isBloomActive;
    }

    if (valBloomStatus) {
      if (isBloomActive) {
        valBloomStatus.textContent = 'ON';
        valBloomStatus.className = 'bloom-status-badge status-active';
      } else {
        valBloomStatus.textContent = 'OFF (Bypassed)';
        valBloomStatus.className = 'bloom-status-badge status-off';
      }
    }

    if (bloomStrengthGroup) {
      bloomStrengthGroup.classList.toggle('bloom-disabled', !isBloomActive);
    }

    if (bloomPulseGroup) {
      bloomPulseGroup.classList.toggle('bloom-disabled', !isBloomActive);
    }

    if (bloomHudDot) {
      bloomHudDot.classList.toggle('active', isBloomActive);
    }

    // Update preset buttons state
    if (!isBloomActive) {
      updateBloomPresetsUI(0, false);
    } else {
      const currentVal = parseFloat(sliderBloomStrength ? sliderBloomStrength.value : lastPositiveStrength);
      updateBloomPresetsUI(currentVal > 0 ? currentVal : lastPositiveStrength, true);
    }

    if (sceneEl) {
      sceneEl.emit('set-bloom-params', { enabled: isBloomActive });
    }

    try {
      localStorage.setItem('ar_bloom_enabled', String(isBloomActive));
    } catch (_) {}

    if (showToastMsg) {
      if (isBloomActive) {
        showToast('✨ Bloom 特效已啟用 (2-Pass Post-Processing)', 2200);
      } else {
        showToast('⚡ Bloom 特效已關閉（已完全跳過 Composer，0 額外 Pass）', 2800);
      }
    }
  }

  function applyBloomStrength(val, autoWakeBloom = true) {
    const num = Math.max(0, parseFloat(val) || 0);
    if (num > 0) {
      lastPositiveStrength = num;
    }

    if (valBloomStrength) {
      valBloomStrength.textContent = `${num.toFixed(2)}x`;
    }
    if (sliderBloomStrength && Math.abs(parseFloat(sliderBloomStrength.value) - num) > 0.001) {
      sliderBloomStrength.value = num;
    }

    if (num === 0) {
      if (isBloomActive) {
        applyBloomEnabled(false, false);
      }
    } else if (autoWakeBloom && !isBloomActive) {
      applyBloomEnabled(true, false);
    }

    updateBloomPresetsUI(num, isBloomActive);

    if (sceneEl) {
      sceneEl.emit('set-bloom-params', { strength: num });
    }
  }

  function applyDynamicIntensity(enabled) {
    if (chkDynamicIntensity) {
      chkDynamicIntensity.checked = enabled;
    }
    if (sceneEl) {
      sceneEl.emit('set-bloom-params', { dynamicIntensity: enabled });
    }
  }

  function applyPitchFacing(enabled) {
    if (chkPitchFacing) {
      chkPitchFacing.checked = enabled;
    }
    const textEls = document.querySelectorAll('[three-text-3d]');
    textEls.forEach((el) => {
      el.setAttribute('three-text-3d', 'pitchFacing', enabled);
    });
    if (sceneEl) {
      sceneEl.emit('set-text-pitch-facing', { enabled });
    }
  }

  // Toggle Panel Open/Close
  if (btnToggleBloom && bloomPanel) {
    btnToggleBloom.addEventListener('click', () => {
      const isHidden = bloomPanel.classList.toggle('hidden');
      btnToggleBloom.classList.toggle('active', !isHidden);
      btnToggleBloom.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  if (btnCloseBloom && bloomPanel && btnToggleBloom) {
    btnCloseBloom.addEventListener('click', () => {
      bloomPanel.classList.add('hidden');
      btnToggleBloom.classList.remove('active');
      btnToggleBloom.setAttribute('aria-expanded', 'false');
    });
  }

  // Master Bloom Checkbox Event
  if (chkMasterBloom) {
    chkMasterBloom.addEventListener('change', (e) => {
      const willEnable = e.target.checked;
      applyBloomEnabled(willEnable, true);
      if (willEnable) {
        const curStrength = parseFloat(sliderBloomStrength ? sliderBloomStrength.value : 0);
        if (curStrength <= 0) {
          applyBloomStrength(lastPositiveStrength || defaultBloomSettings.strength, false);
        } else {
          applyBloomStrength(curStrength, false);
        }
      }
    });
  }

  // Reset to Defaults
  if (btnResetBloom) {
    btnResetBloom.addEventListener('click', () => {
      applyBloomEnabled(defaultBloomSettings.enabled, false);
      applyBloomStrength(defaultBloomSettings.strength);
      if (sceneEl) {
        sceneEl.emit('set-bloom-params', {
          radius: defaultBloomSettings.radius,
          threshold: defaultBloomSettings.threshold
        });
      }
      applyDynamicIntensity(defaultBloomSettings.dynamicIntensity);
      applyPitchFacing(defaultBloomSettings.pitchFacing);
      applyPulseRange(defaultBloomSettings.pulseRange, false);
      applyDPR('native', false);
      showToast('已還原 Bloom 與渲染預設設定', 2000);
    });
  }

  // Strength Slider Events
  if (sliderBloomStrength) {
    sliderBloomStrength.addEventListener('input', (e) => {
      applyBloomStrength(e.target.value, true);
    });
  }

  // Preset Buttons
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const strength = parseFloat(btn.dataset.strength);
      if (!isNaN(strength)) {
        if (strength === 0) {
          applyBloomStrength(0, false);
          applyBloomEnabled(false, true);
        } else {
          if (!isBloomActive) {
            applyBloomEnabled(true, true);
          }
          applyBloomStrength(strength, false);
        }
      }
    });
  });

  // Dynamic Intensity Checkbox
  if (chkDynamicIntensity) {
    chkDynamicIntensity.addEventListener('change', (e) => {
      applyDynamicIntensity(e.target.checked);
    });
  }

  // Text Elevation Pitch Facing Checkbox (Default OFF)
  if (chkPitchFacing) {
    chkPitchFacing.addEventListener('change', (e) => {
      applyPitchFacing(e.target.checked);
    });
  }

  // ------------------------------------------------------------------------
  // Breathing Pulse Amplitude Controller (0.0x ~ 0.60x)
  // ------------------------------------------------------------------------
  function updatePulsePresetsUI(currentVal) {
    pulsePresetBtns.forEach((btn) => {
      const presetVal = parseFloat(btn.dataset.pulse);
      btn.classList.toggle('active', Math.abs(presetVal - currentVal) < 0.04);
    });
  }

  function applyPulseRange(val, showToastMsg = false) {
    const num = Math.max(0, Math.min(1.0, parseFloat(val) || 0));
    currentPulseRange = num;

    if (valPulseRange) {
      valPulseRange.textContent = num === 0 ? '0.00x (Off)' : `±${num.toFixed(2)}x`;
    }
    if (sliderPulseRange && Math.abs(parseFloat(sliderPulseRange.value) - num) > 0.005) {
      sliderPulseRange.value = num;
    }
    updatePulsePresetsUI(num);

    if (sceneEl) {
      sceneEl.emit('set-bloom-params', { pulseRange: num });
    }

    try {
      localStorage.setItem('ar_pulse_range', String(num));
    } catch (_) {}

    if (showToastMsg) {
      showToast(`✨ 呼吸燈起伏幅度: ${num === 0 ? '關閉' : '±' + num.toFixed(2) + 'x'}`);
    }
  }

  if (sliderPulseRange) {
    sliderPulseRange.addEventListener('input', (e) => {
      applyPulseRange(e.target.value, false);
    });
  }

  pulsePresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pulseVal = parseFloat(btn.dataset.pulse);
      if (!isNaN(pulseVal)) {
        applyPulseRange(pulseVal, true);
      }
    });
  });

  // Initialize Bloom State & Pulse from Storage
  if (!isBloomActive) {
    applyBloomEnabled(false, false);
  }
  applyPulseRange(currentPulseRange, false);

  // ------------------------------------------------------------------------
  // DPR Resolution Switcher Controller (1.0x, 1.5x, 2.0x, Native)
  // ------------------------------------------------------------------------
  function getEffectiveDPR(setting) {
    if (setting === 'native') {
      return window.devicePixelRatio || 1;
    }
    const parsed = parseFloat(setting);
    return isNaN(parsed) || parsed <= 0 ? (window.devicePixelRatio || 1) : parsed;
  }

  function updateResolutionDisplay() {
    const effectiveDpr = getEffectiveDPR(currentDprSetting);
    const renderW = Math.round(window.innerWidth * effectiveDpr);
    const renderH = Math.round(window.innerHeight * effectiveDpr);
    const renderMp = ((renderW * renderH) / 1000000).toFixed(2);

    if (resRenderPx) {
      resRenderPx.textContent = `${renderW} × ${renderH} px`;
    }
    if (resRenderMp) {
      resRenderMp.textContent = `${renderMp} MP`;
    }

    // Camera actual resolution from AR session video stream
    const { video, arSource } = getARObjects();
    if (video) {
      const camW = video.videoWidth || (arSource && arSource.parameters && arSource.parameters.sourceWidth) || 0;
      const camH = video.videoHeight || (arSource && arSource.parameters && arSource.parameters.sourceHeight) || 0;

      if (camW > 0 && camH > 0) {
        const camMp = ((camW * camH) / 1000000).toFixed(2);
        if (resCameraPx) resCameraPx.textContent = `${camW} × ${camH} px`;
        if (resCameraMp) resCameraMp.textContent = `${camMp} MP`;

        if (resViewportAspect) {
          const isPortrait = window.innerHeight > window.innerWidth;
          const Rs = (window.innerWidth / window.innerHeight).toFixed(2);
          const Rv = (camW / camH).toFixed(2);
          resViewportAspect.textContent = isPortrait 
            ? `直立 (螢幕 ${Rs} : 鏡頭 ${Rv})` 
            : `橫向 (螢幕 ${Rs} : 鏡頭 ${Rv})`;
        }
        if (resViewportBadge) {
          const isPortrait = window.innerHeight > window.innerWidth;
          resViewportBadge.textContent = isPortrait ? '縱向裁切校正' : '橫向適配校正';
          resViewportBadge.className = 'res-item-badge status-active';
        }
      }
    }
  }

  function applyDPR(setting, showToastMsg = false) {
    currentDprSetting = setting;
    const effectiveDpr = getEffectiveDPR(setting);
    const renderW = Math.round(window.innerWidth * effectiveDpr);
    const renderH = Math.round(window.innerHeight * effectiveDpr);
    const renderMp = ((renderW * renderH) / 1000000).toFixed(2);

    // Update UI Badge
    if (valDpr) {
      if (setting === 'native') {
        valDpr.textContent = `Native (${(window.devicePixelRatio || 1).toFixed(1)}x)`;
      } else {
        valDpr.textContent = `${parseFloat(setting).toFixed(1)}x`;
      }
    }

    // Update Button Active Classes
    dprBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.dpr === String(setting));
    });

    // Apply to Three.js WebGLRenderer
    if (sceneEl && sceneEl.renderer) {
      sceneEl.renderer.setPixelRatio(effectiveDpr);
      sceneEl.renderer.setSize(window.innerWidth, window.innerHeight, false);
      sceneEl.renderer.setClearColor(0x000000, 0);
    }

    // Emit event for post-processing shaders & listeners
    if (sceneEl) {
      sceneEl.emit('set-dpr', { dpr: effectiveDpr });
    }

    // Trigger syncARViewport & update metrics display
    syncARViewport();
    updateResolutionDisplay();

    // Persist preference
    try {
      localStorage.setItem('ar_custom_dpr', setting);
    } catch (_) {}

    // Show feedback toast
    if (showToastMsg) {
      const label = setting === 'native' 
        ? `Native (${(window.devicePixelRatio || 1).toFixed(1)}x)`
        : `${setting}x Scale`;
      showToast(`⚡ DPR: ${label} • ${renderW}×${renderH} (${renderMp} MP)`);
    }
  }

  // DPR Preset Button Click Handlers
  dprBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const dprVal = btn.dataset.dpr;
      if (dprVal) {
        applyDPR(dprVal, true);
      }
    });
  });

  // ------------------------------------------------------------------------
  // Setup AR scene event listeners & DPR Enforcement
  // ------------------------------------------------------------------------
  if (sceneEl) {
    const enforceOptimizedDPR = () => {
      if (sceneEl.renderer) {
        applyDPR(currentDprSetting, false);
      }
    };

    if (sceneEl.renderer) {
      enforceOptimizedDPR();
    } else {
      sceneEl.addEventListener('renderstart', enforceOptimizedDPR, { once: true });
      sceneEl.addEventListener('loaded', enforceOptimizedDPR, { once: true });
    }

    // 1. Marker visibility tracking
    sceneEl.addEventListener('marker-status-change', (e) => {
      const { marker, visible } = e.detail;

      if (marker === 'hiro') {
        stateStore.isHiroVisible = visible;
      } else if (marker === 'kanji') {
        stateStore.isKanjiVisible = visible;
      }
    });

    // 2. Proximity and Distance calculations (Discharge Status & Energy Power Gauge)
    sceneEl.addEventListener('proximity-update', (e) => {
      const { distance, proximity, active } = e.detail;
      stateStore.proximityActive = active;
      stateStore.distance = distance;
      stateStore.proximityPercent = Math.round(proximity * 100);

      if (active && distance !== null) {
        const percent = stateStore.proximityPercent;
        if (distanceVal) distanceVal.textContent = `${distance.toFixed(2)}m`;
        if (energyBar) energyBar.style.width = `${percent}%`;

        if (energyStatusText) {
          if (percent > 80) {
            energyStatusText.textContent = '⚡ CRITICAL OVERLOAD';
            energyStatusText.style.color = '#f43f5e';
          } else if (percent > 40) {
            energyStatusText.textContent = '⚡ DISCHARGING';
            energyStatusText.style.color = '#38bdf8';
          } else {
            energyStatusText.textContent = '⚡ SPARKING';
            energyStatusText.style.color = '#a855f7';
          }
        }
      } else {
        if (distanceVal) distanceVal.textContent = '--';
        if (energyBar) energyBar.style.width = '0%';
        if (energyStatusText) {
          energyStatusText.textContent = 'STANDBY';
          energyStatusText.style.color = 'var(--text-secondary)';
        }
      }
    });
  }

  // ------------------------------------------------------------------------
  // Precision Real-Time FPS & Frame Latency Meter
  // ------------------------------------------------------------------------
  let frameCount = 0;
  let lastFpsUpdateTime = performance.now();
  let lastFrameTime = performance.now();
  let totalDelta = 0;

  function fpsLoop(now) {
    frameCount++;
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    totalDelta += delta;

    // Update FPS readout at 4Hz (every 250ms) for smooth readability
    if (now - lastFpsUpdateTime >= 250) {
      const elapsedSec = (now - lastFpsUpdateTime) / 1000;
      const currentFps = Math.round(frameCount / elapsedSec);
      const avgFrameTimeMs = (totalDelta / frameCount).toFixed(1);

      if (fpsVal) fpsVal.textContent = currentFps;
      if (frametimeVal) frametimeVal.textContent = `(${avgFrameTimeMs}ms)`;

      if (badgeFps) {
        badgeFps.classList.remove('fps-high', 'fps-mid', 'fps-low');
        if (currentFps >= 50) {
          badgeFps.classList.add('fps-high');
        } else if (currentFps >= 30) {
          badgeFps.classList.add('fps-mid');
        } else {
          badgeFps.classList.add('fps-low');
        }
      }

      // Periodically sync resolution readout and ensure aspect correction is hooked
      updateResolutionDisplay();
      if (!isCorrectionInitialized) {
        tryInitAspectCorrection();
      }

      // Reset counters
      frameCount = 0;
      totalDelta = 0;
      lastFpsUpdateTime = now;
    }

    requestAnimationFrame(fpsLoop);
  }

  requestAnimationFrame(fpsLoop);
});
