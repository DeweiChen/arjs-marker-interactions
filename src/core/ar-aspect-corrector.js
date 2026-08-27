/**
 * AR.js Aspect Ratio & Projection Matrix Corrector System
 * Mathematically compensates for viewport aspect ratio cropping to eliminate
 * stretching distortion in mobile portrait and ultra-wide landscape modes.
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
 * Mathematically corrects the AR projection matrix to compensate for viewport aspect ratio cropping.
 * Eliminates the horizontal/vertical stretch distortion in mobile portrait & ultra-wide landscape.
 *
 * @param {THREE.Matrix4} originalMatrix - Raw projection matrix from ARToolKit
 * @param {HTMLVideoElement} videoEl - Active camera video element
 * @param {Object} arSource - Active AR.js source instance
 * @returns {THREE.Matrix4} Corrected projection matrix matching visible screen viewport
 */
export function calculateCorrectedProjectionMatrix(originalMatrix, videoEl, arSource) {
  if (!originalMatrix || !originalMatrix.elements) return originalMatrix;

  const Ws = window.innerWidth;
  const Hs = window.innerHeight;
  if (Ws <= 0 || Hs <= 0) return originalMatrix;

  const Wv = (videoEl && videoEl.videoWidth > 0) ? videoEl.videoWidth : ((arSource && arSource.parameters && arSource.parameters.sourceWidth) || 1280);
  const Hv = (videoEl && videoEl.videoHeight > 0) ? videoEl.videoHeight : ((arSource && arSource.parameters && arSource.parameters.sourceHeight) || 720);

  if (Wv <= 0 || Hv <= 0) return originalMatrix;

  const Rs = Ws / Hs; // Viewport aspect ratio (e.g. 0.46 on mobile portrait)
  const Rv = Wv / Hv; // Camera stream aspect ratio (e.g. 1.777 for 16:9)

  const corrected = originalMatrix.clone();
  const el = corrected.elements;

  if (Rs < Rv) {
    // Portrait mode (or screen taller/narrower than camera stream):
    // Multiply horizontal focal scale (el[0]) and principal point x (el[8]) by 1 / kx:
    const kx = Rs / Rv;
    el[0] /= kx;
    el[8] /= kx;
  } else if (Rs > Rv) {
    // Ultra-wide Landscape mode (or screen wider than camera stream):
    // Multiply vertical focal scale (el[5]) and principal point y (el[9]) by 1 / ky:
    const ky = Rv / Rs;
    el[5] /= ky;
    el[9] /= ky;
  }

  return corrected;
}

/**
 * Initializes listeners for AR.js projection matrix update overrides.
 *
 * @param {HTMLElement} sceneEl - A-Frame scene element
 */
export function initARAspectCorrection(sceneEl) {
  let isCorrectionInitialized = false;

  function applyCorrection() {
    const { arContext, arSource, video } = getARObjects(sceneEl);
    if (!arContext) return;

    if (!arContext._rawGetProjectionMatrix) {
      arContext._rawGetProjectionMatrix = arContext.getProjectionMatrix;
      arContext.getProjectionMatrix = function () {
        const rawMat = arContext._rawGetProjectionMatrix.call(arContext);
        return calculateCorrectedProjectionMatrix(rawMat, video, arSource);
      };
    }

    if (sceneEl.camera) {
      const rawMat = arContext._rawGetProjectionMatrix ? arContext._rawGetProjectionMatrix.call(arContext) : arContext.getProjectionMatrix();
      sceneEl.camera.projectionMatrix = calculateCorrectedProjectionMatrix(rawMat, video, arSource);
      sceneEl.camera.projectionMatrixInverse.copy(sceneEl.camera.projectionMatrix).invert();
    }
  }

  function tryInit() {
    if (isCorrectionInitialized) return;
    const { arContext } = getARObjects(sceneEl);
    if (!arContext) return;

    isCorrectionInitialized = true;
    applyCorrection();
  }

  sceneEl.addEventListener('loaded', () => {
    tryInit();
    setTimeout(tryInit, 500);
    setTimeout(tryInit, 1500);
  });

  window.addEventListener('resize', () => {
    applyCorrection();
  });

  // Fallback timer checks
  setTimeout(tryInit, 1000);
  setTimeout(tryInit, 2500);
}
