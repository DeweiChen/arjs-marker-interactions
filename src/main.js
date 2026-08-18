/**
 * Application Bootstrap, HUD Controller & Real-Time Performance Telemetry
 * Monitors AR tracking states, calculates FPS / Frame Latency, and synchronizes HUD telemetry.
 */

import './style.css';
import './proximity-component.js';

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

  // Tracking state store
  const stateStore = {
    isHiroVisible: false,
    isKanjiVisible: false,
    proximityPercent: 0,
    proximityActive: false,
    distance: null
  };

  // ------------------------------------------------------------------------
  // Setup Marker Modal events
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
