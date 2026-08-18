/**
 * Application Bootstrap & HUD Controller
 * Initializes AR interaction listeners, HUD status indicators, and modal controllers.
 */

import './style.css';
import './proximity-component.js';

document.addEventListener('DOMContentLoaded', () => {
  const sceneEl = document.querySelector('a-scene');

  // HUD DOM Elements
  const statusHiro = document.getElementById('status-hiro');
  const statusKanji = document.getElementById('status-kanji');
  const statusHiroVal = document.getElementById('status-hiro-val');
  const statusKanjiVal = document.getElementById('status-kanji-val');
  const distanceVal = document.getElementById('distance-val');
  const energyBar = document.getElementById('energy-bar');
  const energyVal = document.getElementById('energy-val');
  const energyStatusText = document.getElementById('energy-status-text');

  // Modal elements
  const btnShowMarkers = document.getElementById('btn-show-markers');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalBackdrop = document.getElementById('markers-modal');

  // Setup Marker Modal events
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

  // Setup AR scene event listeners
  if (sceneEl) {
    // 1. Marker visibility changes
    sceneEl.addEventListener('marker-status-change', (e) => {
      const { marker, visible } = e.detail;

      if (marker === 'hiro') {
        if (statusHiro) {
          statusHiro.classList.toggle('active', visible);
        }
        if (statusHiroVal) {
          statusHiroVal.textContent = visible ? 'Tracking' : 'Waiting...';
        }
      } else if (marker === 'kanji') {
        if (statusKanji) {
          statusKanji.classList.toggle('active', visible);
        }
        if (statusKanjiVal) {
          statusKanjiVal.textContent = visible ? 'Tracking' : 'Waiting...';
        }
      }
    });

    // 2. Proximity and Distance calculations
    sceneEl.addEventListener('proximity-update', (e) => {
      const { distance, proximity, active } = e.detail;

      if (active && distance !== null) {
        const percent = Math.round(proximity * 100);
        if (distanceVal) distanceVal.textContent = `${distance.toFixed(2)}m`;
        if (energyBar) energyBar.style.width = `${percent}%`;
        if (energyVal) energyVal.textContent = `${percent}%`;

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
        if (energyVal) energyVal.textContent = '0%';
        if (energyStatusText) {
          energyStatusText.textContent = 'STANDBY';
          energyStatusText.style.color = 'var(--text-secondary)';
        }
      }
    });
  }
});
