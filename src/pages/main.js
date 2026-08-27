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

  // Initialize UI Controllers
  const hudController = new HUDTelemetryController(sceneEl);
  const bloomPanelController = new BloomPanelController(sceneEl);
  const modalController = new ModalController(sceneEl);

  // Synchronize proximity telemetry with HUD controller
  if (sceneEl) {
    sceneEl.addEventListener('proximity-update', (e) => {
      hudController.updateProximityStatus(e.detail);
    });
  }
});
