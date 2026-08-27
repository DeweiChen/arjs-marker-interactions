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
      chargeThreshold: 1.8,          // Distance (m) at which charging begins
      chargeDuration: 3.0,           // Seconds to fully charge
      transitionDuration: 1.5,       // Seconds for transition animation
      celebrationFadeDuration: 1.5,  // Seconds delay before fading out when markers separate
      confettiCount: 180,            // Number of confetti particles
      textLine1: 'Happy Birthday 30',   // 3D Text string
      audioUrl: './assets/HBD.mp3'   // Birthday music track
    }, options);

    // State machine
    this.state = BirthdayState.STANDBY;
    this.chargeAccumulated = 0;
    this.transitionElapsed = 0;
    this.celebrationFadeTimer = 0;
    this.celebrationTime = 0;

    // Sub-groups
    this._initCelebrationText();
    this._initConfetti();
    this._initCelebrationLight();
    this._initAudio();

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
   * 3D "Happy Birthday" text in Fredoka font (Pearl White with Golden Glow)
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
        color: 0xF4E0AE,
        emissive: 0xF4E0AE,
        emissiveIntensity: 1.5
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
      new THREE.Color(0xffffff), // Pure Radiant White Sparkle
      new THREE.Color(0xffd700), // Vibrant Gold Spark
      new THREE.Color(0x00cba9), // Bright Teal Green
      new THREE.Color(0xf472b6), // Electric Pink
      new THREE.Color(0x60a5fa), // Vivid Sky Blue
      new THREE.Color(0xfbbf24), // Warm Gold
      new THREE.Color(0xc084fc)  // Lavender Sparkle
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
      this.confettiPhases[i] = Math.random() * Math.PI * 2;
    }

    this.confettiGeo = new THREE.BufferGeometry();
    this.confettiGeo.setAttribute('position', new THREE.BufferAttribute(this.confettiPositions, 3));
    this.confettiGeo.setAttribute('color', new THREE.BufferAttribute(this.confettiColors, 3));

    this.confettiTexture = this._createConfettiTexture();

    this.confettiMat = new THREE.PointsMaterial({
      map: this.confettiTexture,
      vertexColors: true,
      size: 0.065,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.confettiPoints = new THREE.Points(this.confettiGeo, this.confettiMat);
    this.confettiPoints.layers.enable(1);
    this.group.add(this.confettiPoints);
  }

  /**
   * Generates a 64x64 multi-layered starburst spark canvas texture with crisp cross flare lines
   */
  _createConfettiTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 64, 64);

    // Multi-stage radial glow core
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 245, 200, 0.95)');
    gradient.addColorStop(0.45, 'rgba(255, 215, 0, 0.5)');
    gradient.addColorStop(0.8, 'rgba(244, 114, 182, 0.2)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    // Primary cross flare lines (starburst)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(32, 6); ctx.lineTo(32, 58);
    ctx.moveTo(6, 32); ctx.lineTo(58, 32);
    ctx.stroke();

    // Secondary diagonal sub-rays for starburst bloom
    ctx.strokeStyle = 'rgba(255, 235, 180, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 14); ctx.lineTo(50, 50);
    ctx.moveTo(50, 14); ctx.lineTo(14, 50);
    ctx.stroke();

    return new this.THREE.CanvasTexture(canvas);
  }

  _initCelebrationLight() {
    const THREE = this.THREE;
    this.celebrationLight = new THREE.PointLight(0xF4E0AE, 0, 5);
    this.celebrationLight.layers.enable(1);
    this.group.add(this.celebrationLight);
  }

  /**
   * Initializes audio element and unlocks autoplay policy on first user interaction
   */
  _initAudio() {
    if (this.options.audioUrl) {
      this.audio = new Audio(this.options.audioUrl);
      this.audio.loop = false;
      this.audioPlayed = false;
      this.audioUnlocked = false;

      const unlockAudio = () => {
        if (this.audioUnlocked) return;
        if (this.audio) {
          const promise = this.audio.play();
          if (promise !== undefined) {
            promise.then(() => {
              this.audioUnlocked = true;
              if (!this.audioPlayed && this.state !== BirthdayState.CELEBRATION && this.state !== BirthdayState.TRANSITION) {
                this.audio.pause();
                this.audio.currentTime = 0;
              }
            }).catch(() => { });
          }
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };

      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });

      // Automatically pause music when tab/window is minimized or hidden
      this._onVisibilityChange = () => {
        if (document.hidden || document.visibilityState === 'hidden') {
          this._pauseAudio();
        } else if (this.audioUnlocked && (this.state === BirthdayState.CELEBRATION || this.state === BirthdayState.TRANSITION)) {
          this._playAudio();
        }
      };

      document.addEventListener('visibilitychange', this._onVisibilityChange);
      window.addEventListener('pagehide', this._onVisibilityChange);
    }
  }

  /**
   * Starts or resumes music playback when celebration occurs, with autoplay fallback retry
   */
  _playAudio() {
    if (!this.audio) return;
    if (!this.audioPlayed || (this.audio.paused && !this.audio.ended)) {
      this.audioPlayed = true;
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.audioUnlocked = true;
        }).catch((err) => {
          console.warn('[BirthdayFX] Audio playback prevented by browser autoplay policy:', err);

          // Retry playback immediately on the next user interaction
          const retryOnInteraction = () => {
            if (this.audio && (this.state === BirthdayState.CELEBRATION || this.state === BirthdayState.TRANSITION)) {
              this.audio.play().then(() => {
                this.audioUnlocked = true;
              }).catch(() => { });
            }
            window.removeEventListener('pointerdown', retryOnInteraction);
            window.removeEventListener('touchstart', retryOnInteraction);
            window.removeEventListener('click', retryOnInteraction);
          };

          window.addEventListener('pointerdown', retryOnInteraction, { once: true, passive: true });
          window.addEventListener('touchstart', retryOnInteraction, { once: true, passive: true });
          window.addEventListener('click', retryOnInteraction, { once: true, passive: true });
        });
      }
    }
  }

  /**
   * Pauses music playback (e.g. when markers are lost)
   */
  _pauseAudio() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  /**
   * Stops music playback and resets track position
   */
  _stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audioPlayed = false;
    }
  }

  // ─── State Machine ───────────────────────────────────────────────────

  _setState(newState) {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    if (newState === BirthdayState.CELEBRATION) {
      this.celebrationTime = 0;
    }
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
    this.confettiMat.opacity = 0;
    this.celebrationLight.intensity = 0;
    this.transitionElapsed = 0;
    this.celebrationFadeTimer = 0;
    this._stopAudio();

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
      if (!this.lastMidpoint) {
        this.lastMidpoint = new this.THREE.Vector3();
      }
      this.lastMidpoint.copy(pos1).add(pos2).multiplyScalar(0.5);
    }

    const mid = this.lastMidpoint;
    if (mid) {
      this.textGroup.position.copy(mid);
      this.textGroup.position.y += 0.85;
      this.textGroup.rotation.y = 0;
      this.celebrationLight.position.copy(mid);
      this.celebrationLight.position.y += 0.85;
    }

    this.group.visible = true;

    // Phase 1: Implosion / Overload (0 - 0.3)
    if (progress < 0.3) {
      const implosionP = progress / 0.3;
      return Math.max(0, 1.8 - implosionP * 1.8);
    }

    // Phase 2: Intense Pure White Flash Burst & Particle Ejection (0.3 - 0.5)
    if (progress < 0.5) {
      const flashP = (progress - 0.3) / 0.2;

      this.celebrationLight.color.setHex(0xffffff);
      this.celebrationLight.intensity = (1.0 - flashP) * 16.0;
      this.confettiMat.opacity = flashP * 0.85;

      if (mid) {
        this._updateConfettiPhysics(pos1, pos2, deltaSec);
      }

      return 0; // Lightning dims during explosion
    }

    // Phase 3: Supernova / Spring-bounce Text Reveal + Confetti Drift (0.5 - 1.0)
    const supernovaP = (progress - 0.5) / 0.5;

    this.celebrationLight.color.setHex(0xF4E0AE);

    if (this._textReady) {
      this.textGroup.visible = true;
      const springT = this._springEase(supernovaP);
      const textScale = springT * 0.85;
      this.textGroup.scale.set(textScale, textScale, textScale);
      this._playAudio();
    }

    this.confettiMat.opacity = Math.min(0.85, supernovaP * 1.2);
    if (mid) {
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
    this.celebrationTime += deltaSec;

    // Cache latest midpoint while markers are actively tracked
    if (pos1 && pos2) {
      if (!this.lastMidpoint) {
        this.lastMidpoint = new this.THREE.Vector3();
      }
      this.lastMidpoint.copy(pos1).add(pos2).multiplyScalar(0.5);
    }

    const mid = this.lastMidpoint;

    // If no midpoint was ever recorded, do not display
    if (!mid) {
      this.group.visible = false;
      this.textGroup.visible = false;
      return 0;
    }

    // Keep celebration state and 3D text persistent at last known position even when marker tracking is lost
    this.group.visible = true;

    this.textGroup.position.copy(mid);
    this.celebrationLight.position.copy(mid);

    if (this._textReady) {
      this.textGroup.visible = true;
      this._playAudio();
      const baseScale = 0.85;
      this.textGroup.scale.set(baseScale, baseScale, baseScale);
      this.textGroup.rotation.y = 0;

      const baseHeightOffset = 0.85;
      const bobbingY = Math.sin(this.celebrationTime * 3.0) * 0.09;
      this.textGroup.position.y += baseHeightOffset + bobbingY;

      const baseEmissive = 2.4;
      const emPulse = (1.0 + Math.sin(this.celebrationTime * 3.0) * 0.3) * baseEmissive;
      for (const mesh of this._textMeshes) {
        if (mesh.material) {
          if (mesh.material.emissiveIntensity !== undefined) {
            mesh.material.emissiveIntensity = emPulse;
          } else {
            mesh.material.opacity = 1.0;
          }
        }
      }
    }

    this.confettiMat.opacity = 0.85;
    this._updateConfettiPhysics(pos1, pos2, deltaSec);

    const lightPulse = 5.5 + Math.sin(this.celebrationTime * 4.0) * 1.5;
    this.celebrationLight.intensity = lightPulse;

    return 0;
  }

  // ─── Confetti Physics ────────────────────────────────────────────────

  _spawnConfettiAtMidpoint(pos1, pos2) {
    const mid = (pos1 && pos2) ? pos1.clone().add(pos2).multiplyScalar(0.5) : (this.lastMidpoint || new this.THREE.Vector3());
    const count = this.options.confettiCount;
    const positions = this.confettiPositions;

    for (let i = 0; i < count; i++) {
      // Uniform random direction vector on unit sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.sin(phi) * Math.sin(theta);
      const dirZ = Math.cos(phi);

      // Distribute initial particles outward on a 0.05m ~ 0.20m shell around midpoint
      const initialRadius = 0.05 + Math.random() * 0.15;
      positions[i * 3] = mid.x + dirX * initialRadius;
      positions[i * 3 + 1] = mid.y + dirY * initialRadius;
      positions[i * 3 + 2] = mid.z + dirZ * initialRadius;

      // High explosive outward velocity burst
      const speed = 0.04 + Math.random() * 0.05;
      this.confettiVelocities[i].set(
        dirX * speed,
        dirY * speed + 0.02, // Upward bias for arc distribution
        dirZ * speed
      );

      this.confettiPhases[i] = Math.random() * Math.PI * 2;
    }

    this.confettiGeo.attributes.position.needsUpdate = true;
  }

  _updateConfettiPhysics(pos1, pos2, deltaSec) {
    const THREE = this.THREE;
    const mid = (pos1 && pos2) ? pos1.clone().add(pos2).multiplyScalar(0.5) : (this.lastMidpoint || new THREE.Vector3(0, 0, 0));
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

      vel.x *= 0.992;
      vel.y *= 0.994;
      vel.z *= 0.992;

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

    this.confettiMat.size = 0.065 + Math.sin(now * 0.003) * 0.015;
    this.confettiGeo.attributes.position.needsUpdate = true;
  }

  reset() {
    this.chargeAccumulated = 0;
    this.transitionElapsed = 0;
    this.celebrationFadeTimer = 0;
    this.celebrationTime = 0;
    this.lastMidpoint = null;
    this.group.visible = false;
    this.textGroup.visible = false;
    this.confettiMat.opacity = 0;
    this.celebrationLight.intensity = 0;
    this._stopAudio();
    this._setState(BirthdayState.STANDBY);
  }

  dispose() {
    super.dispose();
    this._stopAudio();
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      window.removeEventListener('pagehide', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }
    if (this.audio) {
      this.audio.src = '';
      this.audio = null;
    }
    this.confettiGeo?.dispose();
    this.confettiMat?.dispose();
    this.confettiTexture?.dispose();
    for (const mesh of this._textMeshes) {
      mesh?.geometry?.dispose();
      mesh?.material?.dispose();
    }
  }
}
