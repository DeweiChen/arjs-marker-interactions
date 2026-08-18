/**
 * A-Frame Custom Component: proximity-lightning
 * Connects two tracked AR markers with procedural lightning and plasma FX.
 * Scales dynamically as markers approach each other and disables beyond threshold distance.
 */

import { LightningFX } from './lightning-fx.js';

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('proximity-lightning', {
    schema: {
      marker1: { type: 'selector', default: '#marker-hiro' },
      marker2: { type: 'selector', default: '#marker-kanji' },
      maxDistance: { type: 'number', default: 4.5 },
      minDistance: { type: 'number', default: 1.5 },
      terminalOffsetY: { type: 'number', default: 0.25 },
      smoothingFactor: { type: 'number', default: 0.35 }
    },

    init: function () {
      const sceneEl = this.el.sceneEl;
      const THREE = window.THREE || AFRAME.THREE;

      // Tracked world positions with lerp smoothing to reduce camera jitter
      this.pos1 = new THREE.Vector3();
      this.pos2 = new THREE.Vector3();
      this.smoothedPos1 = new THREE.Vector3();
      this.smoothedPos2 = new THREE.Vector3();
      this.hasInitPos1 = false;
      this.hasInitPos2 = false;

      // Marker visibility state flags
      this.isMarker1Visible = false;
      this.isMarker2Visible = false;

      // Initialize Lightning FX attached to the root Three.js scene
      this.lightningFX = new LightningFX(sceneEl.object3D, {
        maxDistance: this.data.maxDistance,
        minDistance: this.data.minDistance
      });

      // Bind marker visibility events
      this._bindMarkerEvents();
    },

    _bindMarkerEvents: function () {
      const marker1 = this.data.marker1;
      const marker2 = this.data.marker2;

      if (marker1) {
        marker1.addEventListener('markerFound', () => {
          this.isMarker1Visible = true;
          this.el.emit('marker-status-change', { marker: 'hiro', visible: true });
        });
        marker1.addEventListener('markerLost', () => {
          this.isMarker1Visible = false;
          this.hasInitPos1 = false;
          this.el.emit('marker-status-change', { marker: 'hiro', visible: false });
        });
      }

      if (marker2) {
        marker2.addEventListener('markerFound', () => {
          this.isMarker2Visible = true;
          this.el.emit('marker-status-change', { marker: 'kanji', visible: true });
        });
        marker2.addEventListener('markerLost', () => {
          this.isMarker2Visible = false;
          this.hasInitPos2 = false;
          this.el.emit('marker-status-change', { marker: 'kanji', visible: false });
        });
      }
    },

    tick: function (time, timeDelta) {
      const marker1 = this.data.marker1;
      const marker2 = this.data.marker2;

      if (!marker1 || !marker2 || !this.lightningFX) return;

      // Check visibility from AR.js object3D state and event tracking
      const m1Visible = (marker1.object3D && marker1.object3D.visible) || this.isMarker1Visible;
      const m2Visible = (marker2.object3D && marker2.object3D.visible) || this.isMarker2Visible;

      // Sync state if object3D visibility changes directly
      if (m1Visible !== this._lastM1Visible) {
        this._lastM1Visible = m1Visible;
        this.el.emit('marker-status-change', { marker: 'hiro', visible: m1Visible });
      }
      if (m2Visible !== this._lastM2Visible) {
        this._lastM2Visible = m2Visible;
        this.el.emit('marker-status-change', { marker: 'kanji', visible: m2Visible });
      }

      if (m1Visible && m2Visible) {
        // Extract raw world positions
        marker1.object3D.getWorldPosition(this.pos1);
        marker2.object3D.getWorldPosition(this.pos2);

        // Apply vertical terminal offset so lightning connects model heads/cores
        this.pos1.y += this.data.terminalOffsetY;
        this.pos2.y += this.data.terminalOffsetY;

        // Exponential smoothing (reduces AR tracking position jitter)
        const alpha = this.data.smoothingFactor;
        if (!this.hasInitPos1) {
          this.smoothedPos1.copy(this.pos1);
          this.hasInitPos1 = true;
        } else {
          this.smoothedPos1.lerp(this.pos1, alpha);
        }

        if (!this.hasInitPos2) {
          this.smoothedPos2.copy(this.pos2);
          this.hasInitPos2 = true;
        } else {
          this.smoothedPos2.lerp(this.pos2, alpha);
        }

        // Update procedural lightning FX
        this.lightningFX.update(this.smoothedPos1, this.smoothedPos2, timeDelta);

        // Dispatch status event for HUD updates
        const dist = this.lightningFX.currentDistance;
        const prox = this.lightningFX.smoothedProximity;
        this.el.emit('proximity-update', {
          distance: dist,
          proximity: prox,
          active: prox > 0.02
        });
      } else {
        // One or both markers are lost; fade out FX
        this.lightningFX.update(null, null, timeDelta);
        this.el.emit('proximity-update', {
          distance: null,
          proximity: 0,
          active: false
        });
      }
    },

    remove: function () {
      if (this.lightningFX) {
        this.lightningFX.dispose();
      }
    }
  });
}
