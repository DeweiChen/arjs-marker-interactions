/**
 * Application Entry Point - Main Interaction Engine (index.html)
 * Assembles core WebAR systems, custom A-Frame components, and HUD UI controllers.
 */

import '../style.css';
import '../components/marker-stabilizer.js';
import '../components/proximity-component.js';
import '../components/three-text-3d.js';
import '../components/bloom-effect.js';

import { initAntiZoomProtection } from '../core/anti-zoom.js';
import { initARAspectCorrection } from '../core/ar-aspect-corrector.js';
import { HUDTelemetryController } from '../ui/hud-telemetry.js';
import { BloomPanelController } from '../ui/bloom-panel.js';
import { ModalController } from '../ui/modal-controller.js';

document.addEventListener('DOMContentLoaded', () => {
  const sceneEl = document.querySelector('a-scene');

  // Initialize anti-zoom gesture protection
  initAntiZoomProtection();

  // Initialize AR aspect ratio matrix corrector
  if (sceneEl) {
    initARAspectCorrection(sceneEl);
  }

  // Detect Debug mode request strictly from URL query or hash (?d=1, ?debug=1, ?d=true, ?debug=true, ?d, ?debug, #debug, #d)
  const isDebugModeRequested = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dParam = urlParams.get('d');
    const debugParam = urlParams.get('debug');
    const hash = window.location.hash.toLowerCase();

    // Check explicit disable flags (e.g. ?d=0, ?d=false, ?debug=0, ?debug=false)
    if (dParam === '0' || dParam === 'false' || debugParam === '0' || debugParam === 'false') {
      return false;
    }

    return (
      dParam === '1' ||
      dParam === 'true' ||
      dParam === '' ||
      debugParam === '1' ||
      debugParam === 'true' ||
      debugParam === '' ||
      urlParams.has('d') ||
      urlParams.has('debug') ||
      hash === '#debug' ||
      hash === '#d'
    );
  };

  const isDebugActive = isDebugModeRequested();

  // Initialize UI Controllers
  const hudController = new HUDTelemetryController(sceneEl, isDebugActive);
  const bloomPanelController = new BloomPanelController(sceneEl, isDebugActive);
  const modalController = new ModalController(sceneEl);

  const applyDebugMode = (active) => {
    hudController.setDebugMode(active);
    bloomPanelController.setDebugMode(active);
  };

  // Apply initial debug mode state
  applyDebugMode(isDebugActive);

  // Listen to hash changes for dynamic debug toggling
  window.addEventListener('hashchange', () => {
    applyDebugMode(isDebugModeRequested());
  });

  // Synchronize proximity telemetry with HUD controller
  if (sceneEl) {
    sceneEl.addEventListener('proximity-update', (e) => {
      hudController.updateProximityStatus(e.detail);
    });
  }

  // Detect HYBD mode request from URL query or hash
  const isHybdModeRequested = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const hybdParam = urlParams.get('hybd');
    const hash = window.location.hash.toLowerCase();

    return (
      modeParam === 'hybd' ||
      hybdParam === 'true' ||
      hybdParam === '1' ||
      hash === '#hybd'
    );
  };

  const btnToggleHybd = document.getElementById('btn-toggle-hybd');
  let isHybdActive = isHybdModeRequested();

  const applyHybdMode = (active, triggerToast = false) => {
    isHybdActive = active;

    if (btnToggleHybd) {
      btnToggleHybd.classList.toggle('active', isHybdActive);
    }

    if (sceneEl) {
      sceneEl.setAttribute('proximity-lightning', 'enableBirthday', isHybdActive);
    }

    modalController.setResetButtonVisible(isHybdActive);

    // Update URL parameters without reloading
    const url = new URL(window.location.href);
    if (isHybdActive) {
      url.searchParams.set('mode', 'hybd');
    } else {
      url.searchParams.delete('mode');
      url.searchParams.delete('hybd');
      if (url.hash === '#hybd') {
        url.hash = '';
      }
    }
    window.history.replaceState({}, '', url.toString());

    if (triggerToast) {
      modalController.showToast(
        isHybdActive ? 'HYBD Birthday Mode Enabled 🎉' : 'Standard Lightning Mode Enabled ⚡'
      );
    }
  };

  // Apply initial mode on startup
  applyHybdMode(isHybdActive, false);

  // Bind HYBD mode toggle button event
  if (btnToggleHybd) {
    btnToggleHybd.addEventListener('click', () => {
      applyHybdMode(!isHybdActive, true);
    });
  }
});

