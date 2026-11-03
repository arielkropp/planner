/* State Schema Validation and Sanitization */

import {
  TYPES,
  STATUSES,
  CATEGORIES,
  CURRENCIES,
  DEFAULT_RATES,
  DEFAULT_TZ,
  TIMEZONES,
  DEFAULT_NOV_BALANCE,
  DEFAULT_ACCRUAL,
  DEFAULT_ACCRUAL_MONTHS,
  DEFAULT_STD_DAY
} from "../constants.js";
import { toUtcMs, validDate, validAnyDate, defaultDate } from "../utils/date.js";
import { parsePackQty, str, uid } from "../utils/format.js";

export const defaultBalance = () => ({
  pre: 0,
  novBalance: DEFAULT_NOV_BALANCE,
  accrual: DEFAULT_ACCRUAL,
  accrualMonths: DEFAULT_ACCRUAL_MONTHS,
  stdDay: DEFAULT_STD_DAY
});

export const defaults = () => ({
  version: 2,
  agenda: [],
  packing: [],
  work: [],
  balance: defaultBalance(),
  rates: { ...DEFAULT_RATES }
});

export function isValidTimeInterval(startDate, endDate, startTime, endTime, startTz = DEFAULT_TZ, endTz = startTz) {
  if (!startTime || !endTime) return true;
  if (!endDate || endDate === startDate) {
    if (startTz === endTz) return endTime >= startTime;
    const t1 = toUtcMs(startDate, startTime, startTz);
    const t2 = toUtcMs(startDate, endTime, endTz);
    return t2 >= t1;
  }
  const t1 = toUtcMs(startDate, startTime, startTz);
  const t2 = toUtcMs(endDate, endTime, endTz);
  return t2 >= t1;
}

