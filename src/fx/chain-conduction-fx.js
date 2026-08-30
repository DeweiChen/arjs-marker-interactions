/**
 * ChainConductionFX - Multi-Marker Chain Conduction & High-Voltage Arc System
 * Generates crisp electric sky-blue / ultraviolet arcs, sleek expanding plasma cores,
 * delicate 3D spark bursts, directional plasma streams, and node relay crystals across AR markers (0 to 7).
 * Carefully calibrated to avoid blinding white/yellow over-saturation, keeping colors rich and cyber-electric.
 */

import { BaseFX } from './base-fx.js';

// Predefined marker color definitions matching 3D text styling
export const MARKER_COLORS = {
  0: { name: 'DW', primary: 0x1d4ed8, secondary: 0x38bdf8, emissive: 0x0077ff, core: 0xdbeafe }, // Deep Blue
  1: { name: 'Fu', primary: 0x00cba9, secondary: 0x5eead4, emissive: 0x00cba9, core: 0xccfbf1 }, // Morandi Teal
  2: { name: '2',  primary: 0xdc2626, secondary: 0xf87171, emissive: 0xff1a1a, core: 0xfee2e2 }, // Flame Red
  3: { name: '3',  primary: 0xea580c, secondary: 0xfb923c, emissive: 0xff7a00, core: 0xffedd5 }, // Sunset Orange
  4: { name: '4',  primary: 0xca8a04, secondary: 0xfacc15, emissive: 0xffe600, core: 0xfef9c3 }, // Electric Yellow
  5: { name: '5',  primary: 0x16a34a, secondary: 0x4ade80, emissive: 0x22c55e, core: 0xdcfce7 }, // Herb Lime Green
  6: { name: '6',  primary: 0x7c3aed, secondary: 0xa855f7, emissive: 0xa855f7, core: 0xf3e8ff }, // Cyber Violet
  7: { name: '7',  primary: 0xe2e8f0, secondary: 0x94a3b8, emissive: 0xffffff, core: 0xffffff }  // Pure White
};

