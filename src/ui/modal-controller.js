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

  /**
   * Dynamically update markers modal content and badges to reflect current active profile
   *
   * @param {string} profileId - Current active profile identifier
   * @param {Object} profile - Current active profile configuration object
   * @param {Object} defaultProfile - Default profile configuration object
   */
  updateProfileInfo(profileId, profile = {}, defaultProfile = {}) {
    if (!profile) return;

    // Update Profile Name badge in modal header
    const profileNameEl = document.getElementById('modal-profile-name');
    if (profileNameEl) {
      profileNameEl.textContent = profile.name || profileId;
    }

    const defaultMarkers = defaultProfile.markers || {};
    const targetNodes = profile.interaction?.targetNodes || [];

    const COLOR_NAMES = {
      0: 'Deep Blue',
      1: 'Morandi Green',
      2: 'Flame Red',
      3: 'Sunset Orange',
      4: 'Electric Yellow',
      5: 'Herb Green',
      6: 'Cyber Violet',
      7: 'Pure White'
    };

    for (let i = 0; i <= 7; i++) {
      const markerId = String(i);
      const markerData = (profile.markers && profile.markers[markerId]) ||
                         (defaultMarkers && defaultMarkers[markerId]) ||
                         { text: markerId, color: '#ffffff', emissive: '#ffffff' };

      const markerItemEl = document.getElementById(`modal-marker-item-${markerId}`);
      if (markerItemEl) {
        const titleEl = markerItemEl.querySelector('.marker-title');
        const badgeEl = markerItemEl.querySelector('.marker-text-badge');
        const terminalBadge = markerItemEl.querySelector('.marker-terminal-badge');
        const colorName = COLOR_NAMES[i] || '';

        if (titleEl) {
          titleEl.textContent = `Barcode ${i} (${colorName})`;
        }
        if (badgeEl) {
          badgeEl.textContent = `"${markerData.text}"`;
          if (markerData.color) {
            badgeEl.style.borderColor = markerData.color;
            badgeEl.style.color = markerData.color;
          }
        }

        const isTarget = targetNodes.includes(i);
        markerItemEl.classList.toggle('target-terminal', isTarget);
        if (terminalBadge) {
          terminalBadge.classList.toggle('hidden', !isTarget);
        }
      }
    }
  }
}
