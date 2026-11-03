/* Itinerary Agenda Schedule List View */

import { END, WD, TYPE_META } from "../../constants.js";
import { addDays, dowOf, fmtDate, todayIso, inTrip } from "../../utils/date.js";
import { $, esc, icon } from "../../utils/dom.js";
import { getState } from "../../state/store.js";
import { sortItems, eventTitleText, scheduleTimeText, statusPill, typeVar } from "./itinerary-utils.js";

let agendaFocusDate = null;

export function setAgendaFocusDate(date) {
  agendaFocusDate = date;
}

export function getAgendaFocusDate() {
  return agendaFocusDate;
}

export function renderAgenda() {
  const container = $("agendaList");
  if (!container) return;

  const items = [...(getState().agenda || [])].sort(sortItems);

  if (!items.length && !agendaFocusDate) {
    container.innerHTML = `<p class="empty">Nothing planned yet. Use Add item to start.</p>`;
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
  container.innerHTML = sortedDates.map(d => `
    <div class="ag-day${d === today ? " today" : ""}" data-date="${d}" tabindex="-1">
      <div class="ag-date"><span class="wd">${WD[dowOf(d)]}</span><span class="d">${fmtDate(d)}</span></div>
      <ul class="ag-items">${groups[d].map(({ item, isCont }) => renderAgendaEntryHtml(item, d, isCont)).join("")}</ul>
    </div>`).join("");
}

export function renderAgendaEntryHtml(a, currentDay, isCont) {
  const iconName = TYPE_META[a.type]?.icon || "dots";

  if (isCont) {
    const contTitle = eventTitleText(a, currentDay);
    const contTime = scheduleTimeText(a, currentDay, true);
    return `<li>
      <button type="button" class="ag-item cont" data-id="${esc(a.id)}" style="${typeVar(a.type)}" aria-label="${esc(`${contTitle}, ${a.type}, ${contTime || "No set time"}, ${a.status}. Edit`)}">
        ${icon(iconName)}
        <span class="ag-main">
          <span class="ag-head"><span class="ag-title">${esc(contTitle)}</span></span>
          ${contTime ? `<span class="ag-time">${esc(contTime)}</span>` : ""}
        </span>
      </button></li>`;
  }

  const timeText = scheduleTimeText(a, currentDay);

  return `<li>
    <button type="button" class="ag-item" data-id="${esc(a.id)}" style="${typeVar(a.type)}" aria-label="${esc(`${a.title}, ${a.type}, ${timeText || "No set time"}, ${a.status}. Edit`)}">
      ${icon(iconName)}
      <span class="ag-main">
        <span class="ag-head"><span class="ag-title">${esc(a.title)}</span>${statusPill(a.status)}</span>
        ${timeText ? `<span class="ag-time">${esc(timeText)}</span>` : ""}
        ${a.notes ? `<span class="ag-notes">${esc(a.notes)}</span>` : ""}
      </span>
    </button></li>`;
}

export function scrollAgendaToToday() {
  const today = todayIso();
  const el = [...document.querySelectorAll(".ag-day")].find(x => x.dataset.date >= today);
  if (el) el.scrollIntoView({ block: "start" });
}

