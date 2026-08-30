/**
 * Modal & Audio Controller
 * Manages marker pattern dialogs, celebration reset, and audio toggle controls.
 */

export class ModalController {
  constructor(sceneEl) {
    this.sceneEl = sceneEl;

    this.btnShowMarkers = document.getElementById('btn-show-markers');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.modalBackdrop = document.getElementById('markers-modal');

    this.btnResetBday = document.getElementById('btn-reset-bday');
    this.btnToggleAudio = document.getElementById('btn-toggle-audio');
    this.iconAudioOn = document.getElementById('icon-audio-on');
    this.iconAudioOff = document.getElementById('icon-audio-off');
    this.audioHudDot = document.getElementById('audio-hud-dot');
    this.audioBtnText = document.getElementById('audio-btn-text');

    this.isAudioPlaying = false;

    this._bindEvents();
  }

  _bindEvents() {
    if (this.btnShowMarkers && this.modalBackdrop) {
      this.btnShowMarkers.addEventListener('click', () => {
        this.modalBackdrop.classList.remove('hidden');
      });
    }

    if (this.btnCloseModal && this.modalBackdrop) {
      this.btnCloseModal.addEventListener('click', () => {
        this.modalBackdrop.classList.add('hidden');
      });
    }

    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === this.modalBackdrop) {
          this.modalBackdrop.classList.add('hidden');
        }
      });
    }

    if (this.btnResetBday) {
      this.btnResetBday.addEventListener('click', () => {
        this.sceneEl.emit('reset-birthday');
        this.setAudioButtonVisible(false);
        this.updateAudioState(false);
      });
    }

    if (this.btnToggleAudio) {
      this.btnToggleAudio.addEventListener('click', () => {
        this.sceneEl.emit('toggle-audio');
      });
    }

    window.addEventListener('birthday-audio-state', (e) => {
      if (e.detail) {
        this.updateAudioState(e.detail.isPlaying);
      }
    });
  }

  setResetButtonVisible(visible) {
    if (this.btnResetBday) {
      this.btnResetBday.classList.toggle('hidden', !visible);
    }
  }

  setAudioButtonVisible(visible) {
    if (this.btnToggleAudio) {
      this.btnToggleAudio.classList.toggle('hidden', !visible);
    }
  }

  updateAudioState(isPlaying) {
    this.isAudioPlaying = !!isPlaying;
    if (!this.btnToggleAudio) return;

    this.btnToggleAudio.classList.toggle('playing', this.isAudioPlaying);
    this.btnToggleAudio.classList.toggle('paused', !this.isAudioPlaying);

    if (this.iconAudioOn) {
      this.iconAudioOn.classList.toggle('hidden', !this.isAudioPlaying);
    }
    if (this.iconAudioOff) {
      this.iconAudioOff.classList.toggle('hidden', this.isAudioPlaying);
    }
    if (this.audioHudDot) {
      this.audioHudDot.classList.toggle('active', this.isAudioPlaying);
    }

    this.btnToggleAudio.title = this.isAudioPlaying ? 'Mute Music' : 'Play Music';
  }
}
