/**
 * Modal & Toast Notification Controller
 * Manages marker pattern dialogs, reset buttons, and mobile toast feedback.
 */

export class ModalController {
  constructor(sceneEl) {
    this.sceneEl = sceneEl;

    this.btnShowMarkers = document.getElementById('btn-show-markers');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.modalBackdrop = document.getElementById('markers-modal');

    this.btnResetBday = document.getElementById('btn-reset-bday');
    this.hudToast = document.getElementById('hud-toast');

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
        this.showToast('Birthday FX State Reset to Standby');
      });
    }
  }

  showToast(message, durationMs = 2500) {
    if (!this.hudToast) return;
    this.hudToast.textContent = message;
    this.hudToast.classList.remove('hidden');
    this.hudToast.classList.add('visible');

    setTimeout(() => {
      this.hudToast.classList.remove('visible');
      setTimeout(() => this.hudToast.classList.add('hidden'), 300);
    }, durationMs);
  }

  setResetButtonVisible(visible) {
    if (this.btnResetBday) {
      this.btnResetBday.classList.toggle('hidden', !visible);
    }
  }
}
