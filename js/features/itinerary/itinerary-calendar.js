/* Itinerary Monthly and Weekly Calendar Views */

import { START, END, WD, TYPE_META, pad } from "../../constants.js";
import {
  addDays,
  daysDiff,
  dowOf,
  fmtDate,
  fmtDay,
  inTrip,
  todayIso,
  defaultDate,
  TRIP_MONTHS,
  daysInMonth,
  monthLabel
} from "../../utils/date.js";
import { $, esc, icon } from "../../utils/dom.js";
import { getState } from "../../state/store.js";
import { itemsForDay, ev, sortItems, typeVar } from "./itinerary-utils.js";
import { renderAgendaEntryHtml } from "./itinerary-agenda.js";

export const tv = { view: "week", cursor: defaultDate() };

const clampDate = d => (d < START ? START : d > END ? END : d);

export function renderCalendar(isMobileView = false) {
  const c = tv.cursor;
  const today = todayIso();
  let html = "";
  let title = "";
  let prev = false;
  let next = false;

  if (tv.view === "week") {
    const ws = addDays(c, -dowOf(c));
    const firstWeek = addDays(START, -dowOf(START));
    title = `Week ${Math.floor(daysDiff(firstWeek, ws) / 7) + 1}`;
    prev = ws > START;
    next = addDays(ws, 7) <= END;

    html = `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = addDays(ws, i);
      const t = inTrip(d);
      const items = itemsForDay(d);
      const head = `<span class="wd">${WD[i]}</span><span class="d">${fmtDate(d)}</span>`;
      const events = isMobileView
        ? `<ul class="ag-items">${items.map(a => renderAgendaEntryHtml(a, d, a.date < d)).join("")}</ul>`
        : items.map(a => ev(a, d)).join("");
      const hitbox = t
        ? `<button type="button" class="wcol-hitbox" data-day="${d}" aria-label="Add itinerary item for ${fmtDay(d)}"><span class="icon-btn solid day-add-cue" aria-hidden="true">${icon("plus")}</span></button>`
        : "";
      const dayHeader = `<div class="wh">${head}</div>`;
      return `<div class="wcol${t ? "" : " out"}${d === today ? " today" : ""}">${hitbox}${dayHeader}${events}</div>`;
    }).join("")}</div>`;
  } else {
    const curYm = c.slice(0, 7);
    const mIdx = Math.max(0, TRIP_MONTHS.indexOf(curYm));
    const ym = TRIP_MONTHS[mIdx] || TRIP_MONTHS[0];
    const first = `${ym}-01`;
    const len = daysInMonth(ym);
    const last = `${ym}-${pad(len)}`;
    title = monthLabel(ym);
    prev = mIdx > 0;
    next = mIdx < TRIP_MONTHS.length - 1;

    html = `<div class="month-grid">${WD.map(w => `<div class="mdow">${w}</div>`).join("")}`;

    for (let weekStart = addDays(first, -dowOf(first)); weekStart <= last; weekStart = addDays(weekStart, 7)) {
      const weekEnd = addDays(weekStart, 6);
      const segments = [];
      const agenda = getState().agenda || [];

      for (const item of agenda) {
        const eventEnd = item.endDate && item.endDate > item.date ? item.endDate : item.date;
        const weekSegmentStart = item.date > weekStart ? item.date : weekStart;
        const start = weekSegmentStart > first ? weekSegmentStart : first;
        const weekSegmentEnd = eventEnd < weekEnd ? eventEnd : weekEnd;
        const end = weekSegmentEnd < last ? weekSegmentEnd : last;
        if (start > end) continue;
        segments.push({
          item,
          startCol: dowOf(start),
          endCol: dowOf(end) + 1,
          continues: start > item.date
        });
      }

      segments.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol || sortItems(a.item, b.item));

      const laneEnds = [];
      for (const segment of segments) {
        let lane = laneEnds.findIndex(endCol => endCol <= segment.startCol);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = segment.endCol;
        segment.lane = lane;
      }
      const laneCount = Math.max(laneEnds.length, 3);

      html += `<div class="month-week" style="--month-lanes:${laneCount}">`;
      for (let col = 0; col < 7; col++) {
        const iso = addDays(weekStart, col);
        const placement = `grid-column:${col + 1};grid-row:1/-1`;
        if (iso < first || iso > last) {
          html += `<div class="mcell out" aria-hidden="true" style="${placement}"></div>`;
          continue;
        }
        const dayItems = itemsForDay(iso);
        const titles = dayItems.map(item => item.title).join(", ");
        const label = isMobileView
          ? `${fmtDay(iso)}, ${dayItems.length} ${dayItems.length === 1 ? "event" : "events"}${titles ? `: ${titles}` : ""}. Show in Schedule`
          : `${fmtDay(iso)}. Add itinerary item`;
        const date = Number(iso.slice(8, 10));
        const number = `<span class="mnum">${date}</span>`;
        const cue = isMobileView ? "" : `<span class="icon-btn solid day-add-cue" aria-hidden="true">${icon("plus")}</span>`;
        html += inTrip(iso)
          ? `<button type="button" class="mcell${iso === today ? " today" : ""}" data-day="${iso}" aria-label="${esc(label)}" style="${placement}">${number}${cue}</button>`
          : `<div class="mcell out" style="${placement}">${number}</div>`;
      }

      html += segments.map(segment => {
        const cls = `mchip${segment.continues ? " cont" : ""}`;
        const style = `grid-column:${segment.startCol + 1}/${segment.endCol + 1};grid-row:${segment.lane + 2};${typeVar(segment.item.type)}`;
        const chipTitle = `<span class="mchip-title">${esc(segment.item.title)}</span>`;
        const iconName = TYPE_META[segment.item.type]?.icon || "dots";
        return isMobileView
          ? `<span class="${cls}" aria-hidden="true" style="${style}">${chipTitle}</span>`
          : `<button type="button" class="${cls}" data-id="${esc(segment.item.id)}" aria-label="${esc(`${segment.item.title}, ${segment.item.type}. Edit`)}" style="${style}">${icon(iconName)}${chipTitle}</button>`;
      }).join("");

      html += "</div>";
    }
    html += "</div>";
  }

  const titleEl = $("tvTitle");
  const bodyEl = $("tvBody");
  const prevBtn = $("tvPrev");
  const nextBtn = $("tvNext");

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = html;
  if (prevBtn) {
    prevBtn.disabled = !prev;
    prevBtn.setAttribute("aria-label", `Previous ${tv.view}`);
  }
  if (nextBtn) {
    nextBtn.disabled = !next;
    nextBtn.setAttribute("aria-label", `Next ${tv.view}`);
  }
}

export function step(dir, isMobileView = false) {
  if (tv.view === "week") {
    const ws = addDays(tv.cursor, -dowOf(tv.cursor));
    tv.cursor = clampDate(addDays(ws, 7 * dir));
  } else {
    const curYm = tv.cursor.slice(0, 7);
    const mIdx = Math.max(0, TRIP_MONTHS.indexOf(curYm));
    const nextIdx = Math.max(0, Math.min(TRIP_MONTHS.length - 1, mIdx + dir));
    tv.cursor = clampDate(`${TRIP_MONTHS[nextIdx]}-01`);
  }
  renderCalendar(isMobileView);

  const prevBtn = $("tvPrev");
  const nextBtn = $("tvNext");
  if (document.activeElement === document.body || (dir < 0 && prevBtn?.disabled) || (dir > 0 && nextBtn?.disabled)) {
    $("tvTitle")?.focus({ preventScroll: true });
  }
}

