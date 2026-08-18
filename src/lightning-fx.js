/**
 * LightningFX - Sleek High-Voltage Procedural Lightning & Particle Burst System
 * Generates crisp electric arcs, smooth glowing circular spark explosions,
 * and dynamic energy core calibrated for WebAR dual-marker interaction.
 */

export class LightningFX {
  /**
   * @param {THREE.Scene} scene - The Three.js / A-Frame scene
   * @param {Object} options - Configuration parameters
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.THREE = window.THREE || AFRAME.THREE;

    this.options = Object.assign(
      {
        maxBolts: 5,               // 1 main crisp bolt + 4 energetic branch forks
        segmentsPerBolt: 32,       // High subdivision for sharp zigzag arcs
        maxSparks: 140,            // Rich particle count for explosive bursts
        primaryColor: 0x00f0ff,    // Electric Neon Cyan
        secondaryColor: 0x38bdf8,  // Sky Blue Plasma
        coreColor: 0xffffff,       // White-hot core
        maxDistance: 4.5,          // Max detection distance (m)
        minDistance: 1.5           // Peak proximity distance (m)
      },
      options
    );

    // Root Three.js Object3D container for all visual FX
    this.group = new this.THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

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
    this._initTerminalGlows();
    this._initExplosiveSparks();
    this._initDynamicLight();

    // Enable Layer 1 on all visual FX meshes & particles for Selective Bloom Post-Processing
    this._enableBloomLayer();
  }

  /**
   * Traverse all child objects and enable Layer 1 for selective bloom rendering.
   */
  _enableBloomLayer() {
    this.group.traverse((obj) => {
      if (obj.isMesh || obj.isPoints || obj.isLight) {
        obj.layers.enable(1);
      }
    });
  }

