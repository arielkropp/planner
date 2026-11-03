/* Trip Planner - Main Application Entry */

import { initStore, subscribe } from "./state/store.js";
import { initDialogs } from "./components/dialog.js";
import { initTheme } from "./components/theme.js";
import { initItinerary, renderItinerary, requestCloseItemDialog, updateItineraryLens, itineraryView } from "./features/itinerary/itinerary.js";
import { renderCalendar } from "./features/itinerary/itinerary-calendar.js";
import { initPacking, renderPacking } from "./features/packing/packing.js";
import { initWork, renderWorkView } from "./features/work/work.js";
import { initBackup } from "./features/settings/backup.js";
import { initSettingsDrawer } from "./features/settings/settings-drawer.js";
import { initRouter, route, getCurrentRoute } from "./router.js";

// Prevent browser from restoring scroll on refresh
history.scrollRestoration = "manual";

export function renderAll() {
  renderItinerary();
  renderPacking();
  renderWorkView();
}

function init() {
  // 1. Initialize persistent state
  initStore();

  // 2. Subscribe renderers to state changes
  subscribe(() => {
    renderAll();
  });

  // 3. Setup modals with custom close handler for dirty check on itemDialog
  initDialogs({
    itemDialog: () => requestCloseItemDialog()
  });

  // 4. Setup theme
  initTheme();

  // 5. Initialize features
  initItinerary(getCurrentRoute);
  initPacking();
  initWork({
    onRatesChanged: () => renderItinerary()
  });
  initBackup();
  initSettingsDrawer(() => {
    if (itineraryView === "week" || itineraryView === "month") {
      const isMobile = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
      renderCalendar(isMobile);
    }
  });

  // 6. Initialize router and initial view render
  initRouter();
  renderAll();
  route(false);

  // 7. Update visual lens once fonts and layout are ready
  requestAnimationFrame(() => updateItineraryLens(true));
  document.fonts?.ready?.then?.(() => updateItineraryLens(true));
}

// Boot application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

