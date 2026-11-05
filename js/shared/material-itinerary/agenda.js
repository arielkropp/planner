/* Material Itinerary Agenda Schedule List View */

import { END, WD, TYPE_META } from "../constants.js";
import { addDays, dowOf, fmtDate, todayIso, inTrip } from "../utils/date.js";
import { $, esc, icon } from "../utils/dom.js";
import { getState } from "../state/store.js";
import { sortItems, eventTitleText, scheduleTimeText } from "../domain/itinerary.js";

let agendaFocusDate = null;

export function setAgendaFocusDate2(date) {
  agendaFocusDate = date;
}

export const typeVar = type => `--c:var(--t-${TYPE_META[type]?.c || "other"})`;

export function statusBadge(st) {
  return st === "Confirmed"
    ? `<span class="pill confirmed">${icon("check")}Confirmed</span>`
    : `<span class="pill tobook">To book</span>`;
}

export function renderAgenda2() {
  const container = $("agendaList2");
  if (!container) return;

  const items = [...(getState().agenda || [])].sort(sortItems);

  if (!items.length && !agendaFocusDate) {
    container.innerHTML = `<p class="empty">Nothing planned yet. Tap the + button to add an item.</p>`;
    return;
  }

  const today = todayIso();
  const groups = {};
  for (const a of items) {
    (groups[a.date] ||= []).push({ item: a, isCont: false });
    if (a.endDate && a.endDate > a.date) {
      for (let d = addDays(a.date, 1); d <= a.endDate && d <= END; d = addDays(d, 1)) {
        (groups[d] ||= []).push({ item: a, isCont: true });
      }
    }
  }

  if (agendaFocusDate && inTrip(agendaFocusDate)) {
    groups[agendaFocusDate] ||= [];
  }

  const sortedDates = Object.keys(groups).sort();
  container.innerHTML = sortedDates.map(d => {
    const isToday = d === today;
    return `
    <div class="m3-day-section" data-date="${d}">
      <div class="m3-day-badge ${isToday ? "is-today" : ""}">
        <span class="m3-day-wd">${WD[dowOf(d)]}</span>
        <span class="m3-day-date">${fmtDate(d)}</span>
        ${isToday ? `<span class="m3-today-pill">Today</span>` : ""}
      </div>
      <div class="m3-day-items">
        ${groups[d].map(({ item, isCont }) => renderCardHtml(item, d, isCont)).join("")}
      </div>
    </div>`;
  }).join("");
}

function renderCardHtml(a, currentDay, isCont) {
  const iconName = TYPE_META[a.type]?.icon || "dots";
  const itemTitle = isCont ? eventTitleText(a, currentDay) : a.title;
  const timeText = scheduleTimeText(a, currentDay, isCont);

  return `
    <div class="m3-card ${isCont ? "is-cont" : ""}" data-id="${esc(a.id)}" role="button" tabindex="0" style="${typeVar(a.type)}" aria-label="${esc(`${itemTitle}, ${a.type}, ${timeText || "No set time"}, ${a.status}. Edit`)}">
      <md-ripple></md-ripple>
      <div class="m3-card-lead">
        ${icon(iconName)}
      </div>
      <div class="m3-card-main">
        <div class="m3-card-row">
          <span class="m3-card-title">${esc(itemTitle)}</span>
          ${!isCont ? statusBadge(a.status) : ""}
        </div>
        ${timeText ? `<div class="m3-card-time">${icon("clock")}${esc(timeText)}</div>` : ""}
        ${a.notes && !isCont ? `<div class="m3-card-notes">${esc(a.notes)}</div>` : ""}
      </div>
    </div>`;
}

export function scrollAgenda2ToToday() {
  const today = todayIso();
  const el = [...document.querySelectorAll("#agendaList2 .m3-day-section")].find(x => x.dataset.date >= today);
  if (el) el.scrollIntoView({ block: "start" });
}

