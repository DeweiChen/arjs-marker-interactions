/**
 * AR.js Aspect Ratio & Projection Matrix Corrector System
 *
 * Mathematically compensates for the known AR.js / ARToolKit portrait 
 * distortion bug by applying an empirical FOV scale correction.
 */

export function getARObjects(sceneEl) {
  const arSystem = sceneEl && sceneEl.systems && sceneEl.systems.arjs;
  const arSession = arSystem && (arSystem._arSession || arSystem);
  const arSource = arSession && (arSession.arSource || arSystem.arSource);
  const arContext = arSession && (arSession.arContext || arSystem.arContext);
  const video = (arSource && arSource.domElement) || document.querySelector('#arjs-video') || document.querySelector('video');
  return { arSystem, arSession, arSource, arContext, video };
}

/**
 * Ensures active playback of the AR.js webcam stream.
 */
export function ensureARVideoPlaying() {
  const video = document.querySelector('#arjs-video') || document.querySelector('video');
  if (!video) return;

  if (video.paused || video.ended || video.readyState < 2) {
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const resumeOnUserInteraction = () => {
          const v = document.querySelector('#arjs-video') || document.querySelector('video');
          if (v && v.paused) {
            v.play().catch(() => {});
          }
          window.removeEventListener('pointerdown', resumeOnUserInteraction);
          window.removeEventListener('touchstart', resumeOnUserInteraction);
          window.removeEventListener('click', resumeOnUserInteraction);
        };
        window.addEventListener('pointerdown', resumeOnUserInteraction, { once: true });
        window.addEventListener('touchstart', resumeOnUserInteraction, { once: true });
        window.addEventListener('click', resumeOnUserInteraction, { once: true });
      });
    }
  }
}

/**
 * Corrects the projection matrix by applying the tuned multiplier (kx = 2.0)
 * which fixes the ARToolKit portrait horizontal shrink bug.
 */
export function calculateCorrectedProjectionMatrix(originalMatrix) {
  if (!originalMatrix || !originalMatrix.elements) return originalMatrix;
  
  const corrected = originalMatrix.clone();
  const el = corrected.elements;
  
  const Ws = window.innerWidth;
  const Hs = window.innerHeight;
  
  if (Hs > Ws) {
    // PORTRAIT MODE FIX
    // Apply empirical 2.0x horizontal FOV scale found via manual tuning.
    // This perfectly counteracts the AR.js / iOS Retina portrait inward shrink bug.
    el[0] *= 2.0;
    el[8] *= 2.0;
  }
  
  return corrected;
}

/**
 * Initializes listeners for AR.js projection matrix update overrides and camera stream watchdog.
 * Also forces the canvas to match the video sizing.
 */
export function initARAspectCorrection(sceneEl) {
  let isCorrectionInitialized = false;

  console.log('[ARCorrector] Initializing AR.js Portrait Bug Fix.');

  function applyCorrection() {
    ensureARVideoPlaying();

    const { arContext, arSource, video } = getARObjects(sceneEl);
    
    // Canvas Alignment Hack (backup for older devices)
    const canvas = sceneEl.canvas || document.querySelector('.a-canvas');
    if (video && canvas && parseInt(video.style.width) > 0) {
      canvas.style.setProperty('width', video.style.width, 'important');
      canvas.style.setProperty('height', video.style.height, 'important');
      canvas.style.setProperty('margin-left', video.style.marginLeft || '0px', 'important');
      canvas.style.setProperty('margin-top', video.style.marginTop || '0px', 'important');
      
      if (sceneEl.renderer && sceneEl.renderer.setSize) {
        sceneEl.renderer.setSize(parseInt(video.style.width), parseInt(video.style.height), false);
      }
    }

    if (!arContext) return;
    const arController = arContext.arController || arContext._arController;
    if (!arController) return;

    if (!arContext._rawGetProjectionMatrix) {
      arContext._rawGetProjectionMatrix = arContext.getProjectionMatrix;
      arContext.getProjectionMatrix = function () {
        if (!arContext.arController && !arContext._arController) return null;
        try {
          const rawMat = arContext._rawGetProjectionMatrix.call(arContext);
          if (!rawMat) return null;
          return calculateCorrectedProjectionMatrix(rawMat);
        } catch (e) {
          return null;
        }
      };
    }

    if (sceneEl.camera) {
      if (!sceneEl.camera._isARPatched) {
        sceneEl.camera._isARPatched = true;
        const originalUpdate = sceneEl.camera.updateProjectionMatrix.bind(sceneEl.camera);
        sceneEl.camera.updateProjectionMatrix = function () {
          const { arContext: ctx } = getARObjects(sceneEl);
          const ctrl = ctx && (ctx.arController || ctx._arController);
          if (ctx && ctrl && ctx._rawGetProjectionMatrix) {
            try {
              const rawMat = ctx._rawGetProjectionMatrix.call(ctx);
              if (rawMat) {
                this.projectionMatrix = calculateCorrectedProjectionMatrix(rawMat);
                this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
                return;
              }
            } catch (e) {}
          }
          originalUpdate();
        };
      }

      try {
        const rawMat = arContext._rawGetProjectionMatrix ? arContext._rawGetProjectionMatrix.call(arContext) : arContext.getProjectionMatrix();
        if (rawMat) {
          sceneEl.camera.projectionMatrix = calculateCorrectedProjectionMatrix(rawMat);
          sceneEl.camera.projectionMatrixInverse.copy(sceneEl.camera.projectionMatrix).invert();
        }
      } catch (e) {}
    }
  }

  function tryInit() {
    if (isCorrectionInitialized) {
      applyCorrection();
      return;
    }
    isCorrectionInitialized = true;
    applyCorrection();
  }

  sceneEl.addEventListener('loaded', () => tryInit());
  sceneEl.addEventListener('camera-init', () => tryInit());
  window.addEventListener('arjs-video-loaded', () => tryInit());
  window.addEventListener('resize', () => applyCorrection());

  setInterval(tryInit, 1000);
}
