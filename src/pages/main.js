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

  // Synchronize proximity telemetry with HUD controller and Audio GUI
  if (sceneEl) {
    sceneEl.addEventListener('proximity-update', (e) => {
      hudController.updateProximityStatus(e.detail);

      const profile = profiles[currentProfileId];
      const hasAudioUrl = !!(profile?.interaction?.audioUrl);
      const isCelebrationState = e.detail.birthdayState === 'TRANSITION' || e.detail.birthdayState === 'CELEBRATION';

      // Toggle Audio button visibility based on condition (celebration reached & audio configured)
      modalController.setAudioButtonVisible(hasAudioUrl && isCelebrationState);

      if (typeof e.detail.isAudioPlaying === 'boolean') {
        modalController.updateAudioState(e.detail.isAudioPlaying);
      }
    });
  }

  // Profile System
  let profiles = {};
  let currentProfileId = 'default';

  const loadProfiles = async () => {
    try {
      const response = await fetch('./config/profiles.json');
      if (response.ok) {
        profiles = await response.json();
      } else {
        console.warn('Profiles config not found');
      }
    } catch (e) {
      console.error('Error loading profiles:', e);
    }
  };

  const getProfileFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pParam = urlParams.get('p') || urlParams.get('mode');
    const hash = window.location.hash.toLowerCase().replace('#', '');
    
    if (pParam && profiles[pParam]) return pParam;
    if (profiles[hash]) return hash;
    
    return 'default';
  };

  const applyProfile = (profileId) => {
    if (!profiles[profileId]) return;
    currentProfileId = profileId;
    const profile = profiles[profileId];

    // Update URL without reload
    const url = new URL(window.location.href);
    if (profileId !== 'default') {
      url.searchParams.set('p', profileId);
    } else {
      url.searchParams.delete('p');
      url.searchParams.delete('mode');
    }
    window.history.replaceState({}, '', url.toString());

    // HUD button text remains 'Profile' as intended

    // 1. Compute and apply final marker configurations in a single pass
    const defaultMarkers = profiles['default']?.markers || {};
    const markerNamesMap = {};

    for (let i = 0; i <= 7; i++) {
      const markerId = String(i);
      const targetData = (profile.markers && profile.markers[markerId]) ||
                         (defaultMarkers && defaultMarkers[markerId]) ||
                         { text: markerId, color: '#ffffff', emissive: '#ffffff' };

      markerNamesMap[markerId] = targetData.text;

      const markerEl = document.getElementById(`marker-${markerId}`);
      if (markerEl) {
        const textEl = markerEl.querySelector('[three-text-3d]');
        if (textEl) {
          textEl.setAttribute('three-text-3d', {
            text: targetData.text,
            color: targetData.color,
            emissive: targetData.emissive
          });
        }
      }
    }

    // 2. Apply Interaction / FX properties in a single batch
    if (sceneEl) {
      const hasCelebration = !!(profile.interaction && profile.interaction.celebrationText);
      sceneEl.setAttribute('proximity-lightning', {
        enableBirthday: hasCelebration,
        targetNodes: JSON.stringify(profile.interaction?.targetNodes || [0, 7]),
        celebrationText: profile.interaction?.celebrationText || '',
        audioUrl: profile.interaction?.audioUrl || '',
        markerNames: JSON.stringify(markerNamesMap)
      });
    }

    modalController.setResetButtonVisible(!!(profile.interaction && profile.interaction.celebrationText));
    if (!profile.interaction?.audioUrl) {
      modalController.setAudioButtonVisible(false);
      modalController.updateAudioState(false);
    }

    // Update Dropdown Active State
    document.querySelectorAll('.profile-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === profileId);
    });
  };

  const initProfileUI = () => {
    const dropdown = document.getElementById('profile-dropdown');
    const toggleBtn = document.getElementById('btn-toggle-profile');
    
    if (!dropdown || !toggleBtn) return;

    dropdown.innerHTML = '';
    Object.keys(profiles).forEach(id => {
      const p = profiles[id];
      const btn = document.createElement('button');
      btn.className = 'profile-option';
      btn.dataset.id = id;
      btn.innerHTML = `<span>${p.name || id}</span>`;
      btn.addEventListener('click', () => {
        applyProfile(id);
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(btn);
    });

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!toggleBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  };

  // Initialize System
  loadProfiles().then(() => {
    if (Object.keys(profiles).length > 0) {
      initProfileUI();
      applyProfile(getProfileFromUrl(), false);
    }
  });
});

