/* ============================================================
   GitScope — theme handling (light/dark with persistence)
   ============================================================ */
(function () {
  const STORAGE_KEY = "gitscope-theme";

  function applyTheme(theme) {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    html.style.colorScheme = theme;

    // The label shows the theme you would switch TO
    const label = document.getElementById("themeLabel");
    if (label) {
      label.textContent = theme === "dark" ? "light" : "dark";
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  // Expose toggle globally (used by the header button)
  window.toggleTheme = function () {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* storage unavailable — theme still switches for this session */
    }
  };

  // Initial theme: saved preference wins, otherwise follow the OS
  // (respects prefers-color-scheme on first visit)
  document.addEventListener("DOMContentLoaded", function () {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  });
})();
