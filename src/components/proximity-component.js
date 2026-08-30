/**
 * A-Frame Custom Component: proximity-lightning
 * Connects tracked AR markers (0 to 7: DW, Fu, 2, 3, 4, 5, 6, 7) with dynamic procedural
 * multi-marker chain conduction and proximity visual effects.
 * Uses Nearest-Neighbor physical distance pathing to route electricity through intermediate nodes.
 * Seamlessly integrates with BirthdayFX celebration state machine and Selective Bloom.
 */

import { globalFXFactory } from '../fx/fx-factory.js';
import { BirthdayFX } from '../fx/birthday-fx.js';
import { MARKER_COLORS } from '../fx/chain-conduction-fx.js';

if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('proximity-lightning', {
    schema: {
      maxDistance: { type: 'number', default: 4.5 },
      minDistance: { type: 'number', default: 0.25 },
      terminalOffsetY: { type: 'number', default: 0.25 },
      smoothingFactor: { type: 'number', default: 0.35 },
      fxType: { type: 'string', default: 'lightning' },
      enableBirthday: { type: 'boolean', default: false },
      dynamicColorShift: { type: 'boolean', default: true }
    },

    init: function () {
      const sceneEl = this.el.sceneEl;
      const THREE = window.THREE || AFRAME.THREE;

      // Tracked marker records for all 8 barcode markers (0 to 7)
      this.markerNodes = [];
      for (let i = 0; i <= 7; i++) {
        const markerDef = MARKER_COLORS[i] || { name: `${i}`, primary: 0xffffff, secondary: 0xcccccc };
        this.markerNodes.push({
          id: i,
          name: markerDef.name,
          color: markerDef,
          el: document.getElementById(`marker-${i}`),
          rawPos: new THREE.Vector3(),
          smoothedPos: new THREE.Vector3(),
          hasInitPos: false,
          isVisible: false
        });
      }

      // Initialize primary FX via FXFactory (defaults to ChainConductionFX)
      this.lightningFX = globalFXFactory.create(this.data.fxType, sceneEl.object3D, {
        maxDistance: this.data.maxDistance,
        minDistance: this.data.minDistance,
        dynamicColorShift: this.data.dynamicColorShift
      });

      // Optionally initialize Birthday FX attached to root scene
      if (this.data.enableBirthday) {
        this.birthdayFX = new BirthdayFX(sceneEl.object3D, {
          chargeThreshold: 2.2
        });
      }

      this._resetBirthdayHandler = () => {
        if (this.birthdayFX) {
          this.birthdayFX.reset();
        }
      };
      sceneEl.addEventListener('reset-birthday', this._resetBirthdayHandler);

      // Bind visibility events for all markers
      this._bindAllMarkerEvents();
    },

    update: function (oldData) {
      const sceneEl = this.el.sceneEl;
      if (oldData && oldData.enableBirthday !== this.data.enableBirthday) {
        if (this.data.enableBirthday) {
          if (!this.birthdayFX) {
            this.birthdayFX = new BirthdayFX(sceneEl.object3D, {
              chargeThreshold: 2.2
            });
          }
        } else {
          if (this.birthdayFX) {
            this.birthdayFX.dispose();
            this.birthdayFX = null;
          }
        }
      }
    },

    _bindAllMarkerEvents: function () {
      this.markerNodes.forEach((node) => {
        const markerEl = node.el;
        if (!markerEl) return;

        markerEl.addEventListener('markerFound', () => {
          node.isVisible = true;
          this.el.emit('marker-status-change', { marker: node.name, id: node.id, visible: true });
        });

        markerEl.addEventListener('markerLost', () => {
          node.isVisible = false;
          node.hasInitPos = false;
          this.el.emit('marker-status-change', { marker: node.name, id: node.id, visible: false });
        });
      });
    },

    /**
     * Compute nearest-neighbor physical distance path across active markers.
     *
     * @param {Array<Object>} activeNodes - Currently visible and stabilized nodes
     * @returns {{ chain: Array<Object>, idle: Array<Object> }}
     */
    _buildNearestNeighborChain: function (activeNodes) {
      if (!activeNodes || activeNodes.length === 0) {
        return { chain: [], idle: [] };
      }
      if (activeNodes.length === 1) {
        return { chain: [], idle: activeNodes };
      }

      const nodeMap = new Map(activeNodes.map(n => [n.id, n]));
      const hasDW = nodeMap.has(0);
      const hasFu = nodeMap.has(1);

      // Intermediate number candidates (IDs 2-7)
      const numberNodes = activeNodes.filter(n => n.id >= 2);

      let chain = [];

      if (hasDW && hasFu) {
        // Full terminal-to-terminal chain: DW -> (nearest numbers...) -> Fu
        const dwNode = nodeMap.get(0);
        const fuNode = nodeMap.get(1);
        chain.push(dwNode);

        const unvisited = [...numberNodes];
        let current = dwNode;

        while (unvisited.length > 0) {
          let closestIdx = -1;
          let closestDist = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const d = current.smoothedPos.distanceTo(unvisited[i].smoothedPos);
            if (d < closestDist) {
              closestDist = d;
              closestIdx = i;
            }
          }

          if (closestIdx >= 0) {
            const nextNode = unvisited.splice(closestIdx, 1)[0];
            chain.push(nextNode);
            current = nextNode;
          } else {
            break;
          }
        }

        chain.push(fuNode);
      } else if (hasDW && numberNodes.length > 0) {
        // Partial half-chain from DW: DW -> (nearest numbers...)
        const dwNode = nodeMap.get(0);
        chain.push(dwNode);

        const unvisited = [...numberNodes];
        let current = dwNode;

        while (unvisited.length > 0) {
          let closestIdx = -1;
          let closestDist = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const d = current.smoothedPos.distanceTo(unvisited[i].smoothedPos);
            if (d < closestDist) {
              closestDist = d;
              closestIdx = i;
            }
          }

          if (closestIdx >= 0) {
            const nextNode = unvisited.splice(closestIdx, 1)[0];
            chain.push(nextNode);
            current = nextNode;
          } else {
            break;
          }
        }
      } else if (hasFu && numberNodes.length > 0) {
        // Partial half-chain from Fu: Fu -> (nearest numbers...)
        const fuNode = nodeMap.get(1);
        chain.push(fuNode);

        const unvisited = [...numberNodes];
        let current = fuNode;

        while (unvisited.length > 0) {
          let closestIdx = -1;
          let closestDist = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const d = current.smoothedPos.distanceTo(unvisited[i].smoothedPos);
            if (d < closestDist) {
              closestDist = d;
              closestIdx = i;
            }
          }

          if (closestIdx >= 0) {
            const nextNode = unvisited.splice(closestIdx, 1)[0];
            chain.push(nextNode);
            current = nextNode;
          } else {
            break;
          }
        }
      } else if (numberNodes.length >= 2) {
        // Number-only inter-conduction: start at lowest ID number
        numberNodes.sort((a, b) => a.id - b.id);
        const startNode = numberNodes[0];
        chain.push(startNode);

        const unvisited = numberNodes.slice(1);
        let current = startNode;

        while (unvisited.length > 0) {
          let closestIdx = -1;
          let closestDist = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const d = current.smoothedPos.distanceTo(unvisited[i].smoothedPos);
            if (d < closestDist) {
              closestDist = d;
              closestIdx = i;
            }
          }

          if (closestIdx >= 0) {
            const nextNode = unvisited.splice(closestIdx, 1)[0];
            chain.push(nextNode);
            current = nextNode;
          } else {
            break;
          }
        }
      }

      // Identify idle nodes (visible active nodes not in chain)
      const chainSet = new Set(chain.map(n => n.id));
      const idle = activeNodes.filter(n => !chainSet.has(n.id));

      return { chain, idle };
    },

    tick: function (time, timeDelta) {
      if (!this.lightningFX) return;

      const alpha = this.data.smoothingFactor;
      const activeNodes = [];

      // Update positions and stabilization for all 8 markers
      for (const node of this.markerNodes) {
        const markerEl = node.el;
        if (!markerEl || !markerEl.object3D) continue;

        const stab = markerEl.components['marker-stabilizer'];
        const isStable = stab ? stab.isStable : ((markerEl.object3D.visible) || node.isVisible);

        if (isStable) {
          markerEl.object3D.updateMatrixWorld(true);
          markerEl.object3D.getWorldPosition(node.rawPos);
          node.rawPos.y += this.data.terminalOffsetY;

          if (!node.hasInitPos) {
            node.smoothedPos.copy(node.rawPos);
            node.hasInitPos = true;
          } else {
            node.smoothedPos.lerp(node.rawPos, alpha);
          }

          activeNodes.push({
            id: node.id,
            name: node.name,
            position: node.smoothedPos,
            color: node.color,
            smoothedPos: node.smoothedPos
          });
        }
      }

      // Build physical nearest-neighbor chain path
      const { chain, idle } = this._buildNearestNeighborChain(activeNodes);

      if (chain.length >= 2) {
        // Calculate total chain distance
        let totalDist = 0;
        for (let i = 0; i < chain.length - 1; i++) {
          totalDist += chain[i].position.distanceTo(chain[i + 1].position);
        }

        const prox = this.lightningFX.smoothedProximity || 0;

        // Birthday FX update (triggers if DW and Fu are connected in active chain)
        let bdayResult = { state: 'STANDBY', chargePercent: 0, chargeProgress: 0, lightningIntensity: 1.0 };
        const hasDW = chain.some(n => n.id === 0);
        const hasFu = chain.some(n => n.id === 1);

        if (this.birthdayFX) {
          if (hasDW && hasFu) {
            const dwNode = chain.find(n => n.id === 0);
            const fuNode = chain.find(n => n.id === 1);
            bdayResult = this.birthdayFX.update(dwNode.position, fuNode.position, totalDist, prox, timeDelta);
          } else {
            bdayResult = this.birthdayFX.update(null, null, 999, 0, timeDelta);
          }
        }

        // Update Chain Conduction FX
        if (typeof this.lightningFX.updateChain === 'function') {
          this.lightningFX.updateChain(
            chain,
            timeDelta,
            bdayResult.lightningIntensity,
            bdayResult.chargeProgress || 0,
            idle
          );
        } else {
          this.lightningFX.update(
            chain[0].position,
            chain[chain.length - 1].position,
            timeDelta,
            bdayResult.lightningIntensity,
            bdayResult.chargeProgress || 0
          );
        }

        const chainPathStr = chain.map(n => n.name).join(' ➔ ');

        this.el.emit('proximity-update', {
          distance: totalDist,
          proximity: prox,
          active: prox > 0.02 || chain.length >= 2,
          chainPath: chain.map(n => n.name),
          chainPathStr,
          activeCount: activeNodes.length,
          birthdayState: bdayResult.state,
          chargePercent: bdayResult.chargePercent
        });
      } else {
        // No connected chain (0 or 1 active marker)
        let bdayResult = { state: 'STANDBY', chargePercent: 0, chargeProgress: 0, lightningIntensity: 0 };
        if (this.birthdayFX) {
          bdayResult = this.birthdayFX.update(null, null, 999, 0, timeDelta);
        }

        if (typeof this.lightningFX.updateChain === 'function') {
          this.lightningFX.updateChain([], timeDelta, 0, 0, activeNodes);
        } else {
          this.lightningFX.update(null, null, timeDelta, 0);
        }

        this.el.emit('proximity-update', {
          distance: null,
          proximity: 0,
          active: false,
          chainPath: [],
          chainPathStr: '',
          activeCount: activeNodes.length,
          birthdayState: bdayResult.state,
          chargePercent: bdayResult.chargePercent
        });
      }
    },

    remove: function () {
      if (this._resetBirthdayHandler && this.el.sceneEl) {
        this.el.sceneEl.removeEventListener('reset-birthday', this._resetBirthdayHandler);
      }
      if (this.lightningFX) {
        this.lightningFX.dispose();
      }
      if (this.birthdayFX) {
        this.birthdayFX.dispose();
      }
    }
  });
}
