/* Central State Store and Persistence */

import { START, END, KEY, V1_KEY, SAVED_TEXT, DEFAULT_TZ, TIMEZONES } from "../constants.js";
import { $ } from "../utils/dom.js";
import { defaults, defaultBalance, attachActiveTripProxies } from "./validation.js";
import { fromAnyVersion } from "./migrations.js";
import { setTripDates, defaultDate, todayIso, validAnyDate, inTrip } from "../utils/date.js";
import { uid } from "../utils/format.js";
import { viewState } from "./view-state.js";

let s = defaults();
let blocked = false;
let startupWarn = "";
const subscribers = new Set();

// The storage banner and save note live in the platform's DOM, which is replaced on a platform switch,
// so their text is kept here and painted again by paintStorageStatus().
const storageStatus = { error: "", note: "" };

export function paintStorageStatus() {
  const errorEl = $("storageError");
  if (errorEl) {
    errorEl.textContent = storageStatus.error;
    errorEl.hidden = !storageStatus.error;
  }
  const noteEl = $("saveStatus");
  if (noteEl && storageStatus.note) noteEl.textContent = storageStatus.note;
}

export function showError(message) {
  storageStatus.error = message;
  paintStorageStatus();
}

function setSaveNote(text) {
  storageStatus.note = text;
  paintStorageStatus();
}

export function getState() {
  return s;
}

export function getMaxTripDate(trip) {
  if (!trip) return "";
  let max = "";
  for (const a of trip.agenda || []) {
    const d = a.endDate || a.date;
    if (d && (!max || d > max)) max = d;
  }
  for (const w of trip.work || []) {
    if (w.date && (!max || w.date > max)) max = w.date;
  }
  return max;
}

export function updateTripDateRange() {
  const active = getActiveTrip();
  if (active) {
    setTripDates(active.startDate, active.endDate, getMaxTripDate(active));
  } else {
    setTripDates(START, END);
  }
}

export function getTrips() {
  return s.trips || [];
}

export function getActiveTrip() {
  return s.trips?.find(t => t.id === s.activeTripId) || s.trips?.[0] || null;
}

export function setActiveTrip(tripId) {
  const trip = s.trips?.find(t => t.id === tripId);
  if (!trip) return false;
  s.activeTripId = trip.id;
  updateTripDateRange();
  viewState.calendar.cursor = defaultDate();
  commit();
  return true;
}

export function addTrip({ name, startDate, endDate }, setAsActive = true) {
  if (!s.trips) s.trips = [];
  const start = validAnyDate(startDate) ? startDate : todayIso();
  const end = (endDate && validAnyDate(endDate) && endDate >= start) ? endDate : "";
  const trip = {
    id: uid(),
    name: (typeof name === "string" && name.trim()) ? name.trim().slice(0, 100) : "Untitled Trip",
    startDate: start,
    endDate: end,
    agenda: [],
    packing: [],
    work: [],
    balance: defaultBalance()
  };
  s.trips.push(trip);
  if (setAsActive || s.trips.length === 1) {
    s.activeTripId = trip.id;
    updateTripDateRange();
    viewState.calendar.cursor = defaultDate();
  }
  commit();
  return trip;
}

export function updateTrip(tripId, { name, startDate, endDate }) {
  const trip = s.trips?.find(t => t.id === tripId);
  if (!trip) return false;
  if (name !== undefined) {
    trip.name = (typeof name === "string" && name.trim()) ? name.trim().slice(0, 100) : trip.name;
  }
  if (startDate && validAnyDate(startDate)) {
    trip.startDate = startDate;
  }
  if (endDate !== undefined) {
    trip.endDate = (endDate && validAnyDate(endDate) && endDate >= trip.startDate) ? endDate : "";
  }
  if (s.activeTripId === trip.id) {
    updateTripDateRange();
    if (!inTrip(viewState.calendar.cursor)) {
      viewState.calendar.cursor = defaultDate();
    }
  }
  commit();
  return true;
}

export function deleteTrip(tripId) {
  if (!s.trips || s.trips.length <= 1) return false;
  const idx = s.trips.findIndex(t => t.id === tripId);
  if (idx === -1) return false;
  s.trips.splice(idx, 1);
  if (s.activeTripId === tripId) {
    s.activeTripId = s.trips[0].id;
    updateTripDateRange();
    viewState.calendar.cursor = defaultDate();
  }
  commit();
  return true;
}

