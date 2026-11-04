/* Itinerary Card and Pill Markup */

import { TYPE_META } from "../../../shared/constants.js";
import { esc, icon } from "../../../shared/utils/dom.js";
import { eventTitleText, scheduleTimeText } from "../../../shared/domain/itinerary.js";

export const typeVar = type => `--c:var(--t-${TYPE_META[type]?.c || "other"})`;

export const statusPill = st => st === "Confirmed"
  ? `<span class="pill confirmed">${icon("check")}Confirmed</span>`
  : `<span class="pill tobook">To book</span>`;

export const ev = (a, currentDay) => {
  const rawTitle = a.date < currentDay ? eventTitleText(a, currentDay) : a.title;
  const tm = scheduleTimeText(a, currentDay, a.date < currentDay);
  const hasNotes = Boolean(a.notes?.trim());
  const iconName = TYPE_META[a.type]?.icon || "dots";
  return `<button type="button" class="ev${a.date < currentDay ? " cont" : ""}" data-id="${esc(a.id)}" style="${typeVar(a.type)}" aria-label="${esc(`${rawTitle}, ${a.type}${tm ? ", " + tm : ""}${hasNotes ? ", has notes" : ""}, ${a.status}. Edit`)}">
    <span class="ev-content"><span class="ev-title">${icon(iconName)} ${esc(rawTitle)}</span>${tm ? `<span class="tm">${esc(tm)}</span>` : ""}${hasNotes ? `<span class="ev-note" aria-hidden="true" title="Has notes">${icon("sticky-note")}</span>` : ""}</span>
  </button>`;
};
