/**
 * A-Frame Custom Component: marker-stabilizer
 * Filters out initial unstable frames / planar pose ambiguity when an AR marker is first detected.
 * Hides child visual objects during the warm-up frame period and forces world matrix synchronization.
 */

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('marker-stabilizer', {
    schema: {
      warmupFrames: { type: 'int', default: 4 },
      smoothUpdate: { type: 'boolean', default: true }
    },

    init: function () {
      this.stableFrameCount = 0;
      this.isStable = false;
      this.isFound = false;

      this._setChildrenVisibility(false);

      this._onMarkerFound = this._onMarkerFound.bind(this);
      this._onMarkerLost = this._onMarkerLost.bind(this);

      this.el.addEventListener('markerFound', this._onMarkerFound);
      this.el.addEventListener('markerLost', this._onMarkerLost);
    },

    _setChildrenVisibility: function (visible) {
      const el = this.el;
      if (!el || !el.children) return;

      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i];
        if (child.object3D) {
          child.object3D.visible = visible;
        }
      }
    },

    _onMarkerFound: function () {
      this.isFound = true;
      this.stableFrameCount = 0;
      this.isStable = false;
      this._setChildrenVisibility(false);
      this.el.emit('marker-stabilize-start', { el: this.el });
    },

    _onMarkerLost: function () {
      this.isFound = false;
      this.stableFrameCount = 0;
      this.isStable = false;
      this._setChildrenVisibility(false);
      this.el.emit('marker-stabilize-lost', { el: this.el });
    },

    tick: function () {
      const obj3D = this.el.object3D;
      if (!obj3D) return;

      const isDetected = obj3D.visible || this.isFound;

      if (isDetected) {
        obj3D.updateMatrixWorld(true);

        if (!this.isStable) {
          this.stableFrameCount++;

          if (this.stableFrameCount < this.data.warmupFrames) {
            this._setChildrenVisibility(false);
          } else {
            this.isStable = true;
            this._setChildrenVisibility(true);
            this.el.emit('marker-stabilized', { el: this.el, frames: this.stableFrameCount });
          }
        }
      } else {
        if (this.isStable || this.stableFrameCount > 0) {
          this.stableFrameCount = 0;
          this.isStable = false;
          this._setChildrenVisibility(false);
        }
      }
    },

    remove: function () {
      this.el.removeEventListener('markerFound', this._onMarkerFound);
      this.el.removeEventListener('markerLost', this._onMarkerLost);
      this._setChildrenVisibility(true);
    }
  });
}