export function setState(newState, shouldSave = true) {
  if (!newState || typeof newState !== "object") return;
  if (!Array.isArray(newState.trips) || !newState.activeTripId) {
    s = fromAnyVersion(newState);
  } else {
    s = newState;
    attachActiveTripProxies(s);
  }
  updateTripDateRange();
  viewState.calendar.cursor = defaultDate();
  if (shouldSave) {
    commit();
  }
}

export function isBlocked() {
  return blocked;
}

export function setBlocked(val) {
  blocked = val;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notifySubscribers() {
  for (const fn of subscribers) {
    try {
      fn(s);
    } catch (err) {
      console.error("Subscriber error:", err);
    }
  }
}

export function save() {
  updateTripDateRange();
  if (blocked || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    if (!startupWarn) storageStatus.error = "";
    setSaveNote(SAVED_TEXT);
  } catch (error) {
    storageStatus.note = "Changes are not saved.";
    showError(`Changes are not saved: ${error.message} Download a backup before closing this page.`);
  }
}

export function commit() {
  notifySubscribers();
  save();
}

export function initStore() {
  if (typeof localStorage === "undefined") {
    s = defaults();
    updateTripDateRange();
    viewState.calendar.cursor = defaultDate();
    return s;
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      s = defaults();
      updateTripDateRange();
      viewState.calendar.cursor = defaultDate();
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {}
    } else {
      const parsed = JSON.parse(raw);
      s = fromAnyVersion(parsed);
      attachActiveTripProxies(s);
      updateTripDateRange();
      viewState.calendar.cursor = defaultDate();

      // Synchronize confirmed flight booking details if unmodified placeholders exist
      let updatedSeedFlights = false;
      for (const trip of s.trips || []) {
        const originalAgendaLength = trip.agenda.length;
        trip.agenda = trip.agenda.filter(a => a.id !== "seed-flight-out" && a.id !== "seed-flight-home");
        if (trip.agenda.length !== originalAgendaLength) updatedSeedFlights = true;
        for (const item of trip.agenda) {
          if (!item.tz || !TIMEZONES.some(t => t.id === item.tz)) {
            item.tz = DEFAULT_TZ;
            updatedSeedFlights = true;
          }
          if (!item.endTz || !TIMEZONES.some(t => t.id === item.endTz)) {
            item.endTz = item.tz;
            updatedSeedFlights = true;
          }
        }
      }
      if (updatedSeedFlights) {
        try {
          localStorage.setItem(KEY, JSON.stringify(s));
        } catch {}
      }

      // Handle v1 safety-backup write failure separately without discarding migrated state
      if (parsed?.version !== 2) {
        try {
          if (localStorage.getItem(V1_KEY) === null) localStorage.setItem(V1_KEY, raw);
          localStorage.setItem(KEY, JSON.stringify(s));
        } catch (backupErr) {
          startupWarn = `Your v1 data was migrated in memory, but browser storage is full (${backupErr.message}). Download a backup now so your migrated planner is not lost.`;
        }
      } else if (s._hadWarnings) {
        startupWarn = "Some malformed records in saved data were skipped during loading. Download a backup before making edits if you need to inspect the raw storage.";
      }
    }
  } catch (error) {
    s = defaults();
    updateTripDateRange();
    viewState.calendar.cursor = defaultDate();
    blocked = true;
    storageStatus.note = "Saving is paused because the existing data could not be loaded.";
    showError(`Could not load saved data: ${error.message} Your saved data has not been overwritten. Restore a backup to resume saving.`);
  }

  if (startupWarn) {
    showError(startupWarn);
  }

  // Multi-tab storage synchronization
  if (typeof window !== "undefined") {
    window.addEventListener("storage", e => {
      if (e.key === KEY && e.newValue) {
        try {
          const incoming = fromAnyVersion(JSON.parse(e.newValue));
          s = incoming;
          attachActiveTripProxies(s);
          updateTripDateRange();
          if (!inTrip(viewState.calendar.cursor)) {
            viewState.calendar.cursor = defaultDate();
          }
          blocked = false;
          notifySubscribers();
          setSaveNote("Synced changes from another open tab.");
        } catch {}
      } else if (e.key === "arg-theme" && e.newValue && typeof document !== "undefined") {
        document.documentElement.dataset.theme = e.newValue;
      }
    });
  }

  return s;
}