export function validateV2(st) {
  if (!st || typeof st !== "object" || Array.isArray(st) || st.version !== 2) {
    throw new Error("Invalid planner data.");
  }

  let hadWarnings = false;
  for (const key of ["agenda", "packing", "work"]) {
    if (st[key] !== undefined && !Array.isArray(st[key])) {
      throw new Error(`Invalid "${key}" section in saved data.`);
    }
    if (!Array.isArray(st[key])) st[key] = [];
  }

  const seenAgendaIds = new Set();
  const agenda = [];
  for (const a of st.agenda) {
    if (!a || typeof a !== "object") {
      hadWarnings = true;
      continue;
    }
    let id = str(a.id, 100, true) ? a.id : uid();
    if (seenAgendaIds.has(id)) id = uid();
    seenAgendaIds.add(id);

    const title = (typeof a.title === "string" && a.title.trim()) ? a.title.slice(0, 200) : "Untitled";
    const date = validDate(a.date) ? a.date : defaultDate();
    const time = (typeof a.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) ? a.time : "";
    let endTime = (typeof a.endTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.endTime)) ? a.endTime : "";
    const endDate = (a.endDate && validDate(a.endDate) && a.endDate >= date) ? a.endDate : "";
    const rawTz = (typeof a.tz === "string" && a.tz.trim()) ? a.tz.trim().slice(0, 50) : DEFAULT_TZ;
    const tz = TIMEZONES.some(t => t.id === rawTz || t.short === rawTz)
      ? (TIMEZONES.find(t => t.id === rawTz || t.short === rawTz)?.id || DEFAULT_TZ)
      : DEFAULT_TZ;
    const rawEndTz = (typeof a.endTz === "string" && a.endTz.trim()) ? a.endTz.trim().slice(0, 50) : tz;
    const endTz = TIMEZONES.some(t => t.id === rawEndTz || t.short === rawEndTz)
      ? (TIMEZONES.find(t => t.id === rawEndTz || t.short === rawEndTz)?.id || tz)
      : tz;

    if (!isValidTimeInterval(date, endDate, time, endTime, tz, endTz)) {
      endTime = "";
    }

    const type = TYPES.includes(a.type) ? a.type : "Activity";
    const status = STATUSES.includes(a.status) ? a.status : "To book";
    const cost = (Number.isFinite(a.cost) && a.cost > 0) ? Math.round(a.cost * 100) / 100 : null;
    const currency = CURRENCIES.includes(a.currency) ? a.currency : "USD";
    const notes = typeof a.notes === "string" ? a.notes.slice(0, 1000) : "";
    const confirmation = typeof a.confirmation === "string" ? a.confirmation.trim().slice(0, 100) : "";
    const url = typeof a.url === "string" ? a.url.trim().slice(0, 500) : "";
    const bookBy = (typeof a.bookBy === "string" && validAnyDate(a.bookBy)) ? a.bookBy : "";

    agenda.push({ id, title, date, endDate, time, endTime, tz, endTz, type, status, cost, currency, notes, confirmation, url, bookBy });
  }

  const seenPackIds = new Set();
  const packing = [];
  for (const p of st.packing) {
    if (!p || typeof p !== "object") {
      hadWarnings = true;
      continue;
    }
    let id = str(p.id, 100, true) ? p.id : uid();
    if (seenPackIds.has(id)) id = uid();
    seenPackIds.add(id);

    const title = (typeof p.title === "string" && p.title.trim()) ? p.title.slice(0, 200) : "Item";
    const category = (p.category === "" || !p.category) ? "" : (CATEGORIES.includes(p.category) ? p.category : "Other");
    const parsedQty = parsePackQty(p.qty);
    const qty = parsedQty !== null ? parsedQty : 1;
    const done = Boolean(p.done);

    packing.push({ id, title, category, qty, done });
  }

  const seenWorkIds = new Set();
  const work = [];
  const dayTotals = new Map();
  for (const w of st.work) {
    if (!w || typeof w !== "object" || !validDate(w?.date) || !Number.isFinite(Number(w?.hours))) {
      hadWarnings = true;
      continue;
    }
    let id = str(w.id, 100, true) ? w.id : uid();
    if (seenWorkIds.has(id)) id = uid();
    seenWorkIds.add(id);

    const curTotal = dayTotals.get(w.date) || 0;
    const allowed = Math.max(0, Math.round((24 - curTotal) * 100) / 100);
    const hours = Math.round(Math.min(allowed, Math.max(0, Number(w.hours))) * 100) / 100;
    if (hours >= 0.01) {
      work.push({ id, date: w.date, hours, note: typeof w.note === "string" ? w.note.slice(0, 200) : "" });
      dayTotals.set(w.date, Math.round((curTotal + hours) * 100) / 100);
    }
  }

  const b = st.balance || {};
  let pre = (Number.isFinite(Number(b.pre)) && Number(b.pre) >= 0) ? Math.min(300, Math.round(Number(b.pre) * 100) / 100) : 0;
  if (pre === 6.0 && (b.sep !== undefined || b.floor !== undefined)) pre = 0;
  const novBalance = (Number.isFinite(Number(b.novBalance)) && Number(b.novBalance) >= -500 && Number(b.novBalance) <= 1000)
    ? Number(b.novBalance)
    : DEFAULT_NOV_BALANCE;
  const accrual = (Number.isFinite(Number(b.accrual)) && Number(b.accrual) >= 0 && Number(b.accrual) <= 200)
    ? Number(b.accrual)
    : DEFAULT_ACCRUAL;
  const accrualMonths = (Number.isInteger(Number(b.accrualMonths)) && Number(b.accrualMonths) >= 0 && Number(b.accrualMonths) <= 24)
    ? Number(b.accrualMonths)
    : DEFAULT_ACCRUAL_MONTHS;
  const stdDay = (Number.isFinite(Number(b.stdDay)) && Number(b.stdDay) >= 0 && Number(b.stdDay) <= 24)
    ? Number(b.stdDay)
    : DEFAULT_STD_DAY;

  const r = st.rates || {};
  const validRate = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const rates = {
    base: CURRENCIES.includes(r.base) ? r.base : DEFAULT_RATES.base,
    EUR: validRate(r.EUR),
    GBP: validRate(r.GBP),
    ILS: validRate(r.ILS)
  };

  const result = {
    version: 2,
    agenda,
    packing,
    work,
    balance: { pre, novBalance, accrual, accrualMonths, stdDay },
    rates
  };
  Object.defineProperty(result, "_hadWarnings", { value: hadWarnings, enumerable: false });
  return result;
}

