/**
 * BirthdayFX - Happy Birthday Celebration Transition System
 * Manages STANDBY → CHARGING → TRANSITION → CELEBRATION state machine.
 * Features progress charging ring, supernova shockwave flash, spring-bounce 3D text reveal,
 * and floating radial confetti particles.
 */

import { BaseFX } from './base-fx.js';
import { fetchFont, buildTextMesh } from '../core/font-loader.js';

export const BirthdayState = {
  STANDBY: 'STANDBY',
  CHARGING: 'CHARGING',
  TRANSITION: 'TRANSITION',
  CELEBRATION: 'CELEBRATION'
};

export class BirthdayFX extends BaseFX {
  /**
   * @param {THREE.Scene} scene - Root Three.js scene
   * @param {Object} options - Configuration
   */
  constructor(scene, options = {}) {
    super(scene, options);

    this.options = Object.assign({
      chargeThreshold: 1.6,          // Distance (m) at which charging begins
      chargeDuration: 3.0,           // Seconds to fully charge
      transitionDuration: 1.5,       // Seconds for transition animation
      celebrationFadeDuration: 10.0, // Seconds delay before fading out when markers separate
      confettiCount: 180,            // Number of confetti particles
      textLine1: 'Happy Birthday'    // 3D Text string
    }, options);

    // State machine
    this.state = BirthdayState.STANDBY;
    this.chargeAccumulated = 0;
    this.transitionElapsed = 0;
    this.celebrationFadeTimer = 0;

    // Sub-groups
    this._initShockwave();
    this._initCelebrationText();
    this._initConfetti();
    this._initCelebrationLight();

    // Enable Bloom Layer 1 AFTER all sub-meshes are initialized
    this.enableBloomLayer();
  }

  /**
   * Enables Layer 1 on all visual objects for Selective Bloom Post-Processing
   */
  enableBloomLayer() {
    this.group.traverse((obj) => {
      if (obj.isMesh || obj.isPoints || obj.isLight) {
        obj.layers.enable(1);
      }
    });
  }

  // ─── Sub-system Initialization ───────────────────────────────────────

