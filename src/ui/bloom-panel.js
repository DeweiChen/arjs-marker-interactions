/**
 * 2D Bloom FX Glassmorphic Control Panel & DPR Controller
 * Manages master bloom toggles, strength sliders, DPR resolution scaling,
 * real-time resolution telemetry displays, and pitch facing preferences.
 */

export class BloomPanelController {
  constructor(sceneEl, isDebug = false) {
    this.sceneEl = sceneEl;
    this.isDebug = isDebug;
    this.telemetryInterval = null;

    // DOM Elements
    this.btnToggleBloom = document.getElementById('btn-toggle-bloom');
    this.bloomPanel = document.getElementById('bloom-control-panel');
    this.btnCloseBloom = document.getElementById('btn-close-bloom');
    this.btnResetBloom = document.getElementById('btn-reset-bloom');

    this.chkMasterBloom = document.getElementById('chk-master-bloom');
    this.valBloomStatus = document.getElementById('val-bloom-status');
    this.sliderBloomStrength = document.getElementById('slider-bloom-strength');
    this.valBloomStrength = document.getElementById('val-bloom-strength');
    this.presetBtns = document.querySelectorAll('.bloom-preset-btn');

    this.sliderPulseRange = document.getElementById('slider-pulse-range');
    this.valPulseRange = document.getElementById('val-pulse-range');
    this.pulsePresetBtns = document.querySelectorAll('.pulse-preset-btn');

    this.chkDynamicIntensity = document.getElementById('chk-dynamic-intensity');
    this.chkPitchFacing = document.getElementById('chk-pitch-facing');

    this.valDpr = document.getElementById('val-dpr');
    this.dprBtns = document.querySelectorAll('.dpr-preset-btn');
    this.resRenderPx = document.getElementById('res-render-px');
    this.resRenderMp = document.getElementById('res-render-mp');
    this.resCameraPx = document.getElementById('res-camera-px');
    this.resCameraMp = document.getElementById('res-camera-mp');

    this.currentDprSetting = localStorage.getItem('ar_custom_dpr') || 'native';

    this._bindEvents();
    this.setDebugMode(this.isDebug);
  }

  setDebugMode(enabled) {
    this.isDebug = !!enabled;

    if (this.btnToggleBloom) {
      this.btnToggleBloom.classList.toggle('hidden', !this.isDebug);
    }
    if (!this.isDebug && this.bloomPanel) {
      this.bloomPanel.classList.add('hidden');
      if (this.btnToggleBloom) {
        this.btnToggleBloom.setAttribute('aria-expanded', 'false');
      }
    }

    if (this.isDebug) {
      if (!this.telemetryInterval) {
        this._startResolutionTelemetry();
      }
    } else {
      if (this.telemetryInterval) {
        clearInterval(this.telemetryInterval);
        this.telemetryInterval = null;
      }
    }
  }

  _bindEvents() {
    if (this.btnToggleBloom && this.bloomPanel) {
      this.btnToggleBloom.addEventListener('click', () => {
        const isHidden = this.bloomPanel.classList.toggle('hidden');
        this.btnToggleBloom.setAttribute('aria-expanded', !isHidden);
      });
    }

    if (this.btnCloseBloom && this.bloomPanel) {
      this.btnCloseBloom.addEventListener('click', () => {
        this.bloomPanel.classList.add('hidden');
        if (this.btnToggleBloom) this.btnToggleBloom.setAttribute('aria-expanded', 'false');
      });
    }

    if (this.chkMasterBloom) {
      this.chkMasterBloom.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (this.valBloomStatus) {
          this.valBloomStatus.textContent = enabled ? 'ON' : 'OFF';
          this.valBloomStatus.className = `bloom-status-badge ${enabled ? 'status-active' : 'status-disabled'}`;
        }
        this.sceneEl.emit('set-bloom-enabled', { enabled });
      });
    }

    if (this.sliderBloomStrength) {
      this.sliderBloomStrength.addEventListener('input', (e) => {
        const str = parseFloat(e.target.value);
        if (this.valBloomStrength) this.valBloomStrength.textContent = `${str.toFixed(2)}x`;
        this.sceneEl.emit('set-bloom-strength', { strength: str });
      });
    }

    this.presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.strength);
        if (this.sliderBloomStrength) this.sliderBloomStrength.value = val;
        if (this.valBloomStrength) this.valBloomStrength.textContent = `${val.toFixed(2)}x`;
        this.presetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.sceneEl.emit('set-bloom-strength', { strength: val });
      });
    });

    if (this.sliderPulseRange) {
      this.sliderPulseRange.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.valPulseRange) this.valPulseRange.textContent = `±${val.toFixed(2)}x`;
        this.sceneEl.emit('set-bloom-pulse-range', { pulseRange: val });
      });
    }

    this.pulsePresetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.pulse);
        if (this.sliderPulseRange) this.sliderPulseRange.value = val;
        if (this.valPulseRange) this.valPulseRange.textContent = `±${val.toFixed(2)}x`;
        this.pulsePresetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.sceneEl.emit('set-bloom-pulse-range', { pulseRange: val });
      });
    });

    if (this.chkDynamicIntensity) {
      this.chkDynamicIntensity.addEventListener('change', (e) => {
        this.sceneEl.emit('set-bloom-dynamic-intensity', { enabled: e.target.checked });
      });
    }

    if (this.chkPitchFacing) {
      this.chkPitchFacing.addEventListener('change', (e) => {
        this.sceneEl.emit('set-text-pitch-facing', { enabled: e.target.checked });
      });
    }

    this.dprBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dprVal = btn.dataset.dpr;
        this.currentDprSetting = dprVal;
        localStorage.setItem('ar_custom_dpr', dprVal);
        this.dprBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.applyDprSetting(dprVal);
      });
    });
  }

  applyDprSetting(setting) {
    const renderer = this.sceneEl.renderer;
    if (!renderer) return;

    let targetDpr = window.devicePixelRatio || 1;
    if (setting !== 'native') {
      targetDpr = parseFloat(setting);
    }

    renderer.setPixelRatio(targetDpr);
    if (this.valDpr) {
      this.valDpr.textContent = setting === 'native' ? `Native (${(window.devicePixelRatio || 1).toFixed(1)}x)` : `${targetDpr.toFixed(1)}x`;
    }
  }

  _startResolutionTelemetry() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
    }
    this.telemetryInterval = setInterval(() => {
      if (!this.isDebug) return;

      const renderer = this.sceneEl.renderer;
      if (renderer) {
        const size = new THREE.Vector2();
        renderer.getSize(size);
        const dpr = renderer.getPixelRatio();
        const rw = Math.round(size.width * dpr);
        const rh = Math.round(size.height * dpr);
        const mp = ((rw * rh) / 1000000).toFixed(2);

        if (this.resRenderPx) this.resRenderPx.textContent = `${rw} × ${rh} px`;
        if (this.resRenderMp) this.resRenderMp.textContent = `${mp} MP`;
      }

      const video = document.querySelector('#arjs-video') || document.querySelector('video');
      if (video && video.videoWidth > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const vmp = ((vw * vh) / 1000000).toFixed(2);
        if (this.resCameraPx) this.resCameraPx.textContent = `${vw} × ${vh} px`;
        if (this.resCameraMp) this.resCameraMp.textContent = `${vmp} MP`;
      }
    }, 1000);
  }
}
