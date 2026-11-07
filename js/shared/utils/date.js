/* Date and Time Utilities */

import { START, END, WD, FULL_MONTHS, DEFAULT_TZ, TIMEZONES, pad } from "../constants.js";

export const toDate = iso => new Date(`${iso}T00:00:00Z`);

export const addDays = (iso, n) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysDiff = (d1, d2) => Math.round((toDate(d2) - toDate(d1)) / 86400000);

export const dowOf = iso => toDate(iso).getUTCDay();

export const fmtDate = iso => {
  if (typeof iso !== "string" || iso.length < 10) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
};

export const fmtDateLong = iso => {
  if (typeof iso !== "string" || iso.length < 10) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};

export const fmtDay = iso => `${WD[dowOf(iso)]} ${fmtDate(iso)}`;

let currentTripDates = {
  startDate: START,
  endDate: END,
  effectiveEnd: END
};

export const TRIP_DAYS = [];
export const TRIP_MONTHS = [];

export function recomputeTripDays() {
  TRIP_DAYS.length = 0;
  const start = getTripStart();
  const end = getTripEnd();
  for (let d = start; d <= end; d = addDays(d, 1)) TRIP_DAYS.push(d);

  TRIP_MONTHS.length = 0;
  for (const d of TRIP_DAYS) {
    const ym = d.slice(0, 7);
    if (!TRIP_MONTHS.includes(ym)) TRIP_MONTHS.push(ym);
  }
}

export function setTripDates(startDate, endDate, maxEventDate = "") {
  const start = startDate || START;
  let effectiveEnd = endDate || "";
  if (!effectiveEnd) {
    const defaultSpan = addDays(start, 37);
    effectiveEnd = (maxEventDate && maxEventDate > defaultSpan) ? maxEventDate : defaultSpan;
  }
  currentTripDates = {
    startDate: start,
    endDate: endDate || "",
    effectiveEnd
  };
  recomputeTripDays();
}

export function getTripStart() {
  return currentTripDates.startDate;
}

export function hasTripEndDate() {
  return Boolean(currentTripDates.endDate);
}

export function getTripEnd() {
  return currentTripDates.endDate || currentTripDates.effectiveEnd || addDays(currentTripDates.startDate, 37);
}

export const inTrip = iso => {
  const start = getTripStart();
  if (currentTripDates.endDate) {
    return iso >= start && iso <= currentTripDates.endDate;
  }
  return iso >= start;
};

export const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};

export const defaultDate = () => (inTrip(todayIso()) ? todayIso() : getTripStart());

export const validAnyDate = v => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = toDate(v);
  return !isNaN(d) && d.toISOString().slice(0, 10) === v;
};

export const validDate = v => validAnyDate(v) && inTrip(v);

export const parseDate = text => {
  if (!text) return null;
  const t = String(text).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t) && validDate(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${yr}-${pad(m[2])}-${pad(m[1])}`;
  return validDate(iso) ? iso : null;
};

export const tzInfo = tzId => {
  const found = TIMEZONES.find(t => t.id === tzId || t.title === tzId);
  if (found) {
    return {
      ...found,
      country: found.countryCode || found.country || "",
      city: found.city || (found.searchTerms?.[0] ? found.searchTerms[0].split(",")[0].trim() : found.country),
      label: found.label || found.title
    };
  }
  return { id: tzId || DEFAULT_TZ, country: "", city: String(tzId || DEFAULT_TZ).split("/").pop().replace(/_/g, " "), label: tzId || DEFAULT_TZ };
};

const dtfCache = new Map();

// UTC offset (in minutes) of a timezone at a given UTC instant, DST-aware.
export function tzOffsetMinutes(tzId, utcMs) {
  let dtf = dtfCache.get(tzId);
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tzId, hourCycle: "h23",
        year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
      });
    } catch {
      dtf = null;
    }
    dtfCache.set(tzId, dtf);
  }
  if (!dtf) return 0;
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map(x => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

export function toUtcMs(dateStr, timeStr, tzId) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm, 0);
  const first = wall - tzOffsetMinutes(tzId, wall) * 60000;
  return wall - tzOffsetMinutes(tzId, first) * 60000;
}

export function convertTimezone(dateStr, timeStr, fromTzId, toTzId) {
  if (!dateStr || !timeStr) return null;
  const utcMs = toUtcMs(dateStr, timeStr, fromTzId);
  if (utcMs === null) return null;
  const targetMs = utcMs + tzOffsetMinutes(toTzId, utcMs) * 60000;
  const d = new Date(targetMs);
  const isoDate = d.toISOString().slice(0, 10);
  const hours = pad(d.getUTCHours());
  const mins = pad(d.getUTCMinutes());
  return {
    date: isoDate,
    time: `${hours}:${mins}`,
    diffDays: daysDiff(dateStr, isoDate)
  };
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function tzDifferenceLabel(startTzId, endTzId, atMs = Date.now()) {
  const sInfo = tzInfo(startTzId);
  const eInfo = tzInfo(endTzId);
  const diffMin = tzOffsetMinutes(startTzId, atMs) - tzOffsetMinutes(endTzId, atMs);
  if (diffMin === 0) return "";
  const ahead = diffMin > 0 ? sInfo.city : eInfo.city;
  const behind = diffMin > 0 ? eInfo.city : sInfo.city;
  const abs = Math.abs(diffMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const amount = m ? `${h}h ${m}m` : `${h}h`;
  return `${ahead} is ${amount} ahead of ${behind}`;
}

recomputeTripDays();

export const daysInMonth = ym => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export const monthLabel = ym => {
  const [y, m] = ym.split("-").map(Number);
  return `${FULL_MONTHS[m - 1]} ${y}`;
};

