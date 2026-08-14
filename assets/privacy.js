
/* =====================================================================
   privacy.js — temporary site-wide privacy controls.
   Loaded after config.js on every public page. When PRIVACY_MODE is
   true, hides GitHub/LinkedIn/CV links and personal contact details;
   only the work email remains visible.
   ===================================================================== */
(function () {
  "use strict";
  if (!window.PRIVACY_MODE) return;

  function hide(el) {
    if (el) el.remove();
  }

  function hideAll(sel) {
    document.querySelectorAll(sel).forEach(hide);
  }

  function isSocialOrCvLink(a) {
    var href = (a.getAttribute("href") || "").toLowerCase();
    var label = (a.getAttribute("aria-label") || "").toLowerCase();
    return (
      href.indexOf("github.com") !== -1 ||
      href.indexOf("linkedin.com") !== -1 ||
      href.indexOf("cv.html") !== -1 ||
      href.indexOf("card.html") !== -1 ||
      href.indexOf("thomas-gollogly-cv") !== -1 ||
      href.indexOf(".vcf") !== -1 ||
      href.indexOf(".pkpass") !== -1 ||
      label === "github" ||
      label === "linkedin" ||
      label === "cv"
    );
  }

  // Footer icon links
  hideAll('a.ico[aria-label="GitHub"]');
  hideAll('a.ico[aria-label="LinkedIn"]');
  hideAll('a.ico[aria-label="CV"]');

  // Homepage + CV contact buttons
  hide(document.getElementById("githubBtn"));
  hide(document.getElementById("linkedinBtn"));

  // Any remaining social / CV / card / download links
  document.querySelectorAll("a[href]").forEach(function (a) {
    if (isSocialOrCvLink(a)) hide(a);
  });

  // Phone numbers
  hideAll('a[href^="tel:"]');
  document.querySelectorAll(".cchip, .row, .details .row").forEach(function (el) {
    var text = (el.textContent || "").trim();
    if (/^|^\|Northern Ireland/i.test(text)) hide(el);
  });

  // CV download rows and profile CTAs
  hideAll(".dlrow");
  hideAll('a.navlink[href="cv.html"]');
  hideAll('a.btn-ghost[href="cv.html"]');

  // Homepage location trust row
  document.querySelectorAll(".trust .t").forEach(function (t) {
    var k = t.querySelector(".k");
    if (k && /based/i.test(k.textContent || "")) hide(t);
  });

  // Footer copyright — drop name and location
  document.querySelectorAll(".sitefoot .in > span:first-child").forEach(function (span) {
    span.textContent = "\u00A9 " + new Date().getFullYear() + " tgollogly.dev";
  });

  // Site bar brand — keep TG mark, generic label
  document.querySelectorAll(".brand span, .sitebar .brand span, header .brand span").forEach(function (span) {
    if (/Thomas Gollogly/i.test(span.textContent || "")) span.textContent = "Portfolio";
  });

  // ATS matcher — remove pre-filled personal CV sample
  var cvField = document.getElementById("cv");
  if (cvField && /Thomas Gollogly/i.test(cvField.value || "")) {
    cvField.value = "";
    cvField.placeholder = "Paste your CV here\u2026";
  }

  // ATS matcher attribution
  document.querySelectorAll("p, span, div").forEach(function (el) {
    if (el.children.length === 0 && /^Built by Thomas Gollogly\.?$/i.test((el.textContent || "").trim())) {
      hide(el);
    }
  });
})();
