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
 * Robustly handles device orientation changes.
 */
function handleOrientationChange() {
  let lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  
  window.addEventListener('resize', () => {
    const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    if (currentOrientation !== lastOrientation) {
      lastOrientation = currentOrientation;
      
      // Immediately hide AR elements to prevent visual glitches (offset/scaling) during re-initialization
      const video = document.querySelector('#arjs-video') || document.querySelector('video');
      const canvas = document.querySelector('.a-canvas');
      if (video) video.style.display = 'none';
      if (canvas) canvas.style.display = 'none';
      
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = '#000';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.color = '#fff';
      overlay.style.fontFamily = 'monospace';
      overlay.style.fontSize = '14px';
      overlay.innerHTML = `
        <div style="text-align: center;">
          <div style="margin-bottom: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.25 5.25"/>
            </svg>
          </div>
          <div>Calibrating AR Sensors...</div>
        </div>
      `;
      document.body.appendChild(overlay);
      
      setTimeout(() => {
        window.location.reload();
      }, 300); // Reduced delay to make it feel faster
    }
  });
}

/**
 * Initializes listeners for AR.js projection matrix update overrides.
 */
export function initARAspectCorrection(sceneEl) {
  console.log('[ARCorrector] Initializing Seamless AR.js Portrait Bug Fix.');

  handleOrientationChange();

  function applyCorrection() {
    ensureARVideoPlaying();

    const { arContext, video } = getARObjects(sceneEl);
    
    // Canvas Alignment Hack
    const canvas = sceneEl.canvas || document.querySelector('.a-canvas');
    if (video && canvas && parseInt(video.style.width) > 0) {
      const vWidth = parseInt(video.style.width);
      const vHeight = parseInt(video.style.height);
      
      canvas.style.setProperty('width', video.style.width, 'important');
      canvas.style.setProperty('height', video.style.height, 'important');
      canvas.style.setProperty('margin-left', video.style.marginLeft || '0px', 'important');
      canvas.style.setProperty('margin-top', video.style.marginTop || '0px', 'important');
      
      if (sceneEl.renderer && sceneEl.renderer.setSize) {
        // Only call setSize if the size actually changed to avoid unnecessary re-allocations
        const currentSize = new THREE.Vector2();
        sceneEl.renderer.getSize(currentSize);
        if (currentSize.x !== vWidth || currentSize.y !== vHeight) {
          sceneEl.renderer.setSize(vWidth, vHeight, false);
        }
      }
    }

    // EARLY PATCH INJECTION
    if (arContext && !arContext._rawGetProjectionMatrix) {
      arContext._rawGetProjectionMatrix = arContext.getProjectionMatrix;
      arContext.getProjectionMatrix = function () {
        try {
          const rawMat = arContext._rawGetProjectionMatrix.call(arContext);
          // Safety check: Don't scale if the matrix isn't valid yet
          if (!rawMat || !rawMat.elements || isNaN(rawMat.elements[0]) || rawMat.elements[0] === 1) {
            return rawMat;
          }
          return calculateCorrectedProjectionMatrix(rawMat);
        } catch (e) {
          return null;
        }
      };
      console.log('[ARCorrector] arContext.getProjectionMatrix successfully proxied.');
    }

    if (sceneEl.camera) {
      if (!sceneEl.camera._isARPatched) {
        sceneEl.camera._isARPatched = true;
        const originalUpdate = sceneEl.camera.updateProjectionMatrix.bind(sceneEl.camera);
        sceneEl.camera.updateProjectionMatrix = function () {
          const { arContext: ctx } = getARObjects(sceneEl);
          if (ctx && ctx._rawGetProjectionMatrix) {
            try {
              const rawMat = ctx._rawGetProjectionMatrix.call(ctx);
              if (rawMat && rawMat.elements && !isNaN(rawMat.elements[0])) {
                this.projectionMatrix = calculateCorrectedProjectionMatrix(rawMat);
                this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
                return;
              }
            } catch (e) {}
          }
          originalUpdate();
        };
        console.log('[ARCorrector] A-Frame camera.updateProjectionMatrix successfully proxied.');
      }
      
      // Force immediate re-evaluation if matrix is ready
      if (arContext && arContext._rawGetProjectionMatrix) {
          try {
            const rawMat = arContext._rawGetProjectionMatrix.call(arContext);
            if (rawMat && rawMat.elements && !isNaN(rawMat.elements[0]) && rawMat.elements[0] !== 1) {
              sceneEl.camera.projectionMatrix = calculateCorrectedProjectionMatrix(rawMat);
              sceneEl.camera.projectionMatrixInverse.copy(sceneEl.camera.projectionMatrix).invert();
            }
          } catch(e) {}
      }
    }
  }

  // Setup ResizeObserver to continuously lock canvas size to video size
  // This completely eliminates any scaling deviation (time gaps) caused by A-Frame/AR.js fighting
  const observer = new ResizeObserver(() => {
    applyCorrection();
  });

  const attachObserver = () => {
    const { video } = getARObjects(sceneEl);
    if (video && !video._isObservedByARCorrector) {
      video._isObservedByARCorrector = true;
      observer.observe(video);
    }
  };

  sceneEl.addEventListener('loaded', () => {
    applyCorrection();
    attachObserver();
  });
  sceneEl.addEventListener('camera-init', () => {
    applyCorrection();
    attachObserver();
  });
  window.addEventListener('arjs-video-loaded', () => {
    applyCorrection();
    attachObserver();
  });
  
  // Fallback initial poll just in case events are missed
  let attempts = 0;
  function initialPoll() {
    applyCorrection();
    attachObserver();
    attempts++;
    if (attempts < 60) {
      requestAnimationFrame(initialPoll);
    }
  }
  initialPoll();

  window.addEventListener('resize', () => {
    setTimeout(applyCorrection, 50);
  });
}
