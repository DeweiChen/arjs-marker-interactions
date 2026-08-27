/**
 * LightningFX - High-Voltage Procedural Lightning & Particle Explosion Strategy
 * Generates crisp electric arcs, smooth glowing spark particle explosions,
 * and dynamic plasma core calibrated for WebAR dual-marker proximity interaction.
 */

import { BaseFX } from './base-fx.js';

export class LightningFX extends BaseFX {
  /**
   * @param {THREE.Scene} scene - The Three.js / A-Frame scene
   * @param {Object} options - Configuration parameters
   */
  constructor(scene, options = {}) {
    super(scene, options);

    this.options = Object.assign(
      {
        maxBolts: 5,               // 1 main crisp bolt + 4 energetic branch forks
        segmentsPerBolt: 32,       // High subdivision for sharp zigzag arcs
        maxSparks: 140,            // Rich particle count for explosive bursts
        primaryColor: 0x38bdf8,    // Electric Sky Blue
        secondaryColor: 0xa855f7,  // Ultraviolet Purple
        coreColor: 0xede9fe,       // Lavender-White Core
        maxDistance: 4.5,          // Max detection distance (m)
        minDistance: 1.5           // Peak proximity distance (m)
      },
      options
    );

    // Proximity state
    this.proximity = 0; // 0 (standby) to 1 (maximum overload)
    this.smoothedProximity = 0;
    this.currentDistance = 999;
    this.lastBoltUpdateTime = 0;
    this.boltUpdateInterval = 25; // High-frequency 40Hz jitter

    // Create glowing circular soft particle texture
    this.sparkTexture = this._createSoftGlowTexture();

    this._initSleekLightning();
    this._initPlasmaCore();
    this._initExplosiveSparks();
    this._initDynamicLight();

    // Enable Layer 1 on all visual FX meshes & particles for Selective Bloom
    this.enableBloomLayer();
  }

