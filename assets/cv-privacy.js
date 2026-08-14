
/* Hide CV links site-wide when CV_HIDDEN is true in config.js */
(function () {
  "use strict";
  if (!window.CV_HIDDEN) return;

  function hide(el) {
    if (el) el.remove();
  }

  document.querySelectorAll(
    'a[href*="cv.html"], a[href*="Thomas-Gollogly-CV"], a[aria-label="CV"]'
  ).forEach(hide);

  document.querySelectorAll('a.navlink[href="cv.html"], a.btn-ghost[href="cv.html"]').forEach(hide);
})();
