/* State Schema Validation and Sanitization */

import {
  START,
  END,
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
import { toUtcMs, validAnyDate } from "../utils/date.js";
import { parsePackQty, str, uid } from "../utils/format.js";

export const defaultBalance = () => ({
  pre: 0,
  novBalance: DEFAULT_NOV_BALANCE,
  accrual: DEFAULT_ACCRUAL,
  accrualMonths: DEFAULT_ACCRUAL_MONTHS,
  stdDay: DEFAULT_STD_DAY
});

export const defaultTrip = (name = "My Trip", startDate = START, endDate = END) => ({
  id: "default-trip",
  name,
  startDate,
  endDate,
  agenda: [],
  packing: [],
  work: [],
  workTarget: 42,
  balance: defaultBalance()
});

export function attachActiveTripProxies(st) {
  if (!st || typeof st !== "object") return st;
  Object.defineProperties(st, {
    activeTrip: {
      get() {
        return this.trips?.find(t => t.id === this.activeTripId) || this.trips?.[0] || null;
      },
      enumerable: false,
      configurable: true
    },
    agenda: {
      get() {
        return this.activeTrip ? this.activeTrip.agenda : [];
      },
      set(val) {
        if (this.activeTrip) this.activeTrip.agenda = val;
      },
      enumerable: false,
      configurable: true
    },
    packing: {
      get() {
        return this.activeTrip ? this.activeTrip.packing : [];
      },
      set(val) {
        if (this.activeTrip) this.activeTrip.packing = val;
      },
      enumerable: false,
      configurable: true
    },
    work: {
      get() {
        return this.activeTrip ? this.activeTrip.work : [];
      },
      set(val) {
        if (this.activeTrip) this.activeTrip.work = val;
      },
      enumerable: false,
      configurable: true
    },
    workTarget: {
      get() {
        return this.activeTrip ? (this.activeTrip.workTarget ?? 42) : 42;
      },
      set(val) {
        if (this.activeTrip) this.activeTrip.workTarget = val;
      },
      enumerable: false,
      configurable: true
    },
    balance: {
      get() {
        return this.activeTrip ? this.activeTrip.balance : defaultBalance();
      },
      set(val) {
        if (this.activeTrip) this.activeTrip.balance = val;
      },
      enumerable: false,
      configurable: true
    }
  });
  return st;
}

export const defaults = () => {
  const trip = defaultTrip();
  const st = {
    version: 2,
    activeTripId: trip.id,
    trips: [trip],
    rates: { ...DEFAULT_RATES }
  };
  attachActiveTripProxies(st);
  return st;
};

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

export function inTripBounds(date, startDate, endDate) {
  if (!validAnyDate(date)) return false;
  if (date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export function validateTrip(t, defaultsObj = {}) {
  if (!t || typeof t !== "object") return null;

  let hadWarnings = false;
  const id = str(t.id, 100, true) ? t.id : uid();
  const name = (typeof t.name === "string" && t.name.trim()) ? t.name.trim().slice(0, 100) : "Untitled Trip";
  const startDate = validAnyDate(t.startDate) ? t.startDate : (defaultsObj.startDate || START);
  const endDate = (t.endDate && validAnyDate(t.endDate) && t.endDate >= startDate)
    ? t.endDate
    : (t.endDate === "" ? "" : (defaultsObj.endDate ?? ""));

  const seenAgendaIds = new Set();
  const agenda = [];
  const rawAgenda = Array.isArray(t.agenda) ? t.agenda : [];
  for (const a of rawAgenda) {
    if (!a || typeof a !== "object") {
      hadWarnings = true;
      continue;
    }
    let aId = str(a.id, 100, true) ? a.id : uid();
    if (seenAgendaIds.has(aId)) aId = uid();
    seenAgendaIds.add(aId);

    const title = (typeof a.title === "string" && a.title.trim()) ? a.title.slice(0, 200) : "Untitled";
    const date = validAnyDate(a.date) ? a.date : startDate;
    let itemEndDate = (a.endDate && validAnyDate(a.endDate) && a.endDate >= date) ? a.endDate : "";
    const time = (typeof a.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) ? a.time : "";
    let endTime = (typeof a.endTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.endTime)) ? a.endTime : "";
    const rawTz = (typeof a.tz === "string" && a.tz.trim()) ? a.tz.trim().slice(0, 50) : DEFAULT_TZ;
    const tz = TIMEZONES.some(tzItem => tzItem.id === rawTz) ? rawTz : DEFAULT_TZ;
    const rawEndTz = (typeof a.endTz === "string" && a.endTz.trim()) ? a.endTz.trim().slice(0, 50) : tz;
    const endTz = TIMEZONES.some(tzItem => tzItem.id === rawEndTz) ? rawEndTz : tz;

    if (!isValidTimeInterval(date, itemEndDate, time, endTime, tz, endTz)) {
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

    agenda.push({ id: aId, title, date, endDate: itemEndDate, time, endTime, tz, endTz, type, status, cost, currency, notes, confirmation, url, bookBy });
  }

  const seenPackIds = new Set();
  const packing = [];
  const rawPacking = Array.isArray(t.packing) ? t.packing : [];
  for (const p of rawPacking) {
    if (!p || typeof p !== "object") {
      hadWarnings = true;
      continue;
    }
    let pId = str(p.id, 100, true) ? p.id : uid();
    if (seenPackIds.has(pId)) pId = uid();
    seenPackIds.add(pId);

    const title = (typeof p.title === "string" && p.title.trim()) ? p.title.slice(0, 200) : "Item";
    const category = (p.category === "" || !p.category) ? "" : (CATEGORIES.includes(p.category) ? p.category : "Other");
    const parsedQty = parsePackQty(p.qty);
    const qty = parsedQty !== null ? parsedQty : 1;
    const done = Boolean(p.done);
    const toBuy = Boolean(p.toBuy);
    const bag = typeof p.bag === "string" ? p.bag.slice(0, 100) : "";
    const notes = typeof p.notes === "string" ? p.notes.slice(0, 1000) : "";
    const createdAt = typeof p.createdAt === "string" ? p.createdAt : "";

    packing.push({ id: pId, title, category, qty, done, toBuy, bag, notes, createdAt });
  }

  const seenWorkIds = new Set();
  const work = [];
  const dayTotals = new Map();
  const rawWork = Array.isArray(t.work) ? t.work : [];
  for (const w of rawWork) {
    if (!w || typeof w !== "object" || !validAnyDate(w?.date) || !Number.isFinite(Number(w?.hours))) {
      hadWarnings = true;
      continue;
    }
    let wId = str(w.id, 100, true) ? w.id : uid();
    if (seenWorkIds.has(wId)) wId = uid();
    seenWorkIds.add(wId);

    const curTotal = dayTotals.get(w.date) || 0;
    const allowed = Math.max(0, Math.round((24 - curTotal) * 100) / 100);
    const hours = Math.round(Math.min(allowed, Math.max(0, Number(w.hours))) * 100) / 100;
    if (hours >= 0.01) {
      work.push({ id: wId, date: w.date, hours, note: typeof w.note === "string" ? w.note.slice(0, 200) : "" });
      dayTotals.set(w.date, Math.round((curTotal + hours) * 100) / 100);
    }
  }

  const b = t.balance || {};
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

  const workTarget = (Number.isFinite(Number(t.workTarget)) && Number(t.workTarget) >= 0)
    ? Math.round(Number(t.workTarget) * 100) / 100
    : (Number.isFinite(Number(defaultsObj.workTarget)) ? Number(defaultsObj.workTarget) : 42);

  const resultTrip = {
    id,
    name,
    startDate,
    endDate,
    agenda,
    packing,
    work,
    workTarget,
    balance: { pre, novBalance, accrual, accrualMonths, stdDay }
  };
  Object.defineProperty(resultTrip, "_hadWarnings", { value: hadWarnings, enumerable: false });
  return resultTrip;
}

export function validateV2(st) {
  if (!st || typeof st !== "object" || Array.isArray(st) || st.version !== 2) {
    throw new Error("Invalid planner data.");
  }

  let hadWarnings = false;
  let trips = [];

  if (Array.isArray(st.trips) && st.trips.length > 0) {
    for (const t of st.trips) {
      const validT = validateTrip(t);
      if (validT) {
        if (validT._hadWarnings) hadWarnings = true;
        trips.push(validT);
      }
    }
  }

  if (trips.length === 0) {
    for (const key of ["agenda", "packing", "work"]) {
      if (st[key] !== undefined && !Array.isArray(st[key])) {
        throw new Error(`Invalid "${key}" section in saved data.`);
      }
    }
    let legacyStart = START;
    let legacyEnd = END;
    for (const a of st.agenda || []) {
      if (validAnyDate(a?.date)) {
        if (a.date < legacyStart) legacyStart = a.date;
        if (a.date > legacyEnd) legacyEnd = a.date;
      }
      if (validAnyDate(a?.endDate) && a.endDate > legacyEnd) {
        legacyEnd = a.endDate;
      }
    }
    for (const w of st.work || []) {
      if (validAnyDate(w?.date)) {
        if (w.date < legacyStart) legacyStart = w.date;
        if (w.date > legacyEnd) legacyEnd = w.date;
      }
    }
    const legacyTrip = validateTrip({
      id: "default-trip",
      name: "My Trip",
      startDate: legacyStart,
      endDate: legacyEnd,
      agenda: st.agenda,
      packing: st.packing,
      work: st.work,
      balance: st.balance
    });
    if (legacyTrip._hadWarnings) hadWarnings = true;
    trips.push(legacyTrip);
  }

  const activeTripId = (typeof st.activeTripId === "string" && trips.some(t => t.id === st.activeTripId))
    ? st.activeTripId
    : trips[0].id;

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
    activeTripId,
    trips,
    rates
  };

  attachActiveTripProxies(result);
  Object.defineProperty(result, "_hadWarnings", { value: hadWarnings, enumerable: false });
  return result;
}
