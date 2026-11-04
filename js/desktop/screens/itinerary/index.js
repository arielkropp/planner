/* Itinerary Feature Coordinator */

import { $ } from "../../../shared/utils/dom.js";
import { viewState } from "../../../shared/state/view-state.js";
import { renderAgenda, scrollAgendaToToday } from "./agenda.js";
import { tv, renderCalendar, step } from "./calendar.js";
import { openItemDialog, initItemDialog, requestCloseItemDialog } from "./dialog.js";
import { exportIcsCalendar } from "../../../shared/domain/ics.js";

const itineraryScrollPositions = new Map();
let lensSlideTimer = 0;

export function getItineraryView() {
  return viewState.itineraryView;
}

export function updateItineraryLens(immediate = false) {
  const container = $("itineraryViews");
  const lens = $("itineraryLens");
  if (!container || !lens) return;

  const active = container.querySelector('[data-itinerary-view][aria-pressed="true"]');
  if (!active || active.offsetWidth === 0) return;

  const maxOffset = Math.max(1, container.clientWidth - active.offsetWidth);
  const ratio = Math.min(1, Math.max(0, active.offsetLeft / maxOffset));
  const sheen = `${((ratio - 0.5) * 32).toFixed(1)}%`;

  if (immediate) {
    clearTimeout(lensSlideTimer);
    lens.classList.remove("is-sliding");
    lens.style.transition = "none";
    lens.style.transform = `translateX(${active.offsetLeft}px)`;
    lens.style.width = `${active.offsetWidth}px`;
    lens.style.setProperty("--lens-sheen", sheen);
    lens.classList.add("is-ready");
    void lens.offsetHeight;
    lens.style.transition = "";
    return;
  }

  lens.classList.remove("is-sliding");
  void lens.offsetWidth; // restart the swell animation on rapid re-clicks
  lens.classList.add("is-sliding");
  clearTimeout(lensSlideTimer);
  lensSlideTimer = setTimeout(() => lens.classList.remove("is-sliding"), 750);
  lens.style.transform = `translateX(${active.offsetLeft}px)`;
  lens.style.width = `${active.offsetWidth}px`;
  lens.style.setProperty("--lens-sheen", sheen);
  lens.classList.add("is-ready");
}

export function setItineraryView(view, getCurrentRoute = () => "itinerary") {
  if (!["schedule", "week", "month"].includes(view)) return;
  const currentRoute = getCurrentRoute();
  const changed = view !== viewState.itineraryView;

  if (changed && currentRoute === "itinerary") {
    itineraryScrollPositions.set(viewState.itineraryView, window.scrollY);
  }

  viewState.itineraryView = view;
  if (view !== "schedule") tv.view = view;

  const container = $("itineraryViews");
  if (container) {
    container.querySelectorAll("[data-itinerary-view]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.itineraryView === view));
    });
  }

  updateItineraryLens();
  renderItinerary();

  if (changed) {
    const activeView = view === "schedule" ? $("scheduleView") : $("calendarView");
    if (activeView) {
      activeView.classList.remove("view-enter");
      void activeView.offsetWidth;
      activeView.classList.add("view-enter");
    }
  }

  if (changed && currentRoute === "itinerary" && itineraryScrollPositions.has(view)) {
    const scrollY = itineraryScrollPositions.get(view);
    requestAnimationFrame(() => {
      if (currentRoute === "itinerary" && viewState.itineraryView === view) window.scrollTo(0, scrollY);
    });
  }
}

export function renderItinerary() {
  const showSchedule = viewState.itineraryView === "schedule";
  const scheduleView = $("scheduleView");
  const calendarView = $("calendarView");
  const tvBar = $("tvBar");

  if (scheduleView) scheduleView.hidden = !showSchedule;
  if (calendarView) calendarView.hidden = showSchedule;
  if (tvBar) tvBar.hidden = showSchedule;

  if (showSchedule) {
    renderAgenda();
  } else {
    renderCalendar();
  }
}

export function focusItem(id, getCurrentRoute = () => "itinerary") {
  const currentRoute = getCurrentRoute();
  if (currentRoute === "itinerary" && viewState.itineraryView !== "schedule") {
    const tvEl = [...document.querySelectorAll("#tvBody [data-id]")].find(b => b.dataset.id === id);
    if (tvEl) {
      tvEl.focus({ preventScroll: true });
    } else {
      $("addItem")?.focus({ preventScroll: true });
    }
    return;
  }
  const el = [...document.querySelectorAll("#agendaList .ag-item")].find(b => b.dataset.id === id);
  if (el) el.focus({ preventScroll: true });
  else $("addItem")?.focus({ preventScroll: true });
}

export function initItinerary(getCurrentRoute = () => "itinerary", { signal } = {}) {
  initItemDialog(id => {
    renderItinerary();
    if (id) focusItem(id, getCurrentRoute);
    else $("addItem")?.focus({ preventScroll: true });
  });

  $("addItem")?.addEventListener("click", () => openItemDialog());
  $("exportIcs")?.addEventListener("click", exportIcsCalendar);

  $("itineraryViews")?.addEventListener("click", e => {
    const button = e.target.closest("[data-itinerary-view]");
    if (!button) return;
    setItineraryView(button.dataset.itineraryView, getCurrentRoute);
    button.focus({ preventScroll: true });
  });

  $("agendaList")?.addEventListener("click", e => {
    const b = e.target.closest(".ag-item");
    if (b) openItemDialog(b.dataset.id);
  });

  $("tvPrev")?.addEventListener("click", () => step(-1));
  $("tvNext")?.addEventListener("click", () => step(1));

  $("tvBody")?.addEventListener("click", e => {
    const item = e.target.closest(".ev, .mchip[data-id]");
    const day = e.target.closest("[data-day]");
    if (item) return openItemDialog(item.dataset.id);
    if (day) openItemDialog(null, day.dataset.day);
  });

  window.addEventListener("resize", () => {
    updateItineraryLens(true);
  }, { signal });
}

// What the shared router needs from the itinerary screen
export const itineraryRouteAdapter = {
  getView: getItineraryView,
  setView: view => setItineraryView(view, () => "itinerary"),
  onShow: updateItineraryLens,
  scrollToToday: scrollAgendaToToday
};

export { requestCloseItemDialog };
