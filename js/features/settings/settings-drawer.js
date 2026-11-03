/* Mobile Settings Flyout Drawer */

import { $ } from "../../utils/dom.js";

export function initSettingsDrawer(onLayoutChange) {
  const utilities = $("utilities");
  const settingsToggle = $("mobileSettings");
  const mobileLayout = matchMedia("(max-width: 760px)");

  if (!utilities || !settingsToggle) return;

  function setUtilitiesOpen(open) {
    const isOpen = open && mobileLayout.matches;
    utilities.classList.toggle("is-open", isOpen);
    settingsToggle.setAttribute("aria-expanded", String(isOpen));
  }

  let lastSettingsToggleTime = 0;
  function handleSettingsToggle() {
    const now = performance.now();
    if (now - lastSettingsToggleTime < 300) return;
    lastSettingsToggleTime = now;
    setUtilitiesOpen(settingsToggle.getAttribute("aria-expanded") !== "true");
  }

  settingsToggle.addEventListener("pointerdown", handleSettingsToggle);
  settingsToggle.addEventListener("click", handleSettingsToggle);

  function handleOutsideDismiss(e) {
    if (mobileLayout.matches && !utilities.contains(e.target) && !settingsToggle.contains(e.target)) {
      setUtilitiesOpen(false);
    }
  }

  document.addEventListener("pointerdown", handleOutsideDismiss);
  document.addEventListener("click", handleOutsideDismiss);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && settingsToggle.getAttribute("aria-expanded") === "true") {
      setUtilitiesOpen(false);
      settingsToggle.focus({ preventScroll: true });
    }
  });

  mobileLayout.addEventListener("change", () => {
    setUtilitiesOpen(false);
    if (onLayoutChange) onLayoutChange();
  });
}