  /**
   * Create a soft circular radial glow texture in-memory via 2D Canvas.
   * Eliminates square pixel block artifacts and creates smooth glowing sparks.
   */
  _createSoftGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.45, 'rgba(0, 240, 255, 0.8)');
    gradient.addColorStop(0.75, 'rgba(56, 189, 248, 0.25)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new this.THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Initialize crisp ribbon quads for electric lightning arcs.
   * Balanced width for sharp, razor-thin yet luminous appearance.
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
   * Initialize subtle terminal beacons at the two marker anchor points.
   */
  _initTerminalGlows() {
    const THREE = this.THREE;

    const createTerminalBeacon = (color) => {
      const g = new THREE.Group();
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.008, 6, 18),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      g.add(orb);
      g.add(ring);
      return { group: g, orb, ring };
    };

    this.terminalA = createTerminalBeacon(0xf43f5e); // Hiro Rose
    this.terminalB = createTerminalBeacon(0x0ea5e9); // Kanji Cyan

    this.group.add(this.terminalA.group);
    this.group.add(this.terminalB.group);
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

    // 2. Outer cyan wireframe shield
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

    // 3. Delicate orbital gyro rings
    this.rings = [];
    const ringGeos = [
      new THREE.TorusGeometry(0.18, 0.006, 6, 24),
      new THREE.TorusGeometry(0.22, 0.005, 6, 24)
    ];

    ringGeos.forEach((geo, i) => {
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? this.options.primaryColor : 0x38bdf8,
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
   * Initialize large-radius explosive particle system with smooth circular texture.
   */
  _initExplosiveSparks() {
    const THREE = this.THREE;
    const { maxSparks } = this.options;

    this.sparkPositions = new Float32Array(maxSparks * 3);
    this.sparkColors = new Float32Array(maxSparks * 3);
    this.sparkVelocities = [];
    this.sparkLifes = [];

    const colWhite = new THREE.Color(0xffffff);
    const colCyan = new THREE.Color(0x00f0ff);
    const colSky = new THREE.Color(0x38bdf8);

    for (let i = 0; i < maxSparks; i++) {
      this.sparkPositions[i * 3] = 0;
      this.sparkPositions[i * 3 + 1] = 0;
      this.sparkPositions[i * 3 + 2] = 0;

      // Random vibrant cyan/white colors
      const randColor = Math.random() > 0.4 ? colWhite : (Math.random() > 0.5 ? colCyan : colSky);
      this.sparkColors[i * 3] = randColor.r;
      this.sparkColors[i * 3 + 1] = randColor.g;
      this.sparkColors[i * 3 + 2] = randColor.b;

      // Radial explosive velocities
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

    // Particle material with custom smooth circular soft-glow texture
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
   * Dynamic point light to illuminate surrounding 3D models.
   */
  _initDynamicLight() {
    const THREE = this.THREE;
    this.pointLight = new THREE.PointLight(this.options.primaryColor, 0, 4);
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
   * Update visual effects on every animation frame tick.
   */
  update(startPos, endPos, delta = 16) {
    const THREE = this.THREE;

    if (!startPos || !endPos) {
      this.smoothedProximity = THREE.MathUtils.lerp(this.smoothedProximity, 0, 0.18);
      if (this.smoothedProximity < 0.01) {
        this.group.visible = false;
        this.currentDistance = 999;
        this.proximity = 0;
      } else {
        this._applyProximityEffects(this.smoothedProximity);
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

    if (this.smoothedProximity <= 0.01) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    // Terminals
    this.terminalA.group.position.copy(startPos);
    this.terminalB.group.position.copy(endPos);

    // Midpoint
    const midPoint = startPos.clone().add(endPos).multiplyScalar(0.5);
    this.coreGroup.position.copy(midPoint);
    this.pointLight.position.copy(midPoint);

    this._applyProximityEffects(this.smoothedProximity, startPos, endPos, midPoint, delta);
  }

  /**
   * Apply dynamic scaling, sharp lightning mesh generation, and particle bursts.
   */
  _applyProximityEffects(p, startPos, endPos, midPoint, delta) {
    const THREE = this.THREE;
    const now = performance.now();

    // 1. Sleek Plasma Core Scale
    const scaleFactor = 0.3 + Math.pow(p, 1.4) * 1.8;
    this.coreGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Core pulsing & spin
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

    // Terminal beacons
    const termScale = 0.5 + p * 0.8;
    this.terminalA.group.scale.set(termScale, termScale, termScale);
    this.terminalB.group.scale.set(termScale, termScale, termScale);
    this.terminalA.ring.rotation.z += 0.04;
    this.terminalB.ring.rotation.z -= 0.04;

    // 2. Light intensity
    this.pointLight.intensity = Math.pow(p, 1.3) * 5.0;
    this.pointLight.distance = 3.0 + p * 2.5;

    // 3. Crisp Lightning Mesh
    if (startPos && endPos && now - this.lastBoltUpdateTime > (this.boltUpdateInterval / (1 + p * 1.5))) {
      this.lastBoltUpdateTime = now;
      this._updateSleekBolts(startPos, endPos, p, midPoint);
    }

    // 4. Large-Radius Particle Sparks Explosion
    if (midPoint && startPos && endPos) {
      this._updateExplosionSparks(midPoint, startPos, endPos, p, delta);
    }
  }

  /**
   * Rebuild crisp, sleek lightning ribbon quads.
   */
  _updateSleekBolts(startPos, endPos, p, midPoint) {
    const THREE = this.THREE;
    const { maxBolts, segmentsPerBolt } = this.options;
    const positions = this.boltPositions;
    const colors = this.boltColors;
    const uvs = this.boltUvs;

    let vertexIndex = 0;

    // Active bolts scale from 1 (at distance) to maxBolts (5) at close proximity
    const activeBolts = Math.min(maxBolts, Math.max(1, Math.ceil(p * maxBolts)));

    // Refined sleek ribbon width: 0.012 (crisp) to 0.048 (intense discharge)
    const baseWidth = 0.012 + Math.pow(p, 1.2) * 0.036;
    const baseJitter = 0.08 + Math.pow(p, 1.1) * 0.28;

    const colWhite = new THREE.Color(0xffffff);
    const colCyan = new THREE.Color(0x00f0ff);
    const colSky = new THREE.Color(0x38bdf8);

    const mainDir = endPos.clone().sub(startPos).normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    const sideVector = new THREE.Vector3().crossVectors(mainDir, upVector).normalize();

    for (let b = 0; b < activeBolts; b++) {
      let bStart = startPos.clone();
      let bEnd = endPos.clone();
      let jitter = baseJitter;
      let boltWidth = baseWidth;

      if (b === 0) {
        // Main Core Bolt: Crisp & Brightest
        boltWidth *= 1.2;
      } else {
        // Branch bolts fork outwards
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

        // Core white-hot, branches electric cyan/sky blue
        let segColor = colCyan;
        if (b === 0) {
          segColor = (Math.random() > 0.25) ? colWhite : colCyan;
        } else {
          segColor = (Math.random() > 0.4) ? colCyan : colSky;
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

  /**
   * Update particle explosion physics scaling dynamically with distance proximity.
   * Far distance: tight subtle micro-sparks (0.1m).
   * Close distance: massive energetic particle burst expanding up to 1.8m.
   */
  _updateExplosionSparks(midPoint, startPos, endPos, p, delta) {
    const { maxSparks } = this.options;
    const positions = this.sparkPositions;
    
    // Active spark count scales smoothly from 12 (far) to maxSparks (closest)
    const activeSparks = Math.max(12, Math.floor(Math.pow(p, 1.2) * maxSparks));

    // Dynamic explosion spread radius: 0.12m (tight sizzle) -> 1.8m (wide blast)
    const explosionRadius = 0.12 + Math.pow(p, 1.8) * 1.68;
    const speedMultiplier = 0.4 + Math.pow(p, 2.0) * 3.6;

    for (let i = 0; i < maxSparks; i++) {
      if (i < activeSparks) {
        const vel = this.sparkVelocities[i];

        // Move spark along explosive velocity vector
        positions[i * 3] += vel.x * speedMultiplier;
        positions[i * 3 + 1] += vel.y * speedMultiplier;
        positions[i * 3 + 2] += vel.z * speedMultiplier;

        // Swirling vortex force increasing with closeness
        positions[i * 3] += -vel.z * 0.15 * p;
        positions[i * 3 + 2] += vel.x * 0.15 * p;

        // Distance from center
        const dx = positions[i * 3] - midPoint.x;
        const dy = positions[i * 3 + 1] - midPoint.y;
        const dz = positions[i * 3 + 2] - midPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        // Re-spawn particle when exceeding dynamic radius threshold
        if (distSq > explosionRadius * explosionRadius || Math.random() < 0.05) {
          // Spawn origins: mostly midpoint, with terminal sparks
          let origin = midPoint;
          const r = Math.random();
          if (r < 0.18) origin = startPos;
          else if (r < 0.36) origin = endPos;

          positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.05;

          // Radial explosion vector with variable speed
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

    // Balanced glowing electric spark size (clearly visible, crisp sparks)
    this.sparkMaterial.size = 0.065 + Math.pow(p, 1.2) * 0.075;
  }

  /**
   * Dispose all Three.js resources and textures.
   */
  dispose() {
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    if (this.boltGeometry) this.boltGeometry.dispose();
    if (this.boltMaterial) this.boltMaterial.dispose();
    if (this.sparkGeometry) this.sparkGeometry.dispose();
    if (this.sparkMaterial) this.sparkMaterial.dispose();
    if (this.sparkTexture) this.sparkTexture.dispose();
  }
}
