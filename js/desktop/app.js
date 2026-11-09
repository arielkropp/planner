/* Desktop UI: sidebar layout, hover affordances and full calendar grids */

import { subscribe } from "../shared/state/store.js";
import { viewState } from "../shared/state/view-state.js";
import { initDialogs } from "../shared/components/dialog.js";
import { initTheme } from "../shared/components/theme.js";
import { initRouter, route, getCurrentRoute } from "../shared/router.js";
import {
  initItinerary,
  renderItinerary,
  requestCloseItemDialog,
  requestCloseFsDialog,
  setItineraryView,
  updateItineraryLens,
  itineraryRouteAdapter
} from "./screens/itinerary/index.js";
import { initPacking, renderPacking, updatePackLens } from "./screens/packing/index.js";
import { initWork, renderWork } from "./screens/work/index.js";
import { initBackupControls } from "./shell/backup-controls.js";
import { initTripControls, renderTripsList } from "../shared/components/trips-ui.js";
import { initRatesDialog } from "../shared/components/rates-dialog.js";

function renderAll() {
  renderItinerary();
  renderPacking();
  renderWork();
  renderTripsList();
}

// Wires the freshly mounted desktop DOM. `signal` aborts every document/window-level listener when the platform unmounts.
export function mount({ signal }) {
  const unsubscribe = subscribe(renderAll);
  signal.addEventListener("abort", unsubscribe);

  initDialogs({
    itemDialog: () => requestCloseItemDialog(),
    itemFullscreenDialog: () => requestCloseFsDialog()
  }, { signal });
  initTheme({ signal });

  initItinerary(getCurrentRoute, { signal });
  initPacking({ signal });
  initWork({ signal });
  initBackupControls();
  initTripControls();
  initRatesDialog();

  // Re-apply the itinerary view chosen before this platform was mounted
  setItineraryView(viewState.itineraryView, () => "itinerary");

  initRouter(itineraryRouteAdapter, { signal });
  renderAll();
  route(false);

  // Update the visual lens once fonts and layout are ready
  requestAnimationFrame(() => {
    updateItineraryLens(true);
    updatePackLens(true);
  });
  document.fonts?.ready?.then?.(() => {
    if (!signal.aborted) {
      updateItineraryLens(true);
      updatePackLens(true);
    }
  });
}
