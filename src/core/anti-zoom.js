/**
 * Anti-Zoom Protection System
 * Prevents unintended gesture scaling, pinch zooming, and keyboard zoom shortcuts on desktop & mobile.
 */

export function initAntiZoomProtection() {
  // 1. Prevent iOS gesture-based zooming (Pinch / Rotate gesture on Safari)
  const preventGesture = (e) => {
    e.preventDefault();
  };
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  // 2. Prevent multi-touch pinch zoom on document touchmove
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // 3. Prevent rapid double-tap to zoom on mobile browsers
  let lastTouchTime = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (now - lastTouchTime <= 300) {
      e.preventDefault();
      // Trigger click if it was an interactive button so button actions remain responsive
      if (e.target && typeof e.target.click === 'function' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.target.click();
      }
    }
    lastTouchTime = now;
  }, { passive: false });

  // 4. Prevent Ctrl / Meta + Wheel zoom on desktop browsers
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // 5. Prevent keyboard zoom shortcuts (Ctrl/Cmd +/-/0)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '0')) {
      e.preventDefault();
    }
  }, { passive: false });
}
