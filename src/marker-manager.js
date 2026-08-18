import * as THREE from 'three';
import {
  ArMarkerControls,
  ArSmoothedControls
} from '@ar-js-org/ar.js/three.js/build/ar-threex.mjs';

/**
 * Marker Manager: Handles marker registration, 3D object binding, and tracking state listeners.
 */
export class MarkerManager {
  /**
   * @param {import('./ar-scene.js').ARScene} arScene
   */
  constructor(arScene) {
    this.arScene = arScene;
    this.scene = arScene.scene;
    this.arContext = arScene.arToolkitContext;
    this.markers = new Map(); // id -> { root, controls, smoothedControls, visualObject, isVisible, onStatusChange }
  }

  /**
   * Register Hiro Marker (Default Marker 1)
   */
  addHiroMarker(onStatusChange = null) {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const patternUrl = `${baseUrl}markers/pattern-hiro.patt`;

    const markerRoot = new THREE.Group();
    markerRoot.name = 'marker-hiro-root';
    this.scene.add(markerRoot);

    const markerControls = new ArMarkerControls(this.arContext, markerRoot, {
      type: 'pattern',
      patternUrl: patternUrl,
      changeMatrixMode: 'modelViewMatrix'
    });

    // Create default 3D visual object (can be replaced via setMarkerObject)
    const visualObject = this._createHiro3DObject();
    markerRoot.add(visualObject);

    this.markers.set('hiro', {
      id: 'hiro',
      name: 'Hiro (Marker 1)',
      root: markerRoot,
      controls: markerControls,
      visualObject: visualObject,
      isVisible: false,
      onStatusChange: onStatusChange,
      color: '#f43f5e'
    });

    return markerRoot;
  }

  /**
   * Register Kanji Marker (Default Marker 2)
   */
  addKanjiMarker(onStatusChange = null) {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const patternUrl = `${baseUrl}markers/pattern-kanji.patt`;

    const markerRoot = new THREE.Group();
    markerRoot.name = 'marker-kanji-root';
    this.scene.add(markerRoot);

    const markerControls = new ArMarkerControls(this.arContext, markerRoot, {
      type: 'pattern',
      patternUrl: patternUrl,
      changeMatrixMode: 'modelViewMatrix'
    });

    // Create default 3D visual object
    const visualObject = this._createKanji3DObject();
    markerRoot.add(visualObject);

    this.markers.set('kanji', {
      id: 'kanji',
      name: 'Kanji (Marker 2)',
      root: markerRoot,
      controls: markerControls,
      visualObject: visualObject,
      isVisible: false,
      onStatusChange: onStatusChange,
      color: '#0ea5e9'
    });

    return markerRoot;
  }

  /**
   * Register custom pattern marker
   * @param {string} id - Custom identifier
   * @param {string} patternUrl - Path to .patt file
   * @param {THREE.Object3D} customObject - 3D object to attach
   * @param {Function} onStatusChange - Status change callback
   */
  addCustomMarker(id, patternUrl, customObject, onStatusChange = null) {
    const markerRoot = new THREE.Group();
    markerRoot.name = `marker-${id}-root`;
    this.scene.add(markerRoot);

    const markerControls = new ArMarkerControls(this.arContext, markerRoot, {
      type: 'pattern',
      patternUrl: patternUrl,
      changeMatrixMode: 'modelViewMatrix'
    });

    if (customObject) {
      markerRoot.add(customObject);
    }

    this.markers.set(id, {
      id: id,
      name: id,
      root: markerRoot,
      controls: markerControls,
      visualObject: customObject,
      isVisible: false,
      onStatusChange: onStatusChange
    });

    return markerRoot;
  }

  /**
   * Replace 3D object for a specific marker (allows swapping textures, models, or visual effects)
   * @param {string} markerId - 'hiro' | 'kanji' | customId
   * @param {THREE.Object3D} newObject
   */
  setMarkerObject(markerId, newObject) {
    const markerData = this.markers.get(markerId);
    if (!markerData) {
      console.warn(`Marker ${markerId} not found`);
      return;
    }

    if (markerData.visualObject) {
      markerData.root.remove(markerData.visualObject);
    }

    markerData.visualObject = newObject;
    markerData.root.add(newObject);
  }

  /**
   * Get world position of a specific marker
   * @param {string} markerId
   * @returns {THREE.Vector3|null}
   */
  getMarkerPosition(markerId) {
    const markerData = this.markers.get(markerId);
    if (!markerData || !markerData.root.visible) return null;

    const pos = new THREE.Vector3();
    markerData.root.getWorldPosition(pos);
    return pos;
  }

  /**
   * Per-frame update: Check marker visibility and execute floating/rotation animations
   * @param {number} delta
   * @param {number} elapsedTime
   */
  update(delta, elapsedTime) {
    for (const [id, data] of this.markers.entries()) {
      const isCurrentlyVisible = data.root.visible;

      // Detect tracking status change (Detected / Lost)
      if (isCurrentlyVisible !== data.isVisible) {
        data.isVisible = isCurrentlyVisible;
        if (typeof data.onStatusChange === 'function') {
          data.onStatusChange(isCurrentlyVisible, data);
        }
      }

      // Run 3D micro-animations when marker is detected
      if (isCurrentlyVisible && data.visualObject) {
        this._animateVisualObject(id, data.visualObject, delta, elapsedTime);
      }
    }
  }

  /**
   * 3D object floating and rotation animations
   */
  _animateVisualObject(id, object, delta, elapsedTime) {
    if (id === 'hiro') {
      // Floating animation
      object.position.y = 0.6 + Math.sin(elapsedTime * 2.5) * 0.08;
      // Compound rotation
      object.rotation.y += delta * 0.8;
      object.rotation.x = Math.sin(elapsedTime * 1.5) * 0.15;
    } else if (id === 'kanji') {
      object.position.y = 0.6 + Math.cos(elapsedTime * 2.5) * 0.08;
      object.rotation.y -= delta * 0.8;
      object.rotation.z = Math.cos(elapsedTime * 1.5) * 0.15;
    } else {
      object.rotation.y += delta * 0.5;
    }
  }

  /**
   * Hiro Marker default 3D object (futuristic geometric core in rose)
   */
  _createHiro3DObject() {
    const group = new THREE.Group();
    group.position.y = 0.6;

    // 1. Outer wireframe box
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    group.add(boxMesh);

    // 2. Glowing edges
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffe4e6, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    group.add(wireframe);

    // 3. Emissive core sphere
    const coreGeo = new THREE.SphereGeometry(0.25, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    return group;
  }

  /**
   * Kanji Marker default 3D object (octahedral crystal in sky blue)
   */
  _createKanji3DObject() {
    const group = new THREE.Group();
    group.position.y = 0.6;

    // 1. Outer octahedron crystal
    const octGeo = new THREE.OctahedronGeometry(0.55, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.85
    });
    const octMesh = new THREE.Mesh(octGeo, octMat);
    group.add(octMesh);

    // 2. Crystal wireframe edges
    const edges = new THREE.EdgesGeometry(octGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    group.add(wireframe);

    // 3. Inner counter-rotated octahedron
    const innerGeo = new THREE.OctahedronGeometry(0.28, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.y = Math.PI / 4;
    group.add(innerMesh);

    return group;
  }
}
