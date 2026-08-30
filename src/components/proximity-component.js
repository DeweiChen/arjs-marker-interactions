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
      dynamicColorShift: { type: 'boolean', default: true },
      targetNodes: { type: 'string', default: '[0,1]' },
      celebrationText: { type: 'string', default: '' },
      audioUrl: { type: 'string', default: '' },
      markerNames: { type: 'string', default: '{}' }
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
          chargeThreshold: 2.2,
          textLine1: this.data.celebrationText,
          audioUrl: this.data.audioUrl
        });
      }

      this._resetBirthdayHandler = () => {
        if (this.birthdayFX) {
          this.birthdayFX.reset();
        }
      };
      sceneEl.addEventListener('reset-birthday', this._resetBirthdayHandler);

      this._toggleAudioHandler = () => {
        if (this.birthdayFX) {
          this.birthdayFX.toggleAudio();
        }
      };
      sceneEl.addEventListener('toggle-audio', this._toggleAudioHandler);

      // Bind visibility events for all markers
      this._bindAllMarkerEvents();
    },

    update: function (oldData) {
      const sceneEl = this.el.sceneEl;
      let shouldReinit = false;

      if (oldData) {
        if (oldData.enableBirthday !== this.data.enableBirthday) shouldReinit = true;
        if (oldData.celebrationText !== this.data.celebrationText) shouldReinit = true;
        if (oldData.audioUrl !== this.data.audioUrl) shouldReinit = true;
      }

      if (shouldReinit || !oldData) {
        if (this.birthdayFX) {
          this.birthdayFX.dispose();
          this.birthdayFX = null;
        }
        if (this.data.enableBirthday) {
          this.birthdayFX = new BirthdayFX(sceneEl.object3D, {
            chargeThreshold: 2.2,
            textLine1: this.data.celebrationText,
            audioUrl: this.data.audioUrl
          });
        }
      }

      if (this.data.markerNames && (!oldData || oldData.markerNames !== this.data.markerNames)) {
        try {
          const names = JSON.parse(this.data.markerNames);
          this.markerNodes.forEach((node) => {
            if (names[node.id] !== undefined) {
              node.name = String(names[node.id]);
            } else {
              node.name = `${node.id}`;
            }
          });
        } catch (e) {}
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
      
      let tNodes = [0, 1];
      try {
        tNodes = JSON.parse(this.data.targetNodes);
      } catch (e) {}

      const hasTerminalA = nodeMap.has(tNodes[0]);
      const hasTerminalB = nodeMap.has(tNodes[1]);

      // Intermediate number candidates
      const numberNodes = activeNodes.filter(n => n.id !== tNodes[0] && n.id !== tNodes[1]);

      let chain = [];

      if (hasTerminalA && hasTerminalB) {
        // Full terminal-to-terminal chain
        const nodeA = nodeMap.get(tNodes[0]);
        const nodeB = nodeMap.get(tNodes[1]);
        chain.push(nodeA);

        const unvisited = [...numberNodes];
        let current = nodeA;

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

        chain.push(nodeB);
      } else if (hasTerminalA && numberNodes.length > 0) {
        // Partial half-chain from Terminal A
        const nodeA = nodeMap.get(tNodes[0]);
        chain.push(nodeA);

        const unvisited = [...numberNodes];
        let current = nodeA;

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
      } else if (hasTerminalB && numberNodes.length > 0) {
        // Partial half-chain from Terminal B
        const nodeB = nodeMap.get(tNodes[1]);
        chain.push(nodeB);

        const unvisited = [...numberNodes];
        let current = nodeB;

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
        // Ensure marker is actually visible (AR.js sets visible=false when lost)
        let isStable = markerEl.object3D.visible && (stab ? stab.isStable : node.isVisible);

        if (isStable) {
          markerEl.object3D.updateMatrixWorld(true);
          markerEl.object3D.getWorldPosition(node.rawPos);
          node.rawPos.y += this.data.terminalOffsetY;

          if (!node.hasInitPos) {
            node.smoothedPos.copy(node.rawPos);
            node.hasInitPos = true;
          } else {
            // Guard against AR.js tracking glitches where marker suddenly jumps > 3m in a single frame
            if (node.smoothedPos.distanceTo(node.rawPos) > 3) {
              isStable = false; // Physically impossible jump (glitch), ignore this frame entirely
            } else {
              node.smoothedPos.lerp(node.rawPos, alpha);
            }
          }

          if (isStable) {
            activeNodes.push({
              id: node.id,
              name: node.name,
              position: node.smoothedPos,
              color: node.color,
              smoothedPos: node.smoothedPos
            });
          }
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

        // Celebration FX update (triggers if Target Nodes are connected in active chain)
        let bdayResult = { state: 'STANDBY', chargePercent: 0, chargeProgress: 0, lightningIntensity: 1.0 };
        
        let tNodes = [0, 1];
        try { tNodes = JSON.parse(this.data.targetNodes); } catch(e) {}
        
        const hasA = chain.some(n => n.id === tNodes[0]);
        const hasB = chain.some(n => n.id === tNodes[1]);

        if (this.birthdayFX) {
          if (hasA && hasB) {
            const nodeA = chain.find(n => n.id === tNodes[0]);
            const nodeB = chain.find(n => n.id === tNodes[1]);
            bdayResult = this.birthdayFX.update(nodeA.position, nodeB.position, totalDist, prox, timeDelta);
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
          chargePercent: bdayResult.chargePercent,
          isAudioPlaying: this.birthdayFX ? this.birthdayFX.isAudioPlaying() : false,
          hasAudio: this.birthdayFX ? this.birthdayFX.hasAudio() : false
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
          chargePercent: bdayResult.chargePercent,
          isAudioPlaying: this.birthdayFX ? this.birthdayFX.isAudioPlaying() : false,
          hasAudio: this.birthdayFX ? this.birthdayFX.hasAudio() : false
        });
      }
    },

    remove: function () {
      if (this.el.sceneEl) {
        if (this._resetBirthdayHandler) {
          this.el.sceneEl.removeEventListener('reset-birthday', this._resetBirthdayHandler);
        }
        if (this._toggleAudioHandler) {
          this.el.sceneEl.removeEventListener('toggle-audio', this._toggleAudioHandler);
        }
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
