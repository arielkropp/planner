/* Central State Store and Persistence */

import { KEY, V1_KEY, SAVED_TEXT, DEFAULT_TZ, TIMEZONES } from "../constants.js";
import { $ } from "../utils/dom.js";
import { defaults } from "./validation.js";
import { fromAnyVersion } from "./migrations.js";

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

export function setState(newState, shouldSave = true) {
  s = newState;
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
    return s;
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      s = defaults();
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {}
    } else {
      const parsed = JSON.parse(raw);
      s = fromAnyVersion(parsed);

      // Synchronize confirmed flight booking details if unmodified placeholders exist
      const originalAgendaLength = s.agenda.length;
      s.agenda = s.agenda.filter(a => a.id !== "seed-flight-out" && a.id !== "seed-flight-home");
      let updatedSeedFlights = s.agenda.length !== originalAgendaLength;
      for (const item of s.agenda) {
        if (!item.tz || !TIMEZONES.some(t => t.id === item.tz)) {
          item.tz = DEFAULT_TZ;
          updatedSeedFlights = true;
        }
        if (!item.endTz || !TIMEZONES.some(t => t.id === item.endTz)) {
          item.endTz = item.tz;
          updatedSeedFlights = true;
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
