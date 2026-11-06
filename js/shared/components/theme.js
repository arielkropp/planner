/* Theme Management (Light / Dark mode) */

export function initTheme({ signal } = {}) {
  const prefersDark = matchMedia("(prefers-color-scheme: dark)");
  prefersDark.addEventListener("change", e => {
    try {
      if (!localStorage.getItem("arg-theme")) {
        document.documentElement.dataset.theme = e.matches ? "dark" : "light";
      }
    } catch {}
  }, { signal });

  document.addEventListener("click", e => {
    const btn = e.target.closest("#theme");
    if (!btn) return;
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("arg-theme", next);
    } catch {}
  }, { signal });
}

