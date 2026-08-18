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
  const stateVal = document.getElementById('state-val');
  const badgeTracking = document.getElementById('badge-tracking');
  const trackingVal = document.getElementById('tracking-val');

  // Bottom Status & Energy DOM Elements
  const statusHiro = document.getElementById('status-hiro');
  const statusKanji = document.getElementById('status-kanji');
  const statusHiroVal = document.getElementById('status-hiro-val');
  const statusKanjiVal = document.getElementById('status-kanji-val');
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
  const bloomPanel = document.getElementById('bloom-control-panel');
  const btnCloseBloom = document.getElementById('btn-close-bloom');
  const btnResetBloom = document.getElementById('btn-reset-bloom');
  const sliderBloomStrength = document.getElementById('slider-bloom-strength');
  const valBloomStrength = document.getElementById('val-bloom-strength');
  const presetBtns = document.querySelectorAll('.bloom-preset-btn');
  const chkDynamicIntensity = document.getElementById('chk-dynamic-intensity');
  const chkPitchFacing = document.getElementById('chk-pitch-facing');

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

    const arSession = sceneEl && sceneEl.systems && sceneEl.systems.arjs;
    if (arSession && arSession.arSource && arSession.arContext) {
      const video = arSession.arSource.domElement;

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
          return;
        }
      }

      // 2. Force AR.js to recalculate video element layout styles
      if (typeof arSession.arSource.onResizeElement === 'function') {
        arSession.arSource.onResizeElement();
      }

      // 3. Synchronize AR controller canvas & update context projection matrix
      if (arSession.arContext.arController && arSession.arContext.arController.canvas) {
        arSession.arSource.copyElementSizeTo(arSession.arContext.arController.canvas);
        arSession.arContext.update();
      }
    }

    // 4. Synchronize A-Frame camera & renderer viewport
    if (sceneEl && sceneEl.renderer && sceneEl.camera) {
      sceneEl.renderer.setSize(window.innerWidth, window.innerHeight, false);
      if (sceneEl.camera.isCamera) {
        sceneEl.camera.aspect = window.innerWidth / window.innerHeight;
        sceneEl.camera.updateProjectionMatrix();
      }
    }

    // 5. Update Bloom Effect post-processing buffers if active
    const bloomComponent = sceneEl && sceneEl.components && sceneEl.components['bloom-effect'];
    if (bloomComponent && typeof bloomComponent._onResize === 'function') {
      bloomComponent._onResize();
    }
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

  window.addEventListener('arToolkitContext-loaded', () => {
    multiStageSyncARViewport();
  });

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
    strength: 0.6,
    radius: 0.3,
    threshold: 0.0,
    dynamicIntensity: true,
    pitchFacing: false
  };

  function updateBloomPresetsUI(currentStrength) {
    const roundedStrength = Math.round(currentStrength * 10) / 10;
    presetBtns.forEach((btn) => {
      const presetVal = parseFloat(btn.dataset.strength);
      btn.classList.toggle('active', Math.abs(presetVal - roundedStrength) < 0.05);
    });
  }

  function applyBloomStrength(val) {
    const num = Math.max(0, parseFloat(val) || 0);
    if (valBloomStrength) {
      valBloomStrength.textContent = `${num.toFixed(2)}x`;
    }
    if (sliderBloomStrength && Math.abs(parseFloat(sliderBloomStrength.value) - num) > 0.001) {
      sliderBloomStrength.value = num;
    }
    updateBloomPresetsUI(num);

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

  // Reset to Defaults
  if (btnResetBloom) {
    btnResetBloom.addEventListener('click', () => {
      applyBloomStrength(defaultBloomSettings.strength);
      if (sceneEl) {
        sceneEl.emit('set-bloom-params', {
          radius: defaultBloomSettings.radius,
          threshold: defaultBloomSettings.threshold
        });
      }
      applyDynamicIntensity(defaultBloomSettings.dynamicIntensity);
      applyPitchFacing(defaultBloomSettings.pitchFacing);
    });
  }

  // Strength Slider Events
  if (sliderBloomStrength) {
    sliderBloomStrength.addEventListener('input', (e) => {
      applyBloomStrength(e.target.value);
    });
  }

  // Preset Buttons
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const strength = parseFloat(btn.dataset.strength);
      if (!isNaN(strength)) {
        applyBloomStrength(strength);
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
  // State Machine HUD Synchronizer
  // ------------------------------------------------------------------------
  function updateStateHUD() {
    const trackedCount = (stateStore.isHiroVisible ? 1 : 0) + (stateStore.isKanjiVisible ? 1 : 0);

    // 1. Update Tracking Count Badge
    if (trackingVal) {
      trackingVal.textContent = `${trackedCount} / 2`;
    }
    if (badgeTracking) {
      badgeTracking.classList.toggle('tracking-all', trackedCount === 2);
    }

    // 2. Update System State Indicator
    if (stateVal) {
      stateVal.className = 'chip-val'; // reset modifier classes
      if (trackedCount === 0) {
        stateVal.textContent = 'SEARCHING';
        stateVal.classList.add('state-standby');
      } else if (trackedCount === 1) {
        stateVal.textContent = stateStore.isHiroVisible ? 'HIRO LOCKED' : 'KANJI LOCKED';
        stateVal.classList.add('state-standby');
      } else {
        // Both markers visible
        if (stateStore.proximityPercent > 80) {
          stateVal.textContent = '⚡ OVERLOAD';
          stateVal.classList.add('state-overload');
        } else if (stateStore.proximityPercent > 25) {
          stateVal.textContent = '⚡ DISCHARGE';
          stateVal.classList.add('state-active');
        } else {
          stateVal.textContent = 'STANDBY (2/2)';
          stateVal.classList.add('state-standby');
        }
      }
    }
  }

  // ------------------------------------------------------------------------
  // Setup AR scene event listeners
  // ------------------------------------------------------------------------
  if (sceneEl) {
    // 1. Marker visibility changes
    sceneEl.addEventListener('marker-status-change', (e) => {
      const { marker, visible } = e.detail;

      if (marker === 'hiro') {
        stateStore.isHiroVisible = visible;
        if (statusHiro) statusHiro.classList.toggle('active', visible);
        if (statusHiroVal) statusHiroVal.textContent = visible ? 'Tracking' : 'Waiting...';
      } else if (marker === 'kanji') {
        stateStore.isKanjiVisible = visible;
        if (statusKanji) statusKanji.classList.toggle('active', visible);
        if (statusKanjiVal) statusKanjiVal.textContent = visible ? 'Tracking' : 'Waiting...';
      }

      updateStateHUD();
    });

    // 2. Proximity and Distance calculations
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

      updateStateHUD();
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

      // Reset counters
      frameCount = 0;
      totalDelta = 0;
      lastFpsUpdateTime = now;
    }

    requestAnimationFrame(fpsLoop);
  }

  requestAnimationFrame(fpsLoop);
});
