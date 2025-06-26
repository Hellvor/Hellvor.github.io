// scanlines.js
// Adds animated scanlines overlay to all elements with .melanin-fallout-terminal

(function() {
  function addScanlines(el) {
    // Prevent duplicate overlays
    if (el.querySelector('.scanlines-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'scanlines-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 10,
      background: 'repeating-linear-gradient(to bottom, rgba(60,255,80,0.10) 0px, rgba(60,255,80,0.10) 1px, transparent 1.5px, transparent 4px)',
      animation: 'scanline-move 2s linear infinite',
      mixBlendMode: 'lighten'
    });
    el.style.position = 'relative';
    el.appendChild(overlay);
  }

  function initScanlines() {
    document.querySelectorAll('.melanin-fallout-terminal').forEach(addScanlines);
  }

  // Add the keyframes to the document if not present
  function ensureScanlineKeyframes() {
    if (!document.getElementById('scanline-keyframes')) {
      const style = document.createElement('style');
      style.id = 'scanline-keyframes';
      style.textContent = `
        @keyframes scanline-move {
          0% { background-position-y: 0; }
          100% { background-position-y: 4px; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  ensureScanlineKeyframes();
  // Run on DOM load
  if (document.readyState !== 'loading') {
    initScanlines();
  } else {
    document.addEventListener('DOMContentLoaded', initScanlines);
  }
})();
