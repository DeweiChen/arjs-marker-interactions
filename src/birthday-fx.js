/**
 * BirthdayFX - Happy Birthday Fu Celebration Transition System
 * Manages the STANDBY → CHARGING → TRANSITION → CELEBRATION lifecycle.
 * Renders charge progress ring, implosion-to-supernova transition, and
 * floating "Happy Birthday Fu" 3D text with confetti particles.
 */

export const BirthdayState = {
  STANDBY: 'STANDBY',
  CHARGING: 'CHARGING',
  TRANSITION: 'TRANSITION',
  CELEBRATION: 'CELEBRATION'
};

export class BirthdayFX {
  /**
   * @param {THREE.Scene} scene - Root Three.js scene (sceneEl.object3D)
   * @param {Object} options - Configuration
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.THREE = window.THREE || AFRAME.THREE;

    this.options = Object.assign({
      chargeThreshold: 1.6,       // Distance (m) at which charging begins (1.6m avoids marker occlusion)
      chargeDuration: 3.0,        // Seconds to fully charge
      transitionDuration: 1.5,    // Seconds for transition animation
      celebrationFadeDuration: 10.0, // 10 seconds delay before fading out celebration when markers separate
      confettiCount: 180,         // Number of confetti particles
      textLine1: 'Happy Birthday' // Single line text without Fu
    }, options);

    // State machine
    this.state = BirthdayState.STANDBY;
    this.chargeAccumulated = 0;   // Seconds accumulated while close
    this.transitionElapsed = 0;   // Seconds into transition animation
    this.celebrationFadeTimer = 0; // Fade-out timer when markers separate during celebration

    // Root group for all birthday visuals
    this.group = new this.THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Sub-groups
    this._initShockwave();
    this._initCelebrationText();
    this._initConfetti();
    this._initCelebrationLight();

    // Enable bloom layer on all meshes
    this._enableBloomLayer();
  }

  // ─── Initialization ──────────────────────────────────────────────────

  _enableBloomLayer() {
    this.group.traverse((obj) => {
      if (obj.isMesh || obj.isPoints || obj.isLight) {
        obj.layers.enable(1);
      }
    });
  }

  /**
   * Expanding shockwave ring for the transition flash (Pure Intense White)
   */
  _initShockwave() {
    const THREE = this.THREE;
    const geo = new THREE.RingGeometry(0.01, 0.06, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, // Pure Intense White Flash
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.shockwaveMesh = new THREE.Mesh(geo, mat);
    this.shockwaveMesh.layers.enable(1);
    this.group.add(this.shockwaveMesh);
  }

  /**
   * 3D "Happy Birthday" text in clean rounded Fredoka font and 0x00CBA9 color
   */
  _initCelebrationText() {
    const THREE = this.THREE;
    this.textGroup = new THREE.Group();
    this.textGroup.visible = false;
    this.textGroup.scale.set(0, 0, 0);

    // We'll build text meshes asynchronously via font loading
    this._textMeshes = [];
    this._textReady = false;

    this._loadFont().then((fontData) => {
      // Single line text "Happy Birthday" in original Teal Green (#00CBA9) with rounded Fredoka font (size 0.48)
      this._buildTextMesh(fontData, this.options.textLine1, 0.48, 0x00CBA9, 0x00CBA9, 0.15);
      this._textReady = true;
    }).catch((err) => {
      console.error('[BirthdayFX] Failed to load font:', err);
    });

    this.group.add(this.textGroup);
  }

  async _loadFont() {
    const url = './fonts/fredoka_light_regular.json';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      const fallback = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/fonts/helvetiker_bold.typeface.json';
      const res = await fetch(fallback);
      return await res.json();
    }
  }

