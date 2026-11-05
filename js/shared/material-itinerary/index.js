/* Material Itinerary 2 Feature Coordinator */

import { $ } from "../utils/dom.js";
import { renderAgenda2, scrollAgenda2ToToday, setAgendaFocusDate2 } from "./agenda.js";
import { tv2, renderCalendar2, step2 } from "./calendar.js";
import { openItemDialog2, initItemDialog2 } from "./dialog.js";
import { exportIcsCalendar } from "../domain/ics.js";

let currentView = "schedule";

export function getItinerary2View() {
  return currentView;
}

export function setItinerary2View(view) {
  if (!["schedule", "week", "month"].includes(view)) return;
  currentView = view;
  if (view !== "schedule") tv2.view = view;

  const tabs = $("itinerary2Views");
  if (tabs) {
    const matchingTab = tabs.querySelector(`[data-itinerary-view="${view}"]`);
    if (matchingTab && !matchingTab.active) {
      matchingTab.active = true;
    }
  }

  renderItinerary2();
}

export function renderItinerary2() {
  const showSchedule = currentView === "schedule";
  const scheduleView = $("scheduleView2");
  const calendarView = $("calendarView2");
  const tvBar = $("tvBar2");

  if (scheduleView) scheduleView.hidden = !showSchedule;
  if (calendarView) calendarView.hidden = showSchedule;
  if (tvBar) tvBar.hidden = showSchedule;

  if (showSchedule) {
    renderAgenda2();
  } else {
    renderCalendar2();
  }
}

export function focusSchedule2Date(date) {
  tv2.cursor = date;
  setAgendaFocusDate2(date);
  setItinerary2View("schedule");
  requestAnimationFrame(() => {
    const day = [...($("agendaList2")?.querySelectorAll(".m3-day-section") || [])].find(
      section => section.dataset.date === date
    );
    if (day) {
      day.scrollIntoView({ block: "start" });
    }
    setAgendaFocusDate2(null);
  });
}

export function initItinerary2(getCurrentRoute = () => "itinerary2", { signal } = {}) {
  initItemDialog2(() => {
    renderItinerary2();
  });

  $("addItem2")?.addEventListener("click", () => openItemDialog2());
  $("exportIcs2")?.addEventListener("click", exportIcsCalendar);

  const tabs = $("itinerary2Views");
  if (tabs) {
    tabs.addEventListener("change", () => {
      const view = tabs.activeTab?.dataset?.itineraryView;
      if (view) setItinerary2View(view);
    });
  }

  $("agendaList2")?.addEventListener("click", e => {
    const card = e.target.closest(".m3-card");
    if (card) openItemDialog2(card.dataset.id);
  });

  $("tvPrev2")?.addEventListener("click", () => step2(-1));
  $("tvNext2")?.addEventListener("click", () => step2(1));

  $("tvBody2")?.addEventListener("click", e => {
    const card = e.target.closest(".m3-card, .mchip");
    const day = e.target.closest("[data-day]");
    if (card && card.dataset.id) return openItemDialog2(card.dataset.id);
    if (day) {
      if (tv2.view === "week") openItemDialog2(null, day.dataset.day);
      else focusSchedule2Date(day.dataset.day);
    }
  });
}

export const itinerary2RouteAdapter = {
  getView: getItinerary2View,
  setView: setItinerary2View,
  onShow: () => renderItinerary2(),
  scrollToToday: scrollAgenda2ToToday
};

export { openItemDialog2 };

