/**
 * HUD Telemetry & Energy Gauge Controller
 * Handles real-time FPS / frame latency calculation, energy charge meter synchronization,
 * and browser fullscreen / immersive viewport toggling.
 */

export class HUDTelemetryController {
  constructor(sceneEl) {
    this.sceneEl = sceneEl;

    // DOM Elements
    this.badgeFps = document.getElementById('badge-fps');
    this.fpsVal = document.getElementById('fps-val');
    this.frametimeVal = document.getElementById('frametime-val');

    this.distanceVal = document.getElementById('distance-val');
    this.energyBar = document.getElementById('energy-bar');
    this.energyStatusText = document.getElementById('energy-status-text');

    this.btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
    this.iconFsEnter = document.getElementById('icon-fs-enter');
    this.iconFsExit = document.getElementById('icon-fs-exit');
    this.fsBtnText = document.getElementById('fs-btn-text');
    this.btnRestoreHud = document.getElementById('btn-restore-hud');

    // FPS Telemetry counters
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsUpdateInterval = 500; // ms

    this._initFullscreenEvents();
    this._startLoop();
  }

  _initFullscreenEvents() {
    if (this.btnToggleFullscreen) {
      this.btnToggleFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }
    if (this.btnRestoreHud) {
      this.btnRestoreHud.addEventListener('click', () => this.toggleFullscreen(false));
    }

    document.addEventListener('fullscreenchange', () => this._onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this._onFullscreenChange());
  }

  toggleFullscreen(forceState) {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    const shouldEnter = typeof forceState === 'boolean' ? forceState : !isFS;

    if (shouldEnter) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  _onFullscreenChange() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (this.iconFsEnter) this.iconFsEnter.classList.toggle('hidden', isFS);
    if (this.iconFsExit) this.iconFsExit.classList.toggle('hidden', !isFS);
    if (this.fsBtnText) this.fsBtnText.textContent = isFS ? 'Exit' : 'Full';
    if (this.btnRestoreHud) this.btnRestoreHud.classList.toggle('hidden', !isFS);
  }

  _startLoop() {
    const updateStats = () => {
      const now = performance.now();
      const delta = now - this.lastTime;
      this.frameCount++;

      if (delta >= this.fpsUpdateInterval) {
        const fps = Math.round((this.frameCount * 1000) / delta);
        const frameMs = (delta / this.frameCount).toFixed(1);

        if (this.fpsVal) this.fpsVal.textContent = fps;
        if (this.frametimeVal) this.frametimeVal.textContent = `(${frameMs}ms)`;

        this.frameCount = 0;
        this.lastTime = now;
      }
      requestAnimationFrame(updateStats);
    };
    requestAnimationFrame(updateStats);
  }

  /**
   * Update bottom energy card status from proximity event data
   *
   * @param {Object} data - { distance, proximity, active, birthdayState, chargePercent }
   */
  updateProximityStatus(data) {
    if (!data) return;
    const { distance, proximity, active, birthdayState, chargePercent } = data;
    const proxClamped = Math.min(1, Math.max(0, proximity || 0));

    // Calculate dynamic color ratio: 0.0 when far (p <= 0.15), 1.0 when close (p >= 0.85)
    let pColor = 0;
    if (proxClamped > 0.15) {
      const t = Math.min(1, (proxClamped - 0.15) / 0.70);
      pColor = t * t;
    }

    // Dynamic HUD RGB interpolation (Cyan #38bdf8 -> Pure Crimson Red #ff0000)
    const r = Math.round(56 + pColor * (255 - 56));
    const g = Math.round(189 - pColor * 189);
    const b = Math.round(248 - pColor * 248);
    const dynamicHex = `rgb(${r}, ${g}, ${b})`;

    if (this.distanceVal) {
      this.distanceVal.textContent = distance !== null ? `${distance.toFixed(2)}m` : '--';
      if (active && (!birthdayState || birthdayState === 'STANDBY')) {
        this.distanceVal.style.color = dynamicHex;
      } else {
        this.distanceVal.style.color = '';
      }
    }

    if (this.energyBar) {
      let percent = Math.min(100, Math.max(0, Math.round(proximity * 100)));
      if (birthdayState === 'CHARGING' || birthdayState === 'TRANSITION' || birthdayState === 'CELEBRATION') {
        percent = chargePercent || percent;
      }
      this.energyBar.style.width = `${percent}%`;

      if (!birthdayState || birthdayState === 'STANDBY') {
        if (pColor > 0.05) {
          this.energyBar.style.background = `linear-gradient(90deg, #38bdf8 ${Math.max(0, 100 - percent)}%, #ff2200 ${Math.max(40, 100 - percent / 2)}%, #ff0000 100%)`;
          this.energyBar.style.boxShadow = `0 0 16px ${dynamicHex}`;
        } else {
          this.energyBar.style.background = '';
          this.energyBar.style.boxShadow = '';
        }
      }
    }

    if (this.energyStatusText) {
      if (birthdayState === 'CELEBRATION') {
        this.energyStatusText.textContent = 'HAPPY BIRTHDAY!';
        this.energyStatusText.style.color = '#f4e0ae';
      } else if (birthdayState === 'TRANSITION') {
        this.energyStatusText.textContent = 'SUPERNOVA BURST!';
        this.energyStatusText.style.color = '#ffffff';
      } else if (birthdayState === 'CHARGING') {
        this.energyStatusText.textContent = `CHARGING (${chargePercent}%)`;
        this.energyStatusText.style.color = '#fbbf24';
      } else if (active) {
        const pathStr = data.chainPathStr ? ` [${data.chainPathStr}]` : '';
        this.energyStatusText.textContent = pColor > 0.5 ? `OVERLOAD LINK${pathStr}` : `CONDUCTION${pathStr}`;
        this.energyStatusText.style.color = dynamicHex;
      } else {
        this.energyStatusText.textContent = 'STANDBY';
        this.energyStatusText.style.color = '#94a3b8';
      }
    }
  }
}
