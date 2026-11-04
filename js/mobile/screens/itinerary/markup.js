/* Itinerary Card and Pill Markup */

import { TYPE_META } from "../../../shared/constants.js";
import { icon } from "../../../shared/utils/dom.js";

export const typeVar = type => `--c:var(--t-${TYPE_META[type]?.c || "other"})`;

export const statusPill = st => st === "Confirmed"
  ? `<span class="pill confirmed">${icon("check")}Confirmed</span>`
  : `<span class="pill tobook">To book</span>`;