  _buildTextMesh(fontData, text, size, color, emissive, yOffset) {
    const THREE = this.THREE;
    const paths = this._createPaths(text, size, fontData);
    const shapes = [];
    for (const p of paths) {
      shapes.push(...p.toShapes());
    }

    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.08,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelOffset: 0,
      bevelSegments: 5
    });

    geometry.computeBoundingBox();
    geometry.center();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(emissive),
      emissiveIntensity: 1.2,
      roughness: 0.25,
      metalness: 0.15
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = yOffset;
    mesh.layers.enable(1);
    this.textGroup.add(mesh);
    this._textMeshes.push(mesh);
  }

  /**
   * Minimal font path generator (same logic as three-text-3d.js createPaths)
   */
  _createPaths(text, size, data) {
    const THREE = this.THREE;
    const chars = Array.from(text);
    const scale = size / data.resolution;
    const paths = [];
    let offsetX = 0;

    for (const char of chars) {
      const glyph = data.glyphs[char] || data.glyphs['?'];
      if (!glyph) continue;

      const path = new THREE.ShapePath();
      if (glyph.o) {
        const outline = glyph._cachedOutline || (glyph._cachedOutline = glyph.o.split(' '));
        for (let j = 0; j < outline.length;) {
          const action = outline[j++];
          switch (action) {
            case 'm':
              path.moveTo(outline[j++] * scale + offsetX, outline[j++] * scale);
              break;
            case 'l':
              path.lineTo(outline[j++] * scale + offsetX, outline[j++] * scale);
              break;
            case 'q': {
              const cpx = outline[j++] * scale + offsetX;
              const cpy = outline[j++] * scale;
              const cpx1 = outline[j++] * scale + offsetX;
              const cpy1 = outline[j++] * scale;
              path.quadraticCurveTo(cpx1, cpy1, cpx, cpy);
              break;
            }
            case 'b': {
              const bpx = outline[j++] * scale + offsetX;
              const bpy = outline[j++] * scale;
              const bpx1 = outline[j++] * scale + offsetX;
              const bpy1 = outline[j++] * scale;
              const bpx2 = outline[j++] * scale + offsetX;
              const bpy2 = outline[j++] * scale;
              path.bezierCurveTo(bpx1, bpy1, bpx2, bpy2, bpx, bpy);
              break;
            }
          }
        }
      }
      offsetX += glyph.ha * scale;
      paths.push(path);
    }
    return paths;
  }

  /**
   * Confetti particle system with gold/pink/lavender colors
   */
  _initConfetti() {
    const THREE = this.THREE;
    const count = this.options.confettiCount;

    this.confettiPositions = new Float32Array(count * 3);
    this.confettiColors = new Float32Array(count * 3);
    this.confettiVelocities = [];
    this.confettiPhases = [];

    const palette = [
      new THREE.Color(0x00cba9), // Teal Green (Original)
      new THREE.Color(0xfbbf24), // Gold
      new THREE.Color(0xf59e0b), // Amber
      new THREE.Color(0xf472b6), // Pink
      new THREE.Color(0xc084fc), // Lavender
      new THREE.Color(0xfef3c7), // Cream
      new THREE.Color(0x34d399), // Emerald
      new THREE.Color(0x60a5fa)  // Sky Blue
    ];

    for (let i = 0; i < count; i++) {
      // Start at origin (will be repositioned during celebration)
      this.confettiPositions[i * 3] = 0;
      this.confettiPositions[i * 3 + 1] = 0;
      this.confettiPositions[i * 3 + 2] = 0;

      const col = palette[Math.floor(Math.random() * palette.length)];
      this.confettiColors[i * 3] = col.r;
      this.confettiColors[i * 3 + 1] = col.g;
      this.confettiColors[i * 3 + 2] = col.b;

      this.confettiVelocities.push(new THREE.Vector3());
      this.confettiPhases.push(Math.random() * Math.PI * 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.confettiPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.confettiColors, 3));

    // Create soft glow texture for confetti
    this.confettiTexture = this._createConfettiTexture();

    const mat = new THREE.PointsMaterial({
      map: this.confettiTexture,
      vertexColors: true,
      size: 0.1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.confettiGeo = geo;
    this.confettiMat = mat;
    this.confettiPoints = new THREE.Points(geo, mat);
    this.confettiPoints.layers.enable(1);
    this.group.add(this.confettiPoints);
  }

  _createConfettiTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 240, 0.9)');
    gradient.addColorStop(0.6, 'rgba(0, 203, 169, 0.5)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    return new this.THREE.CanvasTexture(canvas);
  }

  _initCelebrationLight() {
    const THREE = this.THREE;
    this.celebrationLight = new THREE.PointLight(0x00cba9, 0, 5);
    this.celebrationLight.layers.enable(1);
    this.group.add(this.celebrationLight);
  }

  // ─── State Machine ───────────────────────────────────────────────────

  /**
   * Main update called each tick from proximity-component.
   * @param {THREE.Vector3|null} pos1 - Marker 1 smoothed world position
   * @param {THREE.Vector3|null} pos2 - Marker 2 smoothed world position
   * @param {number} distance - Current distance between markers
   * @param {number} proximity - Normalized proximity (0-1)
   * @param {number} deltaMs - Frame delta in milliseconds
   * @returns {{ state: string, chargePercent: number, lightningIntensity: number }}
   */
  update(pos1, pos2, distance, proximity, deltaMs) {
    const deltaSec = deltaMs / 1000;
    const markersActive = pos1 !== null && pos2 !== null;
    const withinChargeRange = markersActive && distance <= this.options.chargeThreshold;

    let lightningIntensity = 1.0; // Default: normal lightning

    switch (this.state) {
      case BirthdayState.STANDBY:
        this._updateStandby(withinChargeRange, deltaSec);
        break;

      case BirthdayState.CHARGING:
        lightningIntensity = this._updateCharging(withinChargeRange, markersActive, deltaSec, pos1, pos2);
        break;

      case BirthdayState.TRANSITION:
        lightningIntensity = this._updateTransition(deltaSec, pos1, pos2, markersActive);
        break;

      case BirthdayState.CELEBRATION:
        lightningIntensity = this._updateCelebration(deltaSec, markersActive, pos1, pos2);
        break;
    }

    const chargePercent = Math.min(100, Math.round((this.chargeAccumulated / this.options.chargeDuration) * 100));
    const chargeProgress = Math.min(1.0, this.chargeAccumulated / this.options.chargeDuration);

    return {
      state: this.state,
      chargePercent,
      chargeProgress: this.state === BirthdayState.CHARGING ? chargeProgress : 0,
      lightningIntensity
    };
  }

  _setState(newState) {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    console.log(`[BirthdayFX] State: ${oldState} → ${newState}`);
  }

  // ─── STANDBY ─────────────────────────────────────────────────────────

  _updateStandby(withinChargeRange, deltaSec) {
    // Hide birthday visuals
    this.group.visible = false;
    this.textGroup.visible = false;
    this.shockwaveMesh.material.opacity = 0;
    this.confettiMat.opacity = 0;
    this.celebrationLight.intensity = 0;
    this.transitionElapsed = 0;
    this.celebrationFadeTimer = 0;

    if (withinChargeRange) {
      this.chargeAccumulated = 0;
      this._setState(BirthdayState.CHARGING);
    }
  }

  // ─── CHARGING ────────────────────────────────────────────────────────

  _updateCharging(withinChargeRange, markersActive, deltaSec, pos1, pos2) {
    if (!markersActive) {
      // Lost markers entirely — reset
      this.chargeAccumulated = 0;
      this._setState(BirthdayState.STANDBY);
      return 1.0;
    }

    if (!withinChargeRange) {
      // Markers moved apart — reset charge
      this.chargeAccumulated = 0;
      this._setState(BirthdayState.STANDBY);
      return 1.0;
    }

    // Accumulate charge
    this.chargeAccumulated += deltaSec;
    const progress = Math.min(1, this.chargeAccumulated / this.options.chargeDuration);

    // Lightning intensifies and shifts color during charging (1.0 → 1.8x)
    const lightningIntensity = 1.0 + progress * 0.8;

    // Check if fully charged
    if (progress >= 1.0) {
      this.transitionElapsed = 0;
      this._setState(BirthdayState.TRANSITION);
      // Spawn confetti positions at midpoint
      if (pos1 && pos2) {
        this._spawnConfettiAtMidpoint(pos1, pos2);
      }
    }

    return lightningIntensity;
  }

  // ─── TRANSITION ──────────────────────────────────────────────────────

  _updateTransition(deltaSec, pos1, pos2, markersActive) {
    this.transitionElapsed += deltaSec;
    const t = this.transitionElapsed;
    const duration = this.options.transitionDuration;
    const progress = Math.min(1, t / duration);

    if (pos1 && pos2) {
      const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
      this.textGroup.position.copy(mid);
      this.textGroup.position.y += 0.85;
      this.textGroup.rotation.y = 0;
      this.shockwaveMesh.position.copy(mid);
      this.celebrationLight.position.copy(mid);
      this.celebrationLight.position.y += 0.85;
    }

    this.group.visible = true;

    // Phase 1: Implosion / Overload (0–0.3)
    if (progress < 0.3) {
      const implosionP = progress / 0.3;
      // Return high intensity for white lightning overload
      return Math.max(0, 1.8 - implosionP * 1.8);
    }

    // Phase 2: Blinding Pure White Flash & Expanding Shockwave (0.3–0.5)
    if (progress < 0.5) {
      const flashP = (progress - 0.3) / 0.2;

      // Pure White Shockwave expands outwards
      const shockScale = 0.1 + flashP * 5.0;
      this.shockwaveMesh.scale.set(shockScale, shockScale, shockScale);
      this.shockwaveMesh.material.color.setHex(0xffffff);
      this.shockwaveMesh.material.opacity = (1.0 - flashP) * 1.0;

      // Celebration light creates a blinding Pure White flash
      this.celebrationLight.color.setHex(0xffffff);
      this.celebrationLight.intensity = (1.0 - flashP) * 12.0;

      return 0; // Lightning is gone
    }

    // Phase 3: Supernova / Text Reveal (0.5–1.0)
    const supernovaP = (progress - 0.5) / 0.5;

    this.shockwaveMesh.material.opacity = 0;

    // Restore celebration light color to teal green (#00CBA9) for text
    this.celebrationLight.color.setHex(0x00cba9);

    // Text appears with spring-bounce scale
    if (this._textReady) {
      this.textGroup.visible = true;
      const springT = this._springEase(supernovaP);
      const textScale = springT * 0.85;
      this.textGroup.scale.set(textScale, textScale, textScale);
    }

    // Confetti appears
    this.confettiMat.opacity = Math.min(0.85, supernovaP * 1.2);
    if (pos1 && pos2) {
      this._updateConfettiPhysics(pos1, pos2, deltaSec);
    }

    // Celebration light
    this.celebrationLight.intensity = supernovaP * 3.0;

    // Transition complete
    if (progress >= 1.0) {
      this._setState(BirthdayState.CELEBRATION);
    }

    return 0;
  }

  /**
   * Spring-bounce easing for text reveal
   */
  _springEase(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  // ─── CELEBRATION ─────────────────────────────────────────────────────

  _updateCelebration(deltaSec, markersActive, pos1, pos2) {
    this.group.visible = true;
    this.shockwaveMesh.material.opacity = 0;

    if (markersActive && pos1 && pos2) {
      const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
      this.textGroup.position.copy(mid);
      this.celebrationLight.position.copy(mid);
      this.celebrationFadeTimer = 0;
    } else {
      // Markers lost — start fade timer
      this.celebrationFadeTimer += deltaSec;
      if (this.celebrationFadeTimer >= this.options.celebrationFadeDuration) {
        // Reset to standby
        this.chargeAccumulated = 0;
        this._setState(BirthdayState.STANDBY);
        return 1.0;
      }
    }

    // Calculate fade factor
    const fadeFactor = markersActive ? 1.0 : Math.max(0, 1.0 - this.celebrationFadeTimer / this.options.celebrationFadeDuration);

    // Animate text (No rotation, elevated height, smooth up-and-down bobbing)
    if (this._textReady) {
      this.textGroup.visible = true;
      const baseScale = 0.85 * fadeFactor;
      this.textGroup.scale.set(baseScale, baseScale, baseScale);

      // Fixed orientation (NO rotation)
      this.textGroup.rotation.y = 0;

      // Elevated height above midpoint (+0.85m) + smooth up & down bobbing (±0.09m)
      const baseHeightOffset = 0.85;
      const bobbingY = Math.sin(performance.now() * 0.003) * 0.09;
      if (markersActive && pos1 && pos2) {
        const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
        this.textGroup.position.copy(mid);
      }
      this.textGroup.position.y += baseHeightOffset + bobbingY;

      // Pulse emissive intensity on text meshes
      const emPulse = 1.0 + Math.sin(performance.now() * 0.003) * 0.3;
      for (const mesh of this._textMeshes) {
        if (mesh.material) {
          mesh.material.emissiveIntensity = emPulse * fadeFactor;
        }
      }
    }

    // Confetti animation
    this.confettiMat.opacity = 0.85 * fadeFactor;
    if (pos1 && pos2) {
      this._updateConfettiPhysics(pos1, pos2, deltaSec);
    }

    // Celebration light
    const lightPulse = 2.5 + Math.sin(performance.now() * 0.004) * 1.0;
    this.celebrationLight.intensity = lightPulse * fadeFactor;

    return 0; // No lightning during celebration
  }

  // ─── Confetti Physics ────────────────────────────────────────────────

  _spawnConfettiAtMidpoint(pos1, pos2) {
    const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
    const count = this.options.confettiCount;
    const positions = this.confettiPositions;

    for (let i = 0; i < count; i++) {
      // Start at midpoint with slight random offset
      positions[i * 3] = mid.x + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] = mid.y + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 2] = mid.z + (Math.random() - 0.5) * 0.1;

      // Radial burst velocity
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 0.02 + Math.random() * 0.04;

      this.confettiVelocities[i].set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + 0.015, // Slight upward bias
        Math.cos(phi) * speed
      );

      this.confettiPhases[i] = Math.random() * Math.PI * 2;
    }

    this.confettiGeo.attributes.position.needsUpdate = true;
  }

  _updateConfettiPhysics(pos1, pos2, deltaSec) {
    const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
    const count = this.options.confettiCount;
    const positions = this.confettiPositions;
    const now = performance.now();

    for (let i = 0; i < count; i++) {
      const vel = this.confettiVelocities[i];
      const phase = this.confettiPhases[i];

      // Apply velocity
      positions[i * 3] += vel.x;
      positions[i * 3 + 1] += vel.y;
      positions[i * 3 + 2] += vel.z;

      // Gentle gravity
      vel.y -= 0.0004;

      // Sine-wave drift for floaty feel
      positions[i * 3] += Math.sin(now * 0.002 + phase) * 0.001;
      positions[i * 3 + 2] += Math.cos(now * 0.0015 + phase) * 0.001;

      // Drag
      vel.x *= 0.995;
      vel.y *= 0.997;
      vel.z *= 0.995;

      // Distance from midpoint
      const dx = positions[i * 3] - mid.x;
      const dy = positions[i * 3 + 1] - mid.y;
      const dz = positions[i * 3 + 2] - mid.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Re-spawn if too far (> 1.5m radius) or fallen below midpoint
      if (distSq > 2.25 || positions[i * 3 + 1] < mid.y - 0.8) {
        positions[i * 3] = mid.x + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = mid.y + Math.random() * 0.3;
        positions[i * 3 + 2] = mid.z + (Math.random() - 0.5) * 0.3;

        const theta = Math.random() * Math.PI * 2;
        const speed = 0.008 + Math.random() * 0.015;
        vel.set(
          Math.cos(theta) * speed,
          0.01 + Math.random() * 0.02,
          Math.sin(theta) * speed
        );
      }
    }

    // Dynamic confetti size
    this.confettiMat.size = 0.08 + Math.sin(now * 0.003) * 0.02;
    this.confettiGeo.attributes.position.needsUpdate = true;
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Force reset to standby (e.g. from external control)
   */
  reset() {
    this.chargeAccumulated = 0;
    this.transitionElapsed = 0;
    this.celebrationFadeTimer = 0;
    this.group.visible = false;
    this.textGroup.visible = false;
    this.confettiMat.opacity = 0;
    this.shockwaveMesh.material.opacity = 0;
    this.celebrationLight.intensity = 0;
    this._setState(BirthdayState.STANDBY);
  }

  /**
   * Dispose all Three.js resources
   */
  dispose() {
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    if (this.chargeRingMesh && this.chargeRingMesh.geometry) {
      this.chargeRingMesh.geometry.dispose();
    }
    this.chargeRingMat?.dispose();
    this.chargeTrackMesh?.geometry?.dispose();
    this.chargeTrackMesh?.material?.dispose();
    this.shockwaveMesh?.geometry?.dispose();
    this.shockwaveMesh?.material?.dispose();
    this.confettiGeo?.dispose();
    this.confettiMat?.dispose();
    this.confettiTexture?.dispose();
    for (const mesh of this._textMeshes) {
      mesh?.geometry?.dispose();
      mesh?.material?.dispose();
    }
  }
}
