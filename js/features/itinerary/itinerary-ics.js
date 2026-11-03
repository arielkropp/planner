/* iCalendar (.ics) Export */

import { DEFAULT_TZ } from "../../constants.js";
import { toUtcMs, tzInfo, tzDifferenceLabel, formatDurationMs, addDays, todayIso } from "../../utils/date.js";
import { fmtCost } from "../../utils/format.js";
import { getState } from "../../state/store.js";
import { sortItems } from "./itinerary-utils.js";

export function icsEscape(strVal) {
  return String(strVal || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function exportIcsCalendar() {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Argentina Trip Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];
  const sorted = [...(getState().agenda || [])].sort(sortItems);

  for (const a of sorted) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${a.id}@argentina-trip-planner`);
    lines.push(`DTSTAMP:${nowStamp}`);
    const startClean = a.date.replace(/-/g, "");
    const sTz = a.tz || DEFAULT_TZ;
    const eTz = a.endTz || sTz;

    if (a.time) {
      const utcStartMs = toUtcMs(a.date, a.time, sTz);
      const dStart = new Date(utcStartMs);
      const tStartIso = dStart.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
      lines.push(`DTSTART:${tStartIso}`);

      if (a.endTime) {
        const utcEndMs = toUtcMs(a.endDate && a.endDate >= a.date ? a.endDate : a.date, a.endTime, eTz);
        const dEnd = new Date(utcEndMs);
        const tEndIso = dEnd.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
        lines.push(`DTEND:${tEndIso}`);
      } else {
        const dEnd = new Date(utcStartMs + 3600000);
        const tEndIso = dEnd.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
        lines.push(`DTEND:${tEndIso}`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${startClean}`);
      const exclEnd = addDays(a.endDate && a.endDate >= a.date ? a.endDate : a.date, 1).replace(/-/g, "");
      lines.push(`DTEND;VALUE=DATE:${exclEnd}`);
    }

    lines.push(`SUMMARY:${icsEscape(`[${a.type}] ${a.title} (${a.status})`)}`);
    const descParts = [];
    if (a.time) {
      if (sTz !== eTz) {
        descParts.push(`Timezones: ${tzInfo(sTz).label} → ${tzInfo(eTz).label}`);
        const u1 = toUtcMs(a.date, a.time, sTz);
        const u2 = a.endTime ? toUtcMs(a.endDate || a.date, a.endTime, eTz) : null;
        if (u2 && u2 > u1) descParts.push(`Duration: ${formatDurationMs(u2 - u1)} (${tzDifferenceLabel(sTz, eTz)})`);
      } else {
        descParts.push(`Timezone: ${tzInfo(sTz).label}`);
      }
    }
    if (a.confirmation) descParts.push(`Confirmation: ${a.confirmation}`);
    if (a.cost > 0) descParts.push(`Cost: ${fmtCost(a.cost, a.currency)}`);
    if (a.bookBy && a.status === "To book") descParts.push(`Book by: ${a.bookBy}`);
    if (a.url) descParts.push(`URL: ${a.url}`);
    if (a.notes) descParts.push(a.notes);
    if (descParts.length) lines.push(`DESCRIPTION:${icsEscape(descParts.join("\n"))}`);
    if (a.url) lines.push(`URL:${icsEscape(a.url)}`);
    lines.push(`STATUS:${a.status === "Confirmed" ? "CONFIRMED" : "TENTATIVE"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `argentina-trip-${todayIso()}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

