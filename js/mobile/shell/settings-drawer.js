/* Settings Flyout Drawer (the mobile layout keeps the utilities behind a Settings button) */

import { $ } from "../../shared/utils/dom.js";

export function initSettingsDrawer({ signal } = {}) {
  const utilities = $("utilities");
  const settingsToggle = $("mobileSettings");

  if (!utilities || !settingsToggle) return;

  function setUtilitiesOpen(open) {
    utilities.classList.toggle("is-open", open);
    settingsToggle.setAttribute("aria-expanded", String(open));
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
    if (!utilities.contains(e.target) && !settingsToggle.contains(e.target)) {
      setUtilitiesOpen(false);
    }
  }

  document.addEventListener("pointerdown", handleOutsideDismiss, { signal });
  document.addEventListener("click", handleOutsideDismiss, { signal });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && settingsToggle.getAttribute("aria-expanded") === "true") {
      setUtilitiesOpen(false);
      settingsToggle.focus({ preventScroll: true });
    }
  }, { signal });
}
