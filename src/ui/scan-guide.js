/**
 * Scan Guide Overlay Controller
 * Manages the scanning reticle and visual guidance overlay.
 * Automatically displays whenever 0 AR markers are recognized on screen,
 * and smoothly hides whenever at least 1 AR marker is recognized.
 */

export class ScanGuideController {
  constructor(sceneEl) {
    this.sceneEl = sceneEl;
    this.overlayEl = document.getElementById('scan-guide-overlay');
    this.activeMarkers = new Set();
    this.isReadyForDetection = false;
    this.showDebounceTimer = null;
    this.hideTimer = null;

    this._boundOnStatusChange = this._onStatusChange.bind(this);

    this._initEvents();
  }

  /**
   * Bind event listeners for camera readiness and marker detection.
   */
  _initEvents() {
    if (!this.overlayEl) return;

    // Ensure overlay is initially visible
    this.overlayEl.classList.remove('hidden', 'dismissed', 'locked-on');

    // Wait until camera stream is initialized and stabilized before arming detection
    const armDetection = () => {
      if (this.isReadyForDetection) return;

      setTimeout(() => {
        this.isReadyForDetection = true;
        console.log('[ScanGuide] AR Camera stream active. Active marker tracking armed.');

        // Sync initial visible markers from scene if already tracking
        const markerEls = document.querySelectorAll('a-marker');
        markerEls.forEach((marker) => {
          if (marker.object3D && marker.object3D.visible) {
            const mId = marker.id || marker.getAttribute('value');
            this.activeMarkers.add(String(mId));
          }
        });
        this._updateVisibility();
      }, 800);
    };

    if (this.sceneEl) {
      this.sceneEl.addEventListener('camera-init', armDetection, { once: true });
      this.sceneEl.addEventListener('marker-status-change', this._boundOnStatusChange);
    }
    window.addEventListener('arjs-video-loaded', armDetection, { once: true });

    // Fallback timer: arm after 2.5s regardless
    setTimeout(armDetection, 2500);

    // Direct event listeners on all a-marker elements
    const markerEls = document.querySelectorAll('a-marker');
    markerEls.forEach((marker) => {
      const markerId = String(marker.id || marker.getAttribute('value'));

      marker.addEventListener('markerFound', () => {
        this.activeMarkers.add(markerId);
        this._updateVisibility();
      });

      marker.addEventListener('marker-stabilized', () => {
        this.activeMarkers.add(markerId);
        this._updateVisibility();
      });

      marker.addEventListener('markerLost', () => {
        this.activeMarkers.delete(markerId);
        this._updateVisibility();
      });
    });
  }

  /**
   * Handle marker status changes emitted from sceneEl.
   *
   * @param {CustomEvent} e - Marker status change event detail
   */
  _onStatusChange(e) {
    if (!e?.detail) return;
    const markerId = String(e.detail.id ?? e.detail.marker ?? '');
    if (!markerId) return;

    if (e.detail.visible) {
      this.activeMarkers.add(markerId);
    } else {
      this.activeMarkers.delete(markerId);
    }

    this._updateVisibility();
  }

  /**
   * Re-evaluate overlay display state based on active recognized markers count.
   */
  _updateVisibility() {
    if (!this.isReadyForDetection) return;

    if (this.activeMarkers.size > 0) {
      // At least 1 marker recognized -> Hide guide
      if (this.showDebounceTimer) {
        clearTimeout(this.showDebounceTimer);
        this.showDebounceTimer = null;
      }
      this.hideGuide();
    } else {
      // 0 markers recognized -> Show guide after debounce to filter momentary tracking loss
      if (!this.showDebounceTimer) {
        this.showDebounceTimer = setTimeout(() => {
          this.showDebounceTimer = null;
          if (this.activeMarkers.size === 0) {
            this.showGuide();
          }
        }, 400);
      }
    }
  }

  /**
   * Hide guidance overlay with lock-on feedback.
   */
  hideGuide() {
    if (!this.overlayEl) return;
    if (this.overlayEl.classList.contains('dismissed')) return;

    // Apply quick lock-on pulse (green)
    this.overlayEl.classList.add('locked-on');

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.overlayEl && this.activeMarkers.size > 0) {
        this.overlayEl.classList.add('dismissed');
      }
    }, 280);
  }

  /**
   * Restore guidance overlay when 0 markers are in camera view.
   */
  showGuide() {
    if (!this.overlayEl) return;

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // Reset lock-on back to normal scanning style (cyan) and fade back in
    this.overlayEl.classList.remove('locked-on', 'dismissed');
    console.log('[ScanGuide] 0 active markers in view. Showing scan guide overlay.');
  }

  /**
   * Reset tracking state (e.g. on scene reset).
   */
  resetGuide() {
    this.activeMarkers.clear();
    this.showGuide();
  }
}
