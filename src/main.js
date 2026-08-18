import { ARScene } from './ar-scene.js';
import { MarkerManager } from './marker-manager.js';

// Bootstrap AR application
async function bootstrap() {
  const loadingOverlay = document.getElementById('loading-overlay');
  const statusHiro = document.getElementById('status-hiro');
  const statusKanji = document.getElementById('status-kanji');

  try {
    // 1. Initialize AR base scene
    const arScene = new ARScene('ar-container');
    await arScene.init();

    // 2. Initialize Marker Manager
    const markerManager = new MarkerManager(arScene);

    // 3. Register Marker 1 (Hiro) and status callbacks
    markerManager.addHiroMarker((isVisible) => {
      if (statusHiro) {
        if (isVisible) {
          statusHiro.classList.add('active');
          statusHiro.querySelector('.status-val').textContent = 'Tracking (Locked)';
        } else {
          statusHiro.classList.remove('active');
          statusHiro.querySelector('.status-val').textContent = 'Waiting for scan...';
        }
      }
    });

    // 4. Register Marker 2 (Kanji) and status callbacks
    markerManager.addKanjiMarker((isVisible) => {
      if (statusKanji) {
        if (isVisible) {
          statusKanji.classList.add('active');
          statusKanji.querySelector('.status-val').textContent = 'Tracking (Locked)';
        } else {
          statusKanji.classList.remove('active');
          statusKanji.querySelector('.status-val').textContent = 'Waiting for scan...';
        }
      }
    });

    // 5. Update marker animations and states per frame
    arScene.onRender((delta, elapsedTime) => {
      markerManager.update(delta, elapsedTime);
    });

    // 6. Hide loading overlay
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }

    // 7. Start render loop
    arScene.startLoop();

    // Expose instance to window for debugging and future extensions
    window.__AR_APP__ = {
      arScene,
      markerManager
    };

    console.log('✅ AR.js + Three.js dual-marker system initialized successfully!');
  } catch (error) {
    console.error('AR initialization error:', error);
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div class="loading-card" style="border-color: #f43f5e;">
          <h2 style="color: #f43f5e;">Camera Initialization Failed</h2>
          <p>${error.message || 'Please grant camera permissions and ensure connection uses HTTPS.'}</p>
          <button onclick="location.reload()" class="hud-btn" style="margin-top: 12px;">Retry</button>
        </div>
      `;
    }
  }
}

// Bind UI interactions (Marker reference modal)
function setupUI() {
  const modal = document.getElementById('markers-modal');
  const btnOpen = document.getElementById('btn-markers-modal');
  const btnClose = document.getElementById('btn-close-modal');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }
}

setupUI();
bootstrap();