  /**
   * Create a soft circular radial glow texture in-memory via 2D Canvas.
   */
  _createSoftGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(245, 243, 255, 1.0)');     // Lavender-White Core
    gradient.addColorStop(0.2, 'rgba(237, 233, 254, 0.95)');  // Soft Lavender-White
    gradient.addColorStop(0.45, 'rgba(56, 189, 248, 0.85)');  // Electric Sky Blue
    gradient.addColorStop(0.75, 'rgba(168, 85, 247, 0.35)');  // Ultraviolet Purple
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new this.THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Initialize crisp ribbon quads for electric lightning arcs.
   */
  _initSleekLightning() {
    const THREE = this.THREE;
    const { maxBolts, segmentsPerBolt } = this.options;

    const maxQuads = maxBolts * segmentsPerBolt;
    this.maxVertices = maxQuads * 6;

    this.boltPositions = new Float32Array(this.maxVertices * 3);
    this.boltColors = new Float32Array(this.maxVertices * 3);
    this.boltUvs = new Float32Array(this.maxVertices * 2);

    this.boltGeometry = new THREE.BufferGeometry();
    this.boltGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.boltPositions, 3)
    );
    this.boltGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.boltColors, 3)
    );
    this.boltGeometry.setAttribute(
      'uv',
      new THREE.BufferAttribute(this.boltUvs, 2)
    );

    this.boltMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.boltMesh = new THREE.Mesh(this.boltGeometry, this.boltMaterial);
    this.group.add(this.boltMesh);
  }

  /**
   * Initialize sleek midpoint energy core.
   */
  _initPlasmaCore() {
    const THREE = this.THREE;
    this.coreGroup = new THREE.Group();

    // 1. Inner white-hot glowing crystal
    const innerGeo = new THREE.OctahedronGeometry(0.08, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: this.options.coreColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.innerCoreMesh = new THREE.Mesh(innerGeo, innerMat);
    this.coreGroup.add(this.innerCoreMesh);

    // 2. Outer blue wireframe shield
    const outerGeo = new THREE.IcosahedronGeometry(0.13, 1);
    const outerMat = new THREE.MeshBasicMaterial({
      color: this.options.primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.outerCoreMesh = new THREE.Mesh(outerGeo, outerMat);
    this.coreGroup.add(this.outerCoreMesh);

    // 3. Delicate orbital gyro rings in blue and purple
    this.rings = [];
    const ringGeos = [
      new THREE.TorusGeometry(0.18, 0.006, 6, 24),
      new THREE.TorusGeometry(0.22, 0.005, 6, 24)
    ];

    ringGeos.forEach((geo, i) => {
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? this.options.primaryColor : this.options.secondaryColor,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(geo, ringMat);
      ring.rotation.x = Math.PI / (i + 2);
      ring.rotation.y = Math.PI / (i + 3);
      this.rings.push(ring);
      this.coreGroup.add(ring);
    });

    this.group.add(this.coreGroup);
  }

  /**
   * Initialize explosive particle system.
   */
  _initExplosiveSparks() {
    const THREE = this.THREE;
    const { maxSparks } = this.options;

    this.sparkPositions = new Float32Array(maxSparks * 3);
    this.sparkColors = new Float32Array(maxSparks * 3);
    this.sparkVelocities = [];
    this.sparkLifes = [];

    const colLavenderWhite = new THREE.Color(0xf5f3ff);
    const colSky = new THREE.Color(0x38bdf8);
    const colBlue = new THREE.Color(0x3b82f6);
    const colPurple = new THREE.Color(0xa855f7);
    const colViolet = new THREE.Color(0xc084fc);

    for (let i = 0; i < maxSparks; i++) {
      this.sparkPositions[i * 3] = 0;
      this.sparkPositions[i * 3 + 1] = 0;
      this.sparkPositions[i * 3 + 2] = 0;

      const r = Math.random();
      const randColor = r > 0.65 ? colLavenderWhite : (r > 0.4 ? colSky : (r > 0.2 ? colPurple : colViolet));
      this.sparkColors[i * 3] = randColor.r;
      this.sparkColors[i * 3 + 1] = randColor.g;
      this.sparkColors[i * 3 + 2] = randColor.b;

      this.sparkVelocities.push(new THREE.Vector3());
      this.sparkLifes.push(Math.random());
    }

    this.sparkGeometry = new THREE.BufferGeometry();
    this.sparkGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.sparkPositions, 3)
    );
    this.sparkGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.sparkColors, 3)
    );

    this.sparkMaterial = new THREE.PointsMaterial({
      map: this.sparkTexture,
      vertexColors: true,
      size: 0.16,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sparkPoints = new THREE.Points(this.sparkGeometry, this.sparkMaterial);
    this.group.add(this.sparkPoints);
  }

  /**
   * Dynamic point light to illuminate surrounding 3D models with glow.
   */
  _initDynamicLight() {
    const THREE = this.THREE;
    this.pointLight = new THREE.PointLight(0x818cf8, 0, 4);
    this.group.add(this.pointLight);
  }

  /**
   * Procedural recursive midpoint displacement for realistic jagged electric paths.
   */
  _generateBoltPath(start, end, jitterMagnitude, segments) {
    const points = [start.clone(), end.clone()];
    let iterations = Math.round(Math.log2(segments));

    for (let it = 0; it < iterations; it++) {
      const newPoints = [];
      const currentJitter = jitterMagnitude / Math.pow(1.3, it);

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const mid = p1.clone().add(p2).multiplyScalar(0.5);

        const dir = p2.clone().sub(p1).normalize();
        const randVec = new this.THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ).normalize();

        const normal = new this.THREE.Vector3().crossVectors(dir, randVec).normalize();
        const offset = normal.multiplyScalar((Math.random() - 0.5) * 2 * currentJitter);
        mid.add(offset);

        newPoints.push(p1);
        newPoints.push(mid);
      }
      newPoints.push(points[points.length - 1]);
      points.length = 0;
      points.push(...newPoints);
    }

    return points;
  }

  /**
   * Update visual effects on every frame.
   *
   * @param {THREE.Vector3|null} startPos
   * @param {THREE.Vector3|null} endPos
   * @param {number} delta
   * @param {number} intensityMultiplier - Scale factor from BirthdayFX (0 to 1.6x)
   * @param {number} chargeProgress - Charging progress (0.0 to 1.0)
   */
  update(startPos, endPos, delta = 16, intensityMultiplier = 1.0, chargeProgress = 0) {
    const THREE = this.THREE;

    if (!startPos || !endPos || intensityMultiplier <= 0) {
      this.smoothedProximity = THREE.MathUtils.lerp(this.smoothedProximity, 0, 0.18);
      if (this.smoothedProximity < 0.01 || intensityMultiplier <= 0) {
        this.group.visible = false;
        this.currentDistance = 999;
        this.proximity = 0;
      } else {
        this._applyProximityEffects(this.smoothedProximity * intensityMultiplier, null, null, null, delta, chargeProgress);
      }
      return;
    }

    const distance = startPos.distanceTo(endPos);
    this.currentDistance = distance;

    const { maxDistance, minDistance } = this.options;

    if (distance > maxDistance) {
      this.proximity = 0;
    } else {
      const rawProximity = (maxDistance - distance) / (maxDistance - minDistance);
      this.proximity = THREE.MathUtils.clamp(rawProximity, 0, 1);
    }

    this.smoothedProximity = THREE.MathUtils.lerp(this.smoothedProximity, this.proximity, 0.25);

    const effectiveProximity = THREE.MathUtils.clamp(this.smoothedProximity * intensityMultiplier, 0, 1.5);

    if (effectiveProximity <= 0.01) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    const midPoint = startPos.clone().add(endPos).multiplyScalar(0.5);
    this.coreGroup.position.copy(midPoint);
    this.pointLight.position.copy(midPoint);

    this._applyProximityEffects(effectiveProximity, startPos, endPos, midPoint, delta, chargeProgress);
  }

  _applyProximityEffects(p, startPos, endPos, midPoint, delta, chargeProgress = 0) {
    const THREE = this.THREE;
    const now = performance.now();

    const scaleFactor = 0.3 + Math.pow(p, 1.4) * 1.8;
    this.coreGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

    const pulse = 1 + Math.sin(now * 0.018 * (1 + p * 3)) * (0.15 + 0.25 * p);
    this.innerCoreMesh.scale.set(pulse, pulse, pulse);
    this.innerCoreMesh.rotation.y += 0.04;
    this.innerCoreMesh.rotation.x += 0.03;

    const rotSpeed = 0.02 + p * 0.09;
    this.rings.forEach((ring, i) => {
      ring.rotation.x += (i % 2 === 0 ? 1 : -1) * rotSpeed;
      ring.rotation.y += rotSpeed * 1.2;
      ring.rotation.z += rotSpeed * 0.8;
    });

    this.pointLight.intensity = Math.pow(p, 1.3) * 5.0;
    this.pointLight.distance = 3.0 + p * 2.5;

    if (startPos && endPos && now - this.lastBoltUpdateTime > (this.boltUpdateInterval / (1 + p * 1.5))) {
      this.lastBoltUpdateTime = now;
      this._updateSleekBolts(startPos, endPos, p, midPoint, chargeProgress);
    }

    if (midPoint && startPos && endPos) {
      this._updateExplosionSparks(midPoint, startPos, endPos, p, delta);
    }
  }

  _updateSleekBolts(startPos, endPos, p, midPoint, chargeProgress = 0) {
    const THREE = this.THREE;
    const { maxBolts, segmentsPerBolt } = this.options;
    const positions = this.boltPositions;
    const colors = this.boltColors;
    const uvs = this.boltUvs;

    let vertexIndex = 0;
    const activeBolts = Math.min(maxBolts, Math.max(1, Math.ceil(p * maxBolts)));

    const baseWidth = 0.012 + Math.pow(p, 1.2) * 0.036;
    const baseJitter = 0.08 + Math.pow(p, 1.1) * 0.28;

    const colLavenderWhite = new THREE.Color(0xf5f3ff);
    const colSky = new THREE.Color(0x38bdf8);
    const colBlue = new THREE.Color(0x3b82f6);
    const colPurple = new THREE.Color(0xa855f7);
    const colViolet = new THREE.Color(0xc084fc);

    if (chargeProgress > 0) {
      const chargeT = THREE.MathUtils.clamp(chargeProgress, 0, 1);
      const colGold = new THREE.Color(0xfbbf24);
      const colPureWhite = new THREE.Color(0xffffff);

      colSky.lerp(colGold, Math.min(1, chargeT * 1.2));
      colBlue.lerp(colGold, chargeT);
      colLavenderWhite.lerp(colPureWhite, chargeT);

      if (chargeT > 0.7) {
        const whiteT = (chargeT - 0.7) / 0.3;
        colSky.lerp(colPureWhite, whiteT);
        colPurple.lerp(colPureWhite, whiteT);
        colViolet.lerp(colPureWhite, whiteT);
      }
    }

    const mainDir = endPos.clone().sub(startPos).normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    const sideVector = new THREE.Vector3().crossVectors(mainDir, upVector).normalize();

    for (let b = 0; b < activeBolts; b++) {
      let bStart = startPos.clone();
      let bEnd = endPos.clone();
      let jitter = baseJitter;
      let boltWidth = baseWidth;

      if (b === 0) {
        boltWidth *= 1.2;
      } else {
        boltWidth *= 0.7;
        jitter *= 0.85;
        if (b % 2 === 1) {
          bEnd = midPoint.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.6 * p,
              (Math.random() - 0.5) * 0.6 * p,
              (Math.random() - 0.5) * 0.6 * p
            )
          );
        } else {
          bStart = midPoint.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.6 * p,
              (Math.random() - 0.5) * 0.6 * p,
              (Math.random() - 0.5) * 0.6 * p
            )
          );
        }
      }

      const points = this._generateBoltPath(bStart, bEnd, jitter, segmentsPerBolt);

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        const segDir = p2.clone().sub(p1).normalize();
        const norm = new THREE.Vector3().crossVectors(segDir, sideVector).normalize();
        if (norm.lengthSq() < 0.001) norm.set(0, 1, 0);

        const halfW = boltWidth * 0.5 * (0.8 + Math.random() * 0.4);

        const v1 = p1.clone().addScaledVector(norm, halfW);
        const v2 = p1.clone().addScaledVector(norm, -halfW);
        const v3 = p2.clone().addScaledVector(norm, halfW);
        const v4 = p2.clone().addScaledVector(norm, -halfW);

        let segColor;
        if (b === 0) {
          const r = Math.random();
          segColor = r > 0.4 ? colLavenderWhite : (r > 0.18 ? colSky : colViolet);
        } else if (b % 2 === 1) {
          segColor = (Math.random() > 0.35) ? colPurple : colViolet;
        } else {
          segColor = (Math.random() > 0.35) ? colSky : colBlue;
        }

        const quadVerts = [v1, v2, v3, v2, v4, v3];

        for (let q = 0; q < 6; q++) {
          const v = quadVerts[q];
          positions[vertexIndex * 3] = v.x;
          positions[vertexIndex * 3 + 1] = v.y;
          positions[vertexIndex * 3 + 2] = v.z;

          colors[vertexIndex * 3] = segColor.r;
          colors[vertexIndex * 3 + 1] = segColor.g;
          colors[vertexIndex * 3 + 2] = segColor.b;

          uvs[vertexIndex * 2] = q % 2;
          uvs[vertexIndex * 2 + 1] = (i / points.length);

          vertexIndex++;
        }
      }
    }

    this.boltGeometry.setDrawRange(0, vertexIndex);
    this.boltGeometry.attributes.position.needsUpdate = true;
    this.boltGeometry.attributes.color.needsUpdate = true;
    this.boltGeometry.attributes.uv.needsUpdate = true;
  }

  _updateExplosionSparks(midPoint, startPos, endPos, p, delta) {
    const { maxSparks } = this.options;
    const positions = this.sparkPositions;
    const activeSparks = Math.max(12, Math.floor(Math.pow(p, 1.2) * maxSparks));

    const explosionRadius = 0.12 + Math.pow(p, 1.8) * 1.68;
    const speedMultiplier = 0.4 + Math.pow(p, 2.0) * 3.6;

    for (let i = 0; i < maxSparks; i++) {
      if (i < activeSparks) {
        const vel = this.sparkVelocities[i];

        positions[i * 3] += vel.x * speedMultiplier;
        positions[i * 3 + 1] += vel.y * speedMultiplier;
        positions[i * 3 + 2] += vel.z * speedMultiplier;

        positions[i * 3] += -vel.z * 0.15 * p;
        positions[i * 3 + 2] += vel.x * 0.15 * p;

        const dx = positions[i * 3] - midPoint.x;
        const dy = positions[i * 3 + 1] - midPoint.y;
        const dz = positions[i * 3 + 2] - midPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > explosionRadius * explosionRadius || Math.random() < 0.05) {
          let origin = midPoint;
          const r = Math.random();
          if (r < 0.18) origin = startPos;
          else if (r < 0.36) origin = endPos;

          positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.05;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);
          const speed = (0.015 + Math.random() * 0.04) * (0.5 + p * 1.5);

          vel.set(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed
          );
        }
      } else {
        positions[i * 3] = 9999;
        positions[i * 3 + 1] = 9999;
        positions[i * 3 + 2] = 9999;
      }
    }

    this.sparkGeometry.setDrawRange(0, activeSparks);
    this.sparkGeometry.attributes.position.needsUpdate = true;
    this.sparkMaterial.size = 0.065 + Math.pow(p, 1.2) * 0.075;
  }

  dispose() {
    super.dispose();
    if (this.boltGeometry) this.boltGeometry.dispose();
    if (this.boltMaterial) this.boltMaterial.dispose();
    if (this.sparkGeometry) this.sparkGeometry.dispose();
    if (this.sparkMaterial) this.sparkMaterial.dispose();
    if (this.sparkTexture) this.sparkTexture.dispose();
  }
}