export class ChainConductionFX extends BaseFX {
  /**
   * @param {THREE.Scene} scene - Three.js scene object
   * @param {Object} options - Configuration options
   */
  constructor(scene, options = {}) {
    super(scene, options);

    this.options = Object.assign(
      {
        maxSegments: 7,            // Up to 7 segments for 8 markers
        maxBoltsPerSeg: 7,         // 1 main crisp bolt + 6 energetic branch forks
        segmentsPerBolt: 32,       // High subdivision for sharp zigzag arcs
        maxExplosionSparks: 180,   // Balanced particle count for clean explosion visuals
        streamSparksPerSeg: 24,    // Subtle flowing spark count per segment
        primaryColor: 0x0ea5e9,    // Vivid Sky Blue (Saturated & cybernetic)
        secondaryColor: 0x9333ea,  // Deep Ultraviolet Purple
        coreColor: 0x38bdf8,       // Electric Cyan Core (Not pure white)
        closePrimaryColor: 0xff0000, // Target color when close: Pure 100% Red (#FF0000)
        closeSecondaryColor: 0xcc0000, // Deep Crimson Red (#CC0000)
        closeCoreColor: 0xff3333,    // Pure Laser Red (#FF3333)
        dynamicColorShift: true,   // Proximity color transition towards red
        maxDistance: 4.5,          // Max detection distance per hop (m)
        minDistance: 0.25          // Peak proximity distance per hop (m)
      },
      options
    );

    // Global proximity and telemetry state
    this.proximity = 0;
    this.smoothedProximity = 0;
    this.currentDistance = 999;
    this.lastBoltUpdateTime = 0;
    this.boltUpdateInterval = 25; // 40Hz jitter

    // Create shared circular soft glow particle texture
    this.sparkTexture = this._createSoftGlowTexture();

    // Initialize visual sub-systems
    this._initSegmentBolts();
    this._initSegmentMidpointCores();
    this._initNodeRelayCores();
    this._initExplosiveSparks();
    this._initStreamSparks();
    this._initDynamicLights();

    // Enable Layer 1 for Selective Bloom
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
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');     // Soft White Center
    gradient.addColorStop(0.25, 'rgba(219, 234, 254, 0.85)'); // Soft Sky Cyan
    gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.4)');    // Electric Blue Glow
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    return new this.THREE.CanvasTexture(canvas);
  }

  /**
   * Initialize procedural ribbon mesh buffers for all potential chain segments.
   */
  _initSegmentBolts() {
    const THREE = this.THREE;
    const { maxSegments, maxBoltsPerSeg, segmentsPerBolt } = this.options;

    this.segments = [];
    const maxQuads = maxBoltsPerSeg * segmentsPerBolt;
    const maxVertices = maxQuads * 6;

    for (let s = 0; s < maxSegments; s++) {
      const positions = new Float32Array(maxVertices * 3);
      const colors = new Float32Array(maxVertices * 3);
      const uvs = new Float32Array(maxVertices * 2);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);

      this.segments.push({
        index: s,
        mesh,
        geometry,
        material,
        positions,
        colors,
        uvs,
        maxVertices
      });
    }
  }

  /**
   * Initialize expanding midpoint plasma energy cores for each active segment.
   */
  _initSegmentMidpointCores() {
    const THREE = this.THREE;
    this.midpointCores = [];

    for (let s = 0; s < this.options.maxSegments; s++) {
      const coreGroup = new THREE.Group();
      coreGroup.visible = false;

      // 1. Inner electric cyan crystal
      const innerGeo = new THREE.OctahedronGeometry(0.065, 1);
      const innerMat = new THREE.MeshBasicMaterial({
        color: this.options.coreColor,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      coreGroup.add(innerMesh);

      // 2. Outer blue wireframe shield
      const outerGeo = new THREE.IcosahedronGeometry(0.11, 1);
      const outerMat = new THREE.MeshBasicMaterial({
        color: this.options.primaryColor,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      coreGroup.add(outerMesh);

      // 3. Delicate orbital gyro rings in electric sky blue and ultraviolet purple
      const rings = [];
      const ringGeos = [
        new THREE.TorusGeometry(0.16, 0.005, 6, 24),
        new THREE.TorusGeometry(0.20, 0.004, 6, 24)
      ];

      ringGeos.forEach((geo, i) => {
        const ringMat = new THREE.MeshBasicMaterial({
          color: i === 0 ? this.options.primaryColor : this.options.secondaryColor,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const ring = new THREE.Mesh(geo, ringMat);
        ring.rotation.x = Math.PI / (i + 2);
        ring.rotation.y = Math.PI / (i + 3);
        rings.push(ring);
        coreGroup.add(ring);
      });

      this.group.add(coreGroup);

      this.midpointCores.push({
        group: coreGroup,
        innerMesh,
        outerMesh,
        rings
      });
    }
  }

  /**
   * Initialize relay crystal cores for intermediate and terminal marker nodes (0 to 7).
   */
  _initNodeRelayCores() {
    const THREE = this.THREE;
    this.nodeCores = [];

    for (let id = 0; id <= 7; id++) {
      const coreGroup = new THREE.Group();
      coreGroup.visible = false;

      const markerDef = MARKER_COLORS[id] || MARKER_COLORS[0];

      // 1. Inner crystal octahedron
      const innerGeo = new THREE.OctahedronGeometry(0.055, 1);
      const innerMat = new THREE.MeshBasicMaterial({
        color: markerDef.primary || 0x0ea5e9,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      coreGroup.add(innerMesh);

      // 2. Outer wireframe icosahedron
      const outerGeo = new THREE.IcosahedronGeometry(0.09, 1);
      const outerMat = new THREE.MeshBasicMaterial({
        color: markerDef.primary || 0x0ea5e9,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      coreGroup.add(outerMesh);

      // 3. Orbital gyro ring
      const ringGeo = new THREE.TorusGeometry(0.13, 0.004, 6, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: markerDef.secondary || 0x9333ea,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 3;
      coreGroup.add(ring);

      this.group.add(coreGroup);

      this.nodeCores.push({
        id,
        group: coreGroup,
        innerMesh,
        outerMesh,
        ring,
        baseColor: markerDef
      });
    }
  }

  /**
   * Initialize crisp 3D explosive radial spark particle system.
   */
  _initExplosiveSparks() {
    const THREE = this.THREE;
    const { maxExplosionSparks } = this.options;

    this.explosionPositions = new Float32Array(maxExplosionSparks * 3);
    this.explosionColors = new Float32Array(maxExplosionSparks * 3);
    this.explosionVelocities = [];
    this.explosionLifes = [];

    const colIce = new THREE.Color(0xdbeafe);
    const colSky = new THREE.Color(0x0ea5e9);
    const colPurple = new THREE.Color(0x9333ea);
    const colBlue = new THREE.Color(0x2563eb);

    for (let i = 0; i < maxExplosionSparks; i++) {
      this.explosionPositions[i * 3] = 9999;
      this.explosionPositions[i * 3 + 1] = 9999;
      this.explosionPositions[i * 3 + 2] = 9999;

      const r = Math.random();
      const randColor = r > 0.75 ? colIce : (r > 0.45 ? colSky : (r > 0.2 ? colPurple : colBlue));
      this.explosionColors[i * 3] = randColor.r;
      this.explosionColors[i * 3 + 1] = randColor.g;
      this.explosionColors[i * 3 + 2] = randColor.b;

      this.explosionVelocities.push(new THREE.Vector3());
      this.explosionLifes.push(Math.random());
    }

    this.explosionGeometry = new THREE.BufferGeometry();
    this.explosionGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.explosionPositions, 3)
    );
    this.explosionGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.explosionColors, 3)
    );

    this.explosionMaterial = new THREE.PointsMaterial({
      map: this.sparkTexture,
      vertexColors: true,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.explosionPoints = new THREE.Points(this.explosionGeometry, this.explosionMaterial);
    this.group.add(this.explosionPoints);
  }

  /**
   * Initialize directional traveling stream sparks along active chain segments.
   */
  _initStreamSparks() {
    const THREE = this.THREE;
    const { maxSegments, streamSparksPerSeg } = this.options;

    this.streamSystems = [];

    for (let s = 0; s < maxSegments; s++) {
      const positions = new Float32Array(streamSparksPerSeg * 3);
      const colors = new Float32Array(streamSparksPerSeg * 3);
      const progresses = [];

      for (let i = 0; i < streamSparksPerSeg; i++) {
        positions[i * 3] = 9999;
        positions[i * 3 + 1] = 9999;
        positions[i * 3 + 2] = 9999;

        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;

        progresses.push(Math.random());
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        map: this.sparkTexture,
        vertexColors: true,
        size: 0.10,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const points = new THREE.Points(geometry, material);
      points.visible = false;
      this.group.add(points);

      this.streamSystems.push({
        points,
        geometry,
        material,
        positions,
        colors,
        progresses,
        count: streamSparksPerSeg
      });
    }
  }

  /**
   * Initialize dynamic point lights for illumination.
   */
  _initDynamicLights() {
    const THREE = this.THREE;
    this.lights = [];

    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0x0ea5e9, 0, 4);
      this.group.add(light);
      this.lights.push(light);
    }
  }

  /**
   * Procedural recursive midpoint displacement for realistic jagged electric arcs.
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
   * Calculate color shift ratio (0.0 to 1.0) based on proximity.
   */
  _getProximityColorRatio(p) {
    const THREE = this.THREE;
    const pClamped = THREE.MathUtils.clamp(p, 0, 1);
    if (pClamped <= 0.15) return 0;
    if (pClamped >= 0.85) return 1;
    const t = (pClamped - 0.15) / 0.70;
    return t * t;
  }

  /**
   * Update visual effects for multi-node chain.
   *
   * @param {Array<{ id: number, name: string, position: THREE.Vector3, color: Object }>} chainNodes
   * @param {number} deltaMs - Frame delta in ms
   * @param {number} intensityMultiplier - Scale factor from BirthdayFX (0 to 1.8x)
   * @param {number} chargeProgress - Charging progress (0.0 to 1.0)
   * @param {Array<{ id: number, position: THREE.Vector3 }>} idleNodes - Nodes visible but not in active chain
   */
  updateChain(chainNodes = [], deltaMs = 16, intensityMultiplier = 1.0, chargeProgress = 0, idleNodes = []) {
    const THREE = this.THREE;
    const now = performance.now();

    if (!chainNodes || chainNodes.length < 2 || intensityMultiplier <= 0) {
      this.smoothedProximity = THREE.MathUtils.lerp(this.smoothedProximity, 0, 0.2);
      if (this.smoothedProximity < 0.01 || intensityMultiplier <= 0) {
        this.group.visible = false;
        this.currentDistance = 999;
        this.proximity = 0;
        this._hideAllSegments();
        this._updateIdleNodes(idleNodes, now, deltaMs);
        return;
      }
      
      // Update opacity/scale during fade out based on smoothedProximity
      const fadeP = this.smoothedProximity;
      this.segments.forEach(seg => {
        if (seg.material) seg.material.opacity = 0.88 * fadeP;
      });
      return;
    }

    // Reset material opacities if we are back in active state
    this.segments.forEach(seg => {
      if (seg.material) seg.material.opacity = 0.88;
    });

    this.group.visible = true;

    // Calculate total chain distance and hop distances
    const segmentCount = chainNodes.length - 1;
    let totalDist = 0;
    const segDistances = [];
    const segMidpoints = [];

    for (let i = 0; i < segmentCount; i++) {
      const pA = chainNodes[i].position;
      const pB = chainNodes[i + 1].position;
      const d = pA.distanceTo(pB);
      segDistances.push(d);
      totalDist += d;
      segMidpoints.push(pA.clone().add(pB).multiplyScalar(0.5));
    }

    this.currentDistance = totalDist;

    // Compute proximity based on average hop distance
    const avgHopDist = totalDist / Math.max(1, segmentCount);
    const { maxDistance, minDistance } = this.options;
    const rawProximity = THREE.MathUtils.clamp(
      (maxDistance - avgHopDist) / (maxDistance - minDistance),
      0,
      1
    );
    this.proximity = rawProximity;
    this.smoothedProximity = THREE.MathUtils.lerp(this.smoothedProximity, this.proximity, 0.25);

    const effectiveProximity = THREE.MathUtils.clamp(
      this.smoothedProximity * intensityMultiplier,
      0,
      1.5
    );

    const pColor = this._getProximityColorRatio(effectiveProximity);

    // Update active segments & bolts
    const shouldUpdateJitter = (now - this.lastBoltUpdateTime) > (this.boltUpdateInterval / (1 + effectiveProximity * 2.2));
    if (shouldUpdateJitter) {
      this.lastBoltUpdateTime = now;
    }

    for (let s = 0; s < this.options.maxSegments; s++) {
      const segData = this.segments[s];
      const midCore = this.midpointCores[s];
      const streamSys = this.streamSystems[s];

      if (s < segmentCount) {
        const nodeA = chainNodes[s];
        const nodeB = chainNodes[s + 1];
        const dist = segDistances[s];
        const midPoint = segMidpoints[s];

        segData.mesh.visible = true;
        midCore.group.visible = true;
        streamSys.points.visible = true;

        // Position and update midpoint plasma core
        midCore.group.position.copy(midPoint);
        this._updateMidpointCore(midCore, effectiveProximity, pColor, now, chargeProgress);

        // Update bolts with crisp cyber sky-blue & purple palette
        if (shouldUpdateJitter) {
          this._updateSegmentBolts(segData, nodeA, nodeB, midPoint, effectiveProximity, pColor, dist, chargeProgress, s, segmentCount);
        }

        // Update directional traveling sparks
        this._updateStreamSparks(streamSys, nodeA, nodeB, effectiveProximity, deltaMs, chargeProgress);
      } else {
        segData.mesh.visible = false;
        midCore.group.visible = false;
        streamSys.points.visible = false;
      }
    }

    // Update 3D explosive sparks around midpoints & node terminals
    this._updateExplosiveSparks(chainNodes, segMidpoints, effectiveProximity, pColor, deltaMs, chargeProgress);

    // Update node relay cores
    this._updateChainNodeCores(chainNodes, effectiveProximity, pColor, now, deltaMs, chargeProgress);

    // Update idle nodes
    this._updateIdleNodes(idleNodes, now, deltaMs);

    // Update dynamic lights
    this._updateDynamicLights(chainNodes, segMidpoints, effectiveProximity, pColor, chargeProgress);
  }

  /**
   * Compatibility wrapper for original dual-marker update(pos1, pos2, delta, intensity, progress).
   */
  update(startPos, endPos, delta = 16, intensityMultiplier = 1.0, chargeProgress = 0) {
    if (!startPos || !endPos) {
      this.updateChain([], delta, intensityMultiplier, chargeProgress, []);
      return;
    }

    const defaultChain = [
      { id: 0, name: 'DW', position: startPos, color: MARKER_COLORS[0] },
      { id: 1, name: 'Fu', position: endPos,   color: MARKER_COLORS[1] }
    ];

    this.updateChain(defaultChain, delta, intensityMultiplier, chargeProgress, []);
  }

  /**
   * Update electric ribbons using saturated Sky-Blue, Purple, and Ice-Cyan palette.
   */
  _updateSegmentBolts(segData, nodeA, nodeB, midPoint, p, pColor, dist, chargeProgress, segIdx, totalSegs) {
    const THREE = this.THREE;
    const { maxBoltsPerSeg, segmentsPerBolt } = this.options;
    const positions = segData.positions;
    const colors = segData.colors;
    const uvs = segData.uvs;

    let vertexIndex = 0;
    const activeBolts = Math.min(maxBoltsPerSeg, Math.max(1, Math.ceil(p * maxBoltsPerSeg)));

    // Refined, sharper bolt width to prevent blown-out white
    const baseWidth = 0.011 + Math.pow(p, 1.3) * 0.048;
    const baseJitter = 0.08 + Math.pow(p, 1.2) * 0.40;

    // Saturated cyber electric palette
    const colIceCyan = new THREE.Color(0xdbeafe);
    const colSky = new THREE.Color(0x0ea5e9);
    const colBlue = new THREE.Color(0x2563eb);
    const colPurple = new THREE.Color(0x9333ea);
    const colViolet = new THREE.Color(0xa855f7);

    // Dynamic red shift when close
    if (this.options.dynamicColorShift && pColor > 0) {
      colIceCyan.lerp(new THREE.Color(0xff3333), pColor);
      colSky.lerp(new THREE.Color(this.options.closePrimaryColor || 0xff0000), pColor);
      colBlue.lerp(new THREE.Color(0xff0000), pColor);
      colPurple.lerp(new THREE.Color(this.options.closeSecondaryColor || 0xcc0000), pColor);
      colViolet.lerp(new THREE.Color(0xee0000), pColor);
    }

    // Charge progress creates energetic pure white plasma core with subtle champagne accents
    if (chargeProgress > 0) {
      const chargeT = THREE.MathUtils.clamp(chargeProgress, 0, 1);
      const colPureWhite = new THREE.Color(0xffffff);
      const colChampagne = new THREE.Color(0xfff3c4);

      colIceCyan.lerp(colPureWhite, chargeT);
      colSky.lerp(colChampagne, Math.min(0.5, chargeT * 0.6));
      colBlue.lerp(colChampagne, Math.min(0.4, chargeT * 0.5));

      if (chargeT > 0.7) {
        const whiteT = (chargeT - 0.7) / 0.3;
        colSky.lerp(colPureWhite, whiteT);
        colPurple.lerp(colPureWhite, whiteT);
        colViolet.lerp(colPureWhite, whiteT);
      }
    }

    const startPos = nodeA.position;
    const endPos = nodeB.position;

    const mainDir = endPos.clone().sub(startPos).normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    const sideVector = new THREE.Vector3().crossVectors(mainDir, upVector).normalize();
    if (sideVector.lengthSq() < 0.001) sideVector.set(1, 0, 0);

    for (let b = 0; b < activeBolts; b++) {
      let bStart = startPos.clone();
      let bEnd = endPos.clone();
      let jitter = baseJitter;
      let boltWidth = baseWidth;

      if (b === 0) {
        boltWidth *= 1.15; // Main central bolt
      } else {
        boltWidth *= 0.65; // Delicate branch forks
        jitter *= 0.85;
        if (b % 2 === 1) {
          bEnd = midPoint.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.55 * p,
              (Math.random() - 0.5) * 0.55 * p,
              (Math.random() - 0.5) * 0.55 * p
            )
          );
        } else {
          bStart = midPoint.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.55 * p,
              (Math.random() - 0.5) * 0.55 * p,
              (Math.random() - 0.5) * 0.55 * p
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
          segColor = r > 0.72 ? colIceCyan : (r > 0.32 ? colSky : colBlue);
        } else if (b % 2 === 1) {
          segColor = (Math.random() > 0.4) ? colPurple : colViolet;
        } else {
          segColor = (Math.random() > 0.4) ? colSky : colBlue;
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

    segData.geometry.setDrawRange(0, vertexIndex);
    segData.geometry.attributes.position.needsUpdate = true;
    segData.geometry.attributes.color.needsUpdate = true;
    segData.geometry.attributes.uv.needsUpdate = true;
  }

  /**
   * Update expanding midpoint plasma energy core.
   */
  _updateMidpointCore(midCore, p, pColor, now, chargeProgress) {
    const THREE = this.THREE;

    // Expand energy core scale smoothly
    const scaleFactor = 0.3 + Math.pow(p, 1.4) * 2.2;
    midCore.group.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Inner crystal pulse
    const pulse = 1 + Math.sin(now * 0.025 * (1 + p * 3.5)) * (0.15 + 0.35 * p);
    midCore.innerMesh.scale.set(pulse, pulse, pulse);
    midCore.innerMesh.rotation.y += 0.04 + p * 0.08;
    midCore.innerMesh.rotation.x += 0.03 + p * 0.06;

    // Gyro rotation
    const rotSpeed = 0.03 + p * 0.16;
    midCore.rings.forEach((ring, i) => {
      ring.rotation.x += (i % 2 === 0 ? 1 : -1) * rotSpeed;
      ring.rotation.y += rotSpeed * 1.2;
      ring.rotation.z += rotSpeed * 0.8;
    });

    const colPrimary = new THREE.Color(this.options.primaryColor);
    const colSecondary = new THREE.Color(this.options.secondaryColor);
    const colCore = new THREE.Color(this.options.coreColor);

    if (this.options.dynamicColorShift && pColor > 0) {
      colPrimary.lerp(new THREE.Color(this.options.closePrimaryColor || 0xff0000), pColor);
      colSecondary.lerp(new THREE.Color(this.options.closeSecondaryColor || 0xcc0000), pColor);
      colCore.lerp(new THREE.Color(this.options.closeCoreColor || 0xff3333), pColor);
    }

    if (chargeProgress > 0) {
      const colWhite = new THREE.Color(0xffffff);
      const colChampagne = new THREE.Color(0xfff3c4);
      colPrimary.lerp(colChampagne, Math.min(0.4, chargeProgress * 0.5));
      colCore.lerp(colWhite, chargeProgress * 0.7);
    }

    midCore.innerMesh.material.color.copy(colCore);
    midCore.outerMesh.material.color.copy(colPrimary);
    if (midCore.rings[0]) midCore.rings[0].material.color.copy(colPrimary);
    if (midCore.rings[1]) midCore.rings[1].material.color.copy(colSecondary);
  }

  /**
   * Update 3D explosive radial spark particles.
   */
  _updateExplosiveSparks(chainNodes, segMidpoints, p, pColor, deltaMs, chargeProgress) {
    const THREE = this.THREE;
    const { maxExplosionSparks } = this.options;
    const positions = this.explosionPositions;
    const colors = this.explosionColors;

    const activeSparks = Math.max(14, Math.floor(Math.pow(p, 1.2) * maxExplosionSparks));
    const explosionRadius = 0.11 + Math.pow(p, 1.8) * 1.45;
    const speedMultiplier = 0.35 + Math.pow(p, 2.0) * 3.2;

    const origins = [...segMidpoints, ...chainNodes.map(n => n.position)];
    if (origins.length === 0) return;

    for (let i = 0; i < maxExplosionSparks; i++) {
      if (i < activeSparks) {
        const vel = this.explosionVelocities[i];

        positions[i * 3] += vel.x * speedMultiplier;
        positions[i * 3 + 1] += vel.y * speedMultiplier;
        positions[i * 3 + 2] += vel.z * speedMultiplier;

        positions[i * 3] += -vel.z * 0.15 * p;
        positions[i * 3 + 2] += vel.x * 0.15 * p;

        const origin = origins[i % origins.length];
        const dx = positions[i * 3] - origin.x;
        const dy = positions[i * 3 + 1] - origin.y;
        const dz = positions[i * 3 + 2] - origin.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > explosionRadius * explosionRadius || Math.random() < 0.05) {
          positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.04;
          positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.04;
          positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.04;

          const r = Math.random();
          const colIce = new THREE.Color(0xdbeafe);
          const colSky = new THREE.Color(0x0ea5e9);
          const colPurple = new THREE.Color(0x9333ea);
          const colBlue = new THREE.Color(0x2563eb);

          if (this.options.dynamicColorShift && pColor > 0) {
            colIce.lerp(new THREE.Color(0xff3333), pColor);
            colSky.lerp(new THREE.Color(this.options.closePrimaryColor || 0xff0000), pColor);
            colPurple.lerp(new THREE.Color(this.options.closeSecondaryColor || 0xcc0000), pColor);
            colBlue.lerp(new THREE.Color(0xee0000), pColor);
          }

          if (chargeProgress > 0) {
            const colWhite = new THREE.Color(0xffffff);
            colSky.lerp(colWhite, chargeProgress * 0.5);
            colIce.lerp(colWhite, chargeProgress * 0.7);
          }

          const sparkColor = r > 0.75 ? colIce : (r > 0.45 ? colSky : (r > 0.2 ? colPurple : colBlue));
          colors[i * 3] = sparkColor.r;
          colors[i * 3 + 1] = sparkColor.g;
          colors[i * 3 + 2] = sparkColor.b;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);
          const speed = (0.012 + Math.random() * 0.035) * (0.5 + p * 1.4);

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

    this.explosionGeometry.setDrawRange(0, activeSparks);
    this.explosionGeometry.attributes.position.needsUpdate = true;
    this.explosionGeometry.attributes.color.needsUpdate = true;
    this.explosionMaterial.size = 0.055 + Math.pow(p, 1.2) * 0.065;
  }

  /**
   * Update continuous directional traveling spark streams along each chain segment.
   */
  _updateStreamSparks(streamSys, nodeA, nodeB, p, deltaMs, chargeProgress) {
    const THREE = this.THREE;
    const { count, positions, colors, progresses } = streamSys;
    const activeSparks = Math.max(6, Math.floor(Math.pow(p, 1.2) * count));

    const startPos = nodeA.position;
    const endPos = nodeB.position;
    const segVector = endPos.clone().sub(startPos);

    const colSky = new THREE.Color(0x0ea5e9);
    const colViolet = new THREE.Color(0xa855f7);

    const flowSpeed = (0.001 + p * 0.0022) * (deltaMs / 16.6);

    for (let i = 0; i < count; i++) {
      if (i < activeSparks) {
        progresses[i] += flowSpeed * (0.85 + Math.random() * 0.3);
        if (progresses[i] > 1.0) {
          progresses[i] -= 1.0;
        }

        const t = progresses[i];
        const basePoint = startPos.clone().addScaledVector(segVector, t);

        const angle = t * Math.PI * 8 + i;
        const radius = (0.02 + Math.sin(t * Math.PI) * 0.04) * (0.6 + p * 0.8);
        const swirlX = Math.cos(angle) * radius;
        const swirlY = Math.sin(angle) * radius;

        positions[i * 3] = basePoint.x + swirlX;
        positions[i * 3 + 1] = basePoint.y + swirlY;
        positions[i * 3 + 2] = basePoint.z + Math.sin(angle * 1.5) * radius * 0.5;

        const sparkCol = new THREE.Color().lerpColors(colSky, colViolet, t);
        if (Math.random() > 0.7) {
          sparkCol.lerp(new THREE.Color(0xdbeafe), 0.7);
        }

        colors[i * 3] = sparkCol.r;
        colors[i * 3 + 1] = sparkCol.g;
        colors[i * 3 + 2] = sparkCol.b;
      } else {
        positions[i * 3] = 9999;
        positions[i * 3 + 1] = 9999;
        positions[i * 3 + 2] = 9999;
      }
    }

    streamSys.geometry.setDrawRange(0, activeSparks);
    streamSys.geometry.attributes.position.needsUpdate = true;
    streamSys.geometry.attributes.color.needsUpdate = true;
    streamSys.material.size = 0.045 + Math.pow(p, 1.2) * 0.055;
  }

  /**
   * Update active node relay energy cores.
   */
  _updateChainNodeCores(chainNodes, p, pColor, now, deltaMs, chargeProgress) {
    const THREE = this.THREE;
    const activeNodeIds = new Set(chainNodes.map(n => n.id));

    for (const core of this.nodeCores) {
      if (!activeNodeIds.has(core.id)) {
        core.group.visible = false;
      }
    }

    for (let idx = 0; idx < chainNodes.length; idx++) {
      const node = chainNodes[idx];
      const core = this.nodeCores[node.id];
      if (!core) continue;

      core.group.visible = true;
      core.group.position.copy(node.position);

      const scaleFactor = 0.35 + Math.pow(p, 1.4) * 1.8;
      core.group.scale.set(scaleFactor, scaleFactor, scaleFactor);

      const rotSpeed = 0.03 + p * 0.14;
      core.ring.rotation.x += rotSpeed;
      core.ring.rotation.y += rotSpeed * 1.3;
      core.outerMesh.rotation.y += rotSpeed * 0.7;
      core.innerMesh.rotation.z += rotSpeed * 0.9;

      const pulse = 1.0 + Math.sin(now * 0.02 + idx * 1.5) * (0.12 + 0.28 * p);
      core.innerMesh.scale.set(pulse, pulse, pulse);

      const nodeCol = MARKER_COLORS[node.id] || MARKER_COLORS[0];
      const colPrimary = new THREE.Color(nodeCol.primary);
      const colSecondary = new THREE.Color(nodeCol.secondary);

      core.innerMesh.material.color.copy(colPrimary);
      core.outerMesh.material.color.copy(colPrimary);
      core.ring.material.color.copy(colSecondary);
    }
  }

  /**
   * Update idle nodes with gentle breathing pulse aura.
   */
  _updateIdleNodes(idleNodes = [], now, deltaMs) {
    if (!idleNodes || idleNodes.length === 0) return;

    for (const idle of idleNodes) {
      const core = this.nodeCores[idle.id];
      if (!core) continue;

      core.group.visible = true;
      core.group.position.copy(idle.position);

      const idlePulse = 0.25 + Math.sin(now * 0.003 + idle.id) * 0.04;
      core.group.scale.set(idlePulse, idlePulse, idlePulse);

      core.ring.rotation.x += 0.012;
      core.ring.rotation.y += 0.016;
      core.outerMesh.rotation.y += 0.01;

      const nodeCol = MARKER_COLORS[idle.id] || MARKER_COLORS[0];
      core.innerMesh.material.color.setHex(nodeCol.primary);
      core.outerMesh.material.color.setHex(nodeCol.primary);
      core.ring.material.color.setHex(nodeCol.secondary);
    }
  }

  /**
   * Update dynamic point lights along the chain.
   */
  _updateDynamicLights(chainNodes, segMidpoints, p, pColor, chargeProgress) {
    const THREE = this.THREE;
    if (!chainNodes || chainNodes.length === 0) {
      for (const light of this.lights) light.intensity = 0;
      return;
    }

    const origins = [...segMidpoints, ...chainNodes.map(n => n.position)];
    const lightCount = this.lights.length;

    for (let i = 0; i < lightCount; i++) {
      const light = this.lights[i];
      if (i < origins.length) {
        light.position.copy(origins[i % origins.length]);
        const lightColor = new THREE.Color(0x0ea5e9); // Vivid sky blue
        if (pColor > 0) lightColor.lerp(new THREE.Color(0xff0000), pColor);
        if (chargeProgress > 0) lightColor.lerp(new THREE.Color(0xffffff), chargeProgress * 0.5);

        light.color.copy(lightColor);
        light.intensity = Math.pow(p, 1.2) * (6.0 / Math.max(1, origins.length * 0.4));
        light.distance = 3.5 + p * 3.5;
      } else {
        light.intensity = 0;
      }
    }
  }

  _hideAllSegments() {
    for (const seg of this.segments) seg.mesh.visible = false;
    for (const midCore of this.midpointCores) midCore.group.visible = false;
    for (const sys of this.streamSystems) sys.points.visible = false;
    if (this.explosionPoints) this.explosionPoints.visible = false;
    for (const core of this.nodeCores) core.group.visible = false;
    for (const light of this.lights) light.intensity = 0;
  }

  dispose() {
    super.dispose();
    for (const seg of this.segments) {
      seg.geometry.dispose();
      seg.material.dispose();
    }
    for (const midCore of this.midpointCores) {
      midCore.innerMesh.geometry.dispose();
      midCore.innerMesh.material.dispose();
      midCore.outerMesh.geometry.dispose();
      midCore.outerMesh.material.dispose();
      midCore.rings.forEach(r => {
        r.geometry.dispose();
        r.material.dispose();
      });
    }
    for (const sys of this.streamSystems) {
      sys.geometry.dispose();
      sys.material.dispose();
    }
    if (this.explosionGeometry) this.explosionGeometry.dispose();
    if (this.explosionMaterial) this.explosionMaterial.dispose();
    if (this.sparkTexture) this.sparkTexture.dispose();
    for (const core of this.nodeCores) {
      core.innerMesh.geometry.dispose();
      core.innerMesh.material.dispose();
      core.outerMesh.geometry.dispose();
      core.outerMesh.material.dispose();
      core.ring.geometry.dispose();
      core.ring.material.dispose();
    }
  }
}
