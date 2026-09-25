/**
 * PhotoModeController - Immersive Photo Mode & Interactive Stage Orbit Controller
 * Provides an isolated, pure-black background presentation stage after celebration FX triggers.
 * Persists 3D meshes and active lightning chain even when physical markers are removed,
 * while allowing user to interactively orbit, tilt, and pinch-zoom the 3D scene using touch gestures.
 */

export class PhotoModeController {
  /**
   * @param {Element} sceneEl - The root A-Frame <a-scene> element
   */
  constructor(sceneEl) {
    this.sceneEl = sceneEl;
    this.THREE = window.THREE || (typeof AFRAME !== 'undefined' && AFRAME.THREE);

    this.isActive = false;
    this.uiVisible = true;
    this._animatingReset = false;

    // Centroid and spherical coordinates for orbit
    this.centroid = new this.THREE.Vector3(0, 0.4, -2.0);
    this.defaultCentroid = new this.THREE.Vector3(0, 0.4, -2.0);
    this.theta = 0;
    this.phi = Math.PI / 2;
    this.radius = 2.0;

    this.defaultTheta = 0;
    this.defaultPhi = Math.PI / 2;
    this.defaultRadius = 2.0;

    // Touch gesture tracking
    this.isDragging = false;
    this.isPinching = false;
    this.startX = 0;
    this.startY = 0;
    this.startPinchDist = 0;
    this.startPinchMidX = 0;
    this.startPinchMidY = 0;
    this.startRadius = 2.0;
    this.touchStartTime = 0;
    this.hasMoved = false;

    // Mouse tracking for desktop testing
    this.isMouseDown = false;
    this.isPanMode = false;

    // Persistent Stage Group attached to root scene for cloned marker visual meshes
    this.stageGroup = new this.THREE.Group();
    this.stageGroup.name = 'photoStageGroup';
    if (this.sceneEl && this.sceneEl.object3D) {
      this.sceneEl.object3D.add(this.stageGroup);
    }

    // DOM Elements
    this.btnPhotoMode = document.getElementById('btn-photo-mode');
    this.photoModeUi = document.getElementById('photo-mode-ui');
    this.photoModeToolbar = document.getElementById('photo-mode-toolbar');
    this.photoModeHint = document.getElementById('photo-mode-hint');
    this.btnExitPhoto = document.getElementById('btn-exit-photo');
    this.btnResetView = document.getElementById('btn-reset-view');

    // Bound gesture handlers
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    this._bindEvents();
  }

