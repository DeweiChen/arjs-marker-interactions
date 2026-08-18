import { ARScene } from './ar-scene.js';

// 初始化 AR 場景
async function bootstrap() {
  const loadingOverlay = document.getElementById('loading-overlay');

  try {
    const arScene = new ARScene('ar-container');
    await arScene.init();

    // 隱藏載入中畫面
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }

    // 啟動主渲染迴圈
    arScene.startLoop();
    console.log('AR.js + Three.js Core Scene initialized successfully!');
  } catch (error) {
    console.error('AR initialization error:', error);
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div class="loading-card" style="border-color: #f43f5e;">
          <h2 style="color: #f43f5e;">攝影機啟動失敗</h2>
          <p>${error.message || '請確認已授權攝影機權限，且連線支援 HTTPS。'}</p>
          <button onclick="location.reload()" class="hud-btn" style="margin-top: 12px;">重新嘗試</button>
        </div>
      `;
    }
  }
}

// 綁定 UI 互動（查看 Marker 圖檔彈窗）
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