  /**
   * Expanding shockwave ring for the transition flash (Pure Intense White)
   */
  _initShockwave() {
    const THREE = this.THREE;
    const geo = new THREE.RingGeometry(0.01, 0.06, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
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
   * 3D "Happy Birthday" text in Fredoka font (#00CBA9 color)
   */
  _initCelebrationText() {
    const THREE = this.THREE;
    this.textGroup = new THREE.Group();
    this.textGroup.visible = false;
    this.textGroup.scale.set(0, 0, 0);

    this._textMeshes = [];
    this._textReady = false;

    fetchFont('./fonts/fredoka_light_regular.json').then((fontData) => {
      const mesh = buildTextMesh(THREE, fontData, {
        text: this.options.textLine1,
        size: 0.48,
        depth: 0.08,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 5,
        color: 0x00CBA9,
        emissive: 0x00CBA9,
        emissiveIntensity: 1.2
      });
      mesh.position.y = 0.15;
      mesh.layers.enable(1);
      this.textGroup.add(mesh);
      this._textMeshes.push(mesh);
      this._textReady = true;
    }).catch((err) => {
      console.error('[BirthdayFX] Failed to load font:', err);
    });

    this.textGroup.layers.enable(1);
    this.group.add(this.textGroup);
  }

  /**
   * Confetti particle system with soft radial glowing particles
   */
  _initConfetti() {
    const THREE = this.THREE;
    const count = this.options.confettiCount;

    this.confettiPositions = new Float32Array(count * 3);
    this.confettiColors = new Float32Array(count * 3);
    this.confettiVelocities = [];
    this.confettiPhases = [];

    const palette = [
      new THREE.Color(0x00cba9), // Teal Green
      new THREE.Color(0xfbbf24), // Gold
      new THREE.Color(0xf59e0b), // Amber
      new THREE.Color(0xf472b6), // Pink
      new THREE.Color(0xc084fc), // Lavender
      new THREE.Color(0xfef3c7), // Cream
      new THREE.Color(0x34d399), // Emerald
      new THREE.Color(0x60a5fa)  // Sky Blue
    ];

    for (let i = 0; i < count; i++) {
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

    this.confettiGeo = new THREE.BufferGeometry();
    this.confettiGeo.setAttribute('position', new THREE.BufferAttribute(this.confettiPositions, 3));
    this.confettiGeo.setAttribute('color', new THREE.BufferAttribute(this.confettiColors, 3));

    this.confettiTexture = this._createConfettiTexture();

    this.confettiMat = new THREE.PointsMaterial({
      map: this.confettiTexture,
      vertexColors: true,
      size: 0.08,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.confettiPoints = new THREE.Points(this.confettiGeo, this.confettiMat);
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

  _setState(newState) {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    console.log(`[BirthdayFX] State transition: ${oldState} -> ${newState}`);
  }

  /**
   * Main update loop called each frame.
   *
   * @param {THREE.Vector3|null} pos1 - Marker 1 smoothed world position
   * @param {THREE.Vector3|null} pos2 - Marker 2 smoothed world position
   * @param {number} distance - Current distance between markers
   * @param {number} proximity - Normalized proximity (0 to 1)
   * @param {number} deltaMs - Frame delta milliseconds
   * @returns {{ state: string, chargePercent: number, chargeProgress: number, lightningIntensity: number }}
   */
  update(pos1, pos2, distance, proximity, deltaMs) {
    const deltaSec = deltaMs / 1000;
    const markersActive = pos1 !== null && pos2 !== null && distance < 900;
    const withinChargeRange = markersActive && distance <= this.options.chargeThreshold;

    let lightningIntensity = 1.0;

    switch (this.state) {
      case BirthdayState.STANDBY:
        this._updateStandby(withinChargeRange);
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

  // ─── STANDBY ─────────────────────────────────────────────────────────

  _updateStandby(withinChargeRange) {
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
    if (!markersActive || !withinChargeRange) {
      this.chargeAccumulated = 0;
      this._setState(BirthdayState.STANDBY);
      return 1.0;
    }

    this.chargeAccumulated += deltaSec;
    const progress = Math.min(1.0, this.chargeAccumulated / this.options.chargeDuration);

    // Lightning intensifies and shifts color during charging (1.0 -> 1.8x)
    const lightningIntensity = 1.0 + progress * 0.8;

    if (progress >= 1.0) {
      this.transitionElapsed = 0;
      this._setState(BirthdayState.TRANSITION);
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
    const progress = Math.min(1.0, t / duration);

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

    // Phase 1: Implosion / Overload (0 - 0.3)
    if (progress < 0.3) {
      const implosionP = progress / 0.3;
      return Math.max(0, 1.8 - implosionP * 1.8);
    }

    // Phase 2: Blinding Pure White Flash & Expanding Shockwave (0.3 - 0.5)
    if (progress < 0.5) {
      const flashP = (progress - 0.3) / 0.2;

      const shockScale = 0.1 + flashP * 5.0;
      this.shockwaveMesh.scale.set(shockScale, shockScale, shockScale);
      this.shockwaveMesh.material.color.setHex(0xffffff);
      this.shockwaveMesh.material.opacity = (1.0 - flashP) * 1.0;

      this.celebrationLight.color.setHex(0xffffff);
      this.celebrationLight.intensity = (1.0 - flashP) * 12.0;

      return 0; // Lightning dims during explosion
    }

    // Phase 3: Supernova / Spring-bounce Text Reveal + Confetti Burst (0.5 - 1.0)
    const supernovaP = (progress - 0.5) / 0.5;

    this.shockwaveMesh.material.opacity = 0;
    this.celebrationLight.color.setHex(0x00cba9);

    if (this._textReady) {
      this.textGroup.visible = true;
      const springT = this._springEase(supernovaP);
      const textScale = springT * 0.85;
      this.textGroup.scale.set(textScale, textScale, textScale);
    }

    this.confettiMat.opacity = Math.min(0.85, supernovaP * 1.2);
    if (pos1 && pos2) {
      this._updateConfettiPhysics(pos1, pos2, deltaSec);
    }

    this.celebrationLight.intensity = supernovaP * 3.0;

    if (progress >= 1.0) {
      this._setState(BirthdayState.CELEBRATION);
    }

    return 0;
  }

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
      this.celebrationFadeTimer += deltaSec;
      if (this.celebrationFadeTimer >= this.options.celebrationFadeDuration) {
        this.chargeAccumulated = 0;
        this._setState(BirthdayState.STANDBY);
        return 1.0;
      }
    }

    const fadeFactor = markersActive ? 1.0 : Math.max(0, 1.0 - this.celebrationFadeTimer / this.options.celebrationFadeDuration);

    if (this._textReady) {
      this.textGroup.visible = true;
      const baseScale = 0.85 * fadeFactor;
      this.textGroup.scale.set(baseScale, baseScale, baseScale);
      this.textGroup.rotation.y = 0;

      const baseHeightOffset = 0.85;
      const bobbingY = Math.sin(performance.now() * 0.003) * 0.09;
      if (markersActive && pos1 && pos2) {
        const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
        this.textGroup.position.copy(mid);
      }
      this.textGroup.position.y += baseHeightOffset + bobbingY;

      const emPulse = 1.0 + Math.sin(performance.now() * 0.003) * 0.3;
      for (const mesh of this._textMeshes) {
        if (mesh.material) {
          mesh.material.emissiveIntensity = emPulse * fadeFactor;
        }
      }
    }

    this.confettiMat.opacity = 0.85 * fadeFactor;
    if (pos1 && pos2) {
      this._updateConfettiPhysics(pos1, pos2, deltaSec);
    }

    const lightPulse = 2.5 + Math.sin(performance.now() * 0.004) * 1.0;
    this.celebrationLight.intensity = lightPulse * fadeFactor;

    return 0;
  }

  // ─── Confetti Physics ────────────────────────────────────────────────

  _spawnConfettiAtMidpoint(pos1, pos2) {
    const mid = pos1.clone().add(pos2).multiplyScalar(0.5);
    const count = this.options.confettiCount;
    const positions = this.confettiPositions;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = mid.x + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] = mid.y + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 2] = mid.z + (Math.random() - 0.5) * 0.1;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 0.02 + Math.random() * 0.04;

      this.confettiVelocities[i].set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + 0.015,
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

      positions[i * 3] += vel.x;
      positions[i * 3 + 1] += vel.y;
      positions[i * 3 + 2] += vel.z;

      vel.y -= 0.0004;

      positions[i * 3] += Math.sin(now * 0.002 + phase) * 0.001;
      positions[i * 3 + 2] += Math.cos(now * 0.0015 + phase) * 0.001;

      vel.x *= 0.995;
      vel.y *= 0.997;
      vel.z *= 0.995;

      const dx = positions[i * 3] - mid.x;
      const dy = positions[i * 3 + 1] - mid.y;
      const dz = positions[i * 3 + 2] - mid.z;
      const distSq = dx * dx + dy * dy + dz * dz;

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

    this.confettiMat.size = 0.08 + Math.sin(now * 0.003) * 0.02;
    this.confettiGeo.attributes.position.needsUpdate = true;
  }

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

  dispose() {
    super.dispose();
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