  _bindEvents() {
    if (this.btnPhotoMode) {
      this.btnPhotoMode.addEventListener('click', () => {
        this.enter();
      });
    }

    if (this.btnExitPhoto) {
      this.btnExitPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exit();
      });
    }

    if (this.btnResetView) {
      this.btnResetView.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetView();
      });
    }

    // Listen for reset-birthday event from HUD or other controllers
    if (this.sceneEl) {
      this.sceneEl.addEventListener('reset-birthday', () => {
        if (this.isActive) {
          this.exit();
        }
        this.setButtonVisible(false);
      });
    }
  }

  /**
   * Toggle visibility of the HUD Photo Mode activation button
   * @param {boolean} visible
   */
  setButtonVisible(visible) {
    if (this.btnPhotoMode) {
      this.btnPhotoMode.classList.toggle('hidden', !visible);
    }
  }

  /**
   * Enter Photo Mode: hides video feed, freezes 3D objects, arms touch orbit
   */
  enter() {
    if (this.isActive) return;
    this.isActive = true;

    console.log('[PhotoMode] Entering Photo Mode.');

    const proximityComp = this.sceneEl.components['proximity-lightning'];
    if (!proximityComp) {
      console.warn('[PhotoMode] Proximity component not found on scene.');
      return;
    }

    // Snapshot active markers and chain from proximity component
    const frozenData = proximityComp.getFrozenSnapshot();

    // Determine composition centroid
    if (frozenData.midpoint) {
      this.centroid.copy(frozenData.midpoint);
      this.centroid.y += 0.35; // Slight vertical lift toward text center
    } else if (frozenData.nodes && frozenData.nodes.length > 0) {
      this.centroid.set(0, 0, 0);
      frozenData.nodes.forEach((n) => this.centroid.add(n.position));
      this.centroid.multiplyScalar(1 / frozenData.nodes.length);
    } else {
      this.centroid.set(0, 0.4, -2.0);
    }
    this.defaultCentroid.copy(this.centroid);

    // Clone visual objects of active markers into stageGroup
    this._populateStageClones(frozenData.nodes || []);

    // Switch proximity component to persistent Photo Mode loop
    proximityComp.setPhotoMode(true, frozenData);

    // Calculate initial spherical coordinates from centroid to camera
    this._initSphericalFromCamera();

    // Attach touch & pointer event listeners
    this._attachGestureListeners();

    // Update DOM & Styling
    document.body.classList.add('photo-mode-active');
    if (this.photoModeUi) {
      this.photoModeUi.classList.remove('hidden');
    }
    this.uiVisible = true;
    if (this.photoModeToolbar) {
      this.photoModeToolbar.classList.remove('ui-hidden');
    }

    // Show temporary hint toast
    if (this.photoModeHint) {
      this.photoModeHint.classList.remove('hint-fade');
      if (this._hintTimer) clearTimeout(this._hintTimer);
      this._hintTimer = setTimeout(() => {
        if (this.photoModeHint) {
          this.photoModeHint.classList.add('hint-fade');
        }
      }, 3500);
    }

    this.sceneEl.emit('photo-mode-entered', { centroid: this.centroid });
  }

  /**
   * Exit Photo Mode: restores video feed, restores camera pose, cleans stage clones
   */
  exit() {
    if (!this.isActive) return;
    this.isActive = false;

    console.log('[PhotoMode] Exiting Photo Mode.');

    // Remove gesture listeners
    this._detachGestureListeners();

    // Reset camera pose to default (0, 0, 0)
    this._restoreCameraPose();

    // Clean cloned visual meshes from stageGroup
    this._clearStageClones();

    // Re-enable normal proximity tracking loop
    const proximityComp = this.sceneEl.components['proximity-lightning'];
    if (proximityComp) {
      proximityComp.setPhotoMode(false);
    }

    // Restore original marker children visibility
    this._restoreMarkerChildrenVisibility();

    // Update DOM & Styling
    document.body.classList.remove('photo-mode-active');
    if (this.photoModeUi) {
      this.photoModeUi.classList.add('hidden');
    }

    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = null;
    }

    this.sceneEl.emit('photo-mode-exited');
  }

  /**
   * Clone 3D visual representations of active markers into stageGroup
   * @param {Array<Object>} nodes - Active marker nodes to clone
   */
  _populateStageClones(nodes) {
    this._clearStageClones();

    nodes.forEach((node) => {
      const markerEl = node.el || document.getElementById(`marker-${node.id}`);
      if (!markerEl) return;

      // Iterate through child elements of the marker
      for (let i = 0; i < markerEl.children.length; i++) {
        const childEl = markerEl.children[i];
        const childObj = childEl.object3D;
        if (!childObj) continue;

        // Force matrix update to ensure matrixWorld is up to date
        childObj.updateMatrixWorld(true);

        // Clone Three.js Object3D hierarchy
        const clone = childObj.clone(true);

        // Apply child's exact world transform to the clone
        clone.matrix.copy(childObj.matrixWorld);
        clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
        clone.matrixAutoUpdate = true;

        // Ensure Selective Bloom Layer 1 is preserved on all child meshes
        clone.traverse((obj) => {
          if (obj.isMesh || obj.isPoints) {
            obj.layers.enable(1);
            obj.frustumCulled = false;
            if (obj.material) {
              obj.material.depthWrite = true;
            }
          }
        });

        this.stageGroup.add(clone);
      }
    });

    // Hide ALL markers (0 to 7) so no new or existing physical markers can be displayed by AR.js
    for (let i = 0; i <= 7; i++) {
      const mEl = document.getElementById(`marker-${i}`);
      if (mEl) {
        this._setMarkerElChildrenVisibility(mEl, false);
        if (mEl.object3D) {
          mEl.object3D.visible = false;
        }
      }
    }
  }

  /**
   * Remove and clean up all cloned meshes in stageGroup
   */
  _clearStageClones() {
    while (this.stageGroup.children.length > 0) {
      const child = this.stageGroup.children[0];
      this.stageGroup.remove(child);
    }
  }

  /**
   * Helper to set visibility of all children of a marker element
   */
  _setMarkerElChildrenVisibility(markerEl, visible) {
    if (!markerEl || !markerEl.children) return;
    for (let i = 0; i < markerEl.children.length; i++) {
      const child = markerEl.children[i];
      if (child.object3D) {
        child.object3D.visible = visible;
      }
    }
  }

  /**
   * Restore visibility of all marker children when exiting Photo Mode
   */
  _restoreMarkerChildrenVisibility() {
    for (let i = 0; i <= 7; i++) {
      const markerEl = document.getElementById(`marker-${i}`);
      if (markerEl) {
        this._setMarkerElChildrenVisibility(markerEl, true);
      }
    }
  }

  /**
   * Initialize spherical coordinates (theta, phi, radius) based on current camera world position
   */
  _initSphericalFromCamera() {
    const THREE = this.THREE;
    const cam = this._getActiveCamera();
    const camWorldPos = new THREE.Vector3();

    if (cam) {
      cam.getWorldPosition(camWorldPos);
    }

    const offset = new THREE.Vector3().subVectors(camWorldPos, this.centroid);
    let r = offset.length();

    if (r < 0.2) {
      r = 2.2;
      offset.set(0, 0, r);
    }

    this.radius = r;
    this.defaultRadius = r;

    // Azimuth angle (theta) around Y axis
    this.theta = Math.atan2(offset.x, offset.z);
    this.defaultTheta = this.theta;

    // Polar angle (phi) inclination from +Y axis
    this.phi = Math.acos(THREE.MathUtils.clamp(offset.y / r, -1, 1));
    this.defaultPhi = this.phi;

    this._applyCameraTransform();
  }

  /**
   * Get active camera object
   */
  _getActiveCamera() {
    if (this.sceneEl.cameraEl && this.sceneEl.cameraEl.object3D) {
      return this.sceneEl.cameraEl.object3D;
    }
    return this.sceneEl.camera;
  }

  /**
   * Apply calculated spherical coordinates to the camera
   */
  _applyCameraTransform() {
    const cam = this._getActiveCamera();
    if (!cam) return;

    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    const targetX = this.centroid.x + this.radius * sinPhi * sinTheta;
    const targetY = this.centroid.y + this.radius * cosPhi;
    const targetZ = this.centroid.z + this.radius * sinPhi * cosTheta;

    cam.position.set(targetX, targetY, targetZ);
    cam.lookAt(this.centroid.x, this.centroid.y, this.centroid.z);
    cam.updateMatrixWorld(true);
  }

  /**
   * Reset camera pose back to origin (0, 0, 0)
   */
  _restoreCameraPose() {
    const cam = this._getActiveCamera();
    if (cam) {
      cam.position.set(0, 0, 0);
      cam.rotation.set(0, 0, 0);
      cam.quaternion.identity();
      cam.updateMatrixWorld(true);
    }
  }

  /**
   * Smoothly reset view angle and pan position back to initial default perspective
   */
  resetView() {
    if (this._animatingReset) return;
    this._animatingReset = true;

    const startTheta = this.theta;
    const startPhi = this.phi;
    const startRadius = this.radius;
    const startCentroid = this.centroid.clone();

    const targetTheta = this.defaultTheta;
    const targetPhi = this.defaultPhi;
    const targetRadius = this.defaultRadius;
    const targetCentroid = this.defaultCentroid.clone();

    const startTime = performance.now();
    const duration = 400; // ms

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      this.theta = startTheta + (targetTheta - startTheta) * ease;
      this.phi = startPhi + (targetPhi - startPhi) * ease;
      this.radius = startRadius + (targetRadius - startRadius) * ease;
      this.centroid.lerpVectors(startCentroid, targetCentroid, ease);

      this._applyCameraTransform();

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        this._animatingReset = false;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Translate centroid based on screen-space delta movement (camera-plane pan)
   * @param {number} deltaX - Horizontal delta in pixels
   * @param {number} deltaY - Vertical delta in pixels
   */
  _panByScreenDelta(deltaX, deltaY) {
    const THREE = this.THREE;
    const cam = this._getActiveCamera();
    if (!cam) return;

    // Extract right and up basis vectors in world space from camera orientation
    const vRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion).normalize();
    const vUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion).normalize();

    // Scale factor proportional to current radius and viewport dimensions for 1:1 tactile drag feel
    const vh = window.innerHeight || 800;
    const panFactor = (this.radius / vh) * 1.35;

    // Moving camera opposite to drag direction creates the sensation of dragging the 3D world
    const deltaWorld = new THREE.Vector3()
      .addScaledVector(vRight, -deltaX * panFactor)
      .addScaledVector(vUp, deltaY * panFactor);

    this.centroid.add(deltaWorld);
    this._applyCameraTransform();
  }

  /**
   * Toggle visibility of floating UI controls on screen tap
   */
  toggleUIVisibility() {
    this.uiVisible = !this.uiVisible;
    if (this.photoModeToolbar) {
      this.photoModeToolbar.classList.toggle('ui-hidden', !this.uiVisible);
    }
    if (this.photoModeHint) {
      this.photoModeHint.classList.toggle('ui-hidden', !this.uiVisible);
    }
  }

  // ─── Gesture Listeners ────────────────────────────────────────────────

  _attachGestureListeners() {
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

    this._onContextMenu = (e) => {
      if (this.isActive) e.preventDefault();
    };
    window.addEventListener('contextmenu', this._onContextMenu);

    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _detachGestureListeners() {
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);

    if (this._onContextMenu) {
      window.removeEventListener('contextmenu', this._onContextMenu);
    }

    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('wheel', this._onWheel);

    this.isDragging = false;
    this.isPinching = false;
    this.isMouseDown = false;
    this.isPanMode = false;
  }

  _onTouchStart(e) {
    if (!this.isActive) return;

    // Ignore touches directly on UI buttons
    if (e.target.closest('#photo-mode-toolbar') || e.target.closest('button')) {
      return;
    }

    if (e.touches.length === 1) {
      this.isDragging = true;
      this.isPinching = false;
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
      this.touchStartTime = performance.now();
      this.hasMoved = false;
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      this.isPinching = true;
      this.startPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.startPinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      this.startPinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this.startRadius = this.radius;
    }
  }

  _onTouchMove(e) {
    if (!this.isActive) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    if (this.isPinching && e.touches.length === 2) {
      const p1 = e.touches[0];
      const p2 = e.touches[1];

      // Two-finger Pinch Zoom
      const currentDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      if (this.startPinchDist > 0) {
        const scale = currentDist / this.startPinchDist;
        const THREE = this.THREE;
        this.radius = THREE.MathUtils.clamp(
          this.startRadius / scale,
          this.defaultRadius * 0.35,
          this.defaultRadius * 3.5
        );
      }

      // Two-finger Pan
      const midX = (p1.clientX + p2.clientX) / 2;
      const midY = (p1.clientY + p2.clientY) / 2;
      const deltaMidX = midX - this.startPinchMidX;
      const deltaMidY = midY - this.startPinchMidY;
      this.startPinchMidX = midX;
      this.startPinchMidY = midY;

      if (Math.abs(deltaMidX) > 0.3 || Math.abs(deltaMidY) > 0.3) {
        this.hasMoved = true;
        this._panByScreenDelta(deltaMidX, deltaMidY);
      } else {
        this._applyCameraTransform();
      }
    } else if (this.isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - this.startX;
      const dy = e.touches[0].clientY - this.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.hasMoved = true;
      }

      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;

      const rotSpeed = 0.006;
      this.theta -= dx * rotSpeed;
      this.phi -= dy * rotSpeed;

      const THREE = this.THREE;
      // Clamp phi to prevent scene inversion [0.12 rad, PI - 0.12 rad]
      this.phi = THREE.MathUtils.clamp(this.phi, 0.12, Math.PI - 0.12);

      this._applyCameraTransform();
    }
  }

  _onTouchEnd(e) {
    if (!this.isActive) return;

    // Detect single clean tap to toggle UI controls visibility
    if (!this.hasMoved && performance.now() - this.touchStartTime < 300 && e.changedTouches.length === 1) {
      if (!e.target.closest('#photo-mode-toolbar') && !e.target.closest('button')) {
        this.toggleUIVisibility();
      }
    }

    if (e.touches.length === 0) {
      this.isDragging = false;
      this.isPinching = false;
    } else if (e.touches.length === 1) {
      this.isPinching = false;
      this.isDragging = true;
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
    }
  }

  _onMouseDown(e) {
    if (!this.isActive) return;
    if (e.target.closest('#photo-mode-toolbar') || e.target.closest('button')) return;

    this.isMouseDown = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.touchStartTime = performance.now();
    this.hasMoved = false;

    // Right-click (button 2), middle-click (button 1), or Shift-click activates Pan mode
    this.isPanMode = e.button === 2 || e.button === 1 || e.shiftKey;
  }

  _onMouseMove(e) {
    if (!this.isActive || !this.isMouseDown) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.hasMoved = true;
    }

    this.startX = e.clientX;
    this.startY = e.clientY;

    if (this.isPanMode) {
      this._panByScreenDelta(dx, dy);
    } else {
      const rotSpeed = 0.005;
      this.theta -= dx * rotSpeed;
      this.phi -= dy * rotSpeed;

      const THREE = this.THREE;
      this.phi = THREE.MathUtils.clamp(this.phi, 0.12, Math.PI - 0.12);

      this._applyCameraTransform();
    }
  }

  _onMouseUp(e) {
    if (!this.isActive || !this.isMouseDown) return;
    this.isMouseDown = false;
    this.isPanMode = false;

    if (!this.hasMoved && performance.now() - this.touchStartTime < 300) {
      if (!e.target.closest('#photo-mode-toolbar') && !e.target.closest('button')) {
        this.toggleUIVisibility();
      }
    }
  }

  _onWheel(e) {
    if (!this.isActive) return;
    e.preventDefault();

    const THREE = this.THREE;
    const zoomDelta = e.deltaY * 0.0015 * this.defaultRadius;
    this.radius = THREE.MathUtils.clamp(
      this.radius + zoomDelta,
      this.defaultRadius * 0.35,
      this.defaultRadius * 3.5
    );
    this._applyCameraTransform();
  }
}
