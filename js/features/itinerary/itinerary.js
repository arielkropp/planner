/* Itinerary Feature Coordinator */

import { $ } from "../../utils/dom.js";
import { renderAgenda, setAgendaFocusDate } from "./itinerary-agenda.js";
import { tv, renderCalendar, step } from "./itinerary-calendar.js";
import { openItemDialog, initItemDialog, requestCloseItemDialog } from "./itinerary-dialog.js";
import { exportIcsCalendar } from "./itinerary-ics.js";

export let itineraryView = "schedule";
const itineraryScrollPositions = new Map();
let lensSlideTimer = 0;

export function getItineraryView() {
  return itineraryView;
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
  const changed = view !== itineraryView;

  if (changed && currentRoute === "itinerary") {
    itineraryScrollPositions.set(itineraryView, window.scrollY);
  }

  itineraryView = view;
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
      if (currentRoute === "itinerary" && itineraryView === view) window.scrollTo(0, scrollY);
    });
  }
}

export function renderItinerary() {
  const showSchedule = itineraryView === "schedule";
  const scheduleView = $("scheduleView");
  const calendarView = $("calendarView");
  const tvBar = $("tvBar");

  if (scheduleView) scheduleView.hidden = !showSchedule;
  if (calendarView) calendarView.hidden = showSchedule;
  if (tvBar) tvBar.hidden = showSchedule;

  const isMobile = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;

  if (showSchedule) {
    renderAgenda();
  } else {
    renderCalendar(isMobile);
  }
}

export function focusScheduleDate(date) {
  tv.cursor = date;
  setAgendaFocusDate(date);
  setItineraryView("schedule");
  requestAnimationFrame(() => {
    const day = [...($("agendaList")?.querySelectorAll(".ag-day") || [])].find(
      section => section.dataset.date === date
    );
    if (day) {
      day.scrollIntoView({ block: "start" });
      day.focus({ preventScroll: true });
    }
    setAgendaFocusDate(null);
  });
}

export function focusItem(id, getCurrentRoute = () => "itinerary") {
  const currentRoute = getCurrentRoute();
  if (currentRoute === "itinerary" && itineraryView !== "schedule") {
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

export function initItinerary(getCurrentRoute = () => "itinerary") {
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

  const isMobile = () => window.matchMedia && window.matchMedia("(max-width: 760px)").matches;

  $("tvPrev")?.addEventListener("click", () => step(-1, isMobile()));
  $("tvNext")?.addEventListener("click", () => step(1, isMobile()));

  $("tvBody")?.addEventListener("click", e => {
    const item = e.target.closest(".ev, .ag-item, .mchip[data-id]");
    const day = e.target.closest("[data-day]");
    if (item) return openItemDialog(item.dataset.id);
    if (day) {
      if (tv.view === "week") openItemDialog(null, day.dataset.day);
      else if (isMobile()) focusScheduleDate(day.dataset.day);
      else openItemDialog(null, day.dataset.day);
    }
  });

  window.addEventListener("resize", () => {
    updateItineraryLens(true);
  });
}

export { requestCloseItemDialog };

