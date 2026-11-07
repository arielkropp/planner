import test from "node:test";
import assert from "node:assert/strict";

import {
  initStore,
  getState,
  setState,
  getTrips,
  getActiveTrip,
  setActiveTrip,
  addTrip,
  updateTrip,
  deleteTrip
} from "../js/shared/state/store.js";
import { defaults, validateV2 } from "../js/shared/state/validation.js";
import { fromAnyVersion } from "../js/shared/state/migrations.js";
import { getTripStart, getTripEnd, hasTripEndDate, inTrip, validDate } from "../js/shared/utils/date.js";
import { viewState } from "../js/shared/state/view-state.js";
import { renderAgenda as renderDesktopAgenda } from "../js/desktop/screens/itinerary/agenda.js";
import { renderAgenda as renderMobileAgenda } from "../js/mobile/screens/itinerary/agenda.js";
import { renderCalendar as renderDesktopCalendar } from "../js/desktop/screens/itinerary/calendar.js";
import {
  openItemFullscreenDialog,
  setFsMode,
  requestCloseFsDialog
} from "../js/desktop/screens/itinerary/dialog-fullscreen.js";

test("Trips: defaults initializes with a default trip as active", () => {
  const d = defaults();
  assert.equal(d.trips.length, 1);
  assert.equal(d.activeTripId, d.trips[0].id);
  assert.equal(d.trips[0].name, "My Trip");
  assert.deepEqual(d.agenda, []);
  assert.deepEqual(d.packing, []);
  assert.deepEqual(d.work, []);
});

test("Trips: adding trips with and without end date", () => {
  setState(defaults(), false);

  // Add a trip with explicit date range
  const trip1 = addTrip({
    name: "Japan Spring",
    startDate: "2027-04-01",
    endDate: "2027-04-15"
  }, true);

  assert.equal(trip1.name, "Japan Spring");
  assert.equal(trip1.startDate, "2027-04-01");
  assert.equal(trip1.endDate, "2027-04-15");
  assert.equal(getActiveTrip().id, trip1.id);
  assert.equal(getTripStart(), "2027-04-01");
  assert.equal(getTripEnd(), "2027-04-15");
  assert.equal(hasTripEndDate(), true);
  assert.equal(inTrip("2027-04-10"), true);
  assert.equal(inTrip("2027-04-20"), false);

  // Add a trip with optional (empty) end date
  const trip2 = addTrip({
    name: "Nomad Summer",
    startDate: "2027-07-01",
    endDate: ""
  }, true);

  assert.equal(trip2.name, "Nomad Summer");
  assert.equal(trip2.startDate, "2027-07-01");
  assert.equal(trip2.endDate, "");
  assert.equal(getActiveTrip().id, trip2.id);
  assert.equal(getTripStart(), "2027-07-01");
  assert.equal(hasTripEndDate(), false);
  // Without end date, any date on/after start is inTrip
  assert.equal(inTrip("2027-07-15"), true);
  assert.equal(inTrip("2027-10-01"), true);
  assert.equal(inTrip("2027-06-30"), false);
});

test("Trips: active trip selection cascades down to itinerary, packing and work log", () => {
  setState(defaults(), false);

  const tripA = addTrip({ name: "Trip Alpha", startDate: "2027-01-01", endDate: "2027-01-10" }, true);
  // Add items while Trip A is active
  getState().agenda.push({
    id: "a1",
    title: "Tokyo Hotel",
    date: "2027-01-02",
    endDate: "",
    time: "15:00",
    endTime: "",
    tz: "Asia/Tokyo",
    endTz: "Asia/Tokyo",
    type: "Stay",
    status: "Confirmed",
    cost: 120,
    currency: "USD",
    notes: ""
  });
  getState().packing.push({ id: "p1", title: "Passport", category: "Documents", qty: 1, done: false });
  getState().work.push({ id: "w1", date: "2027-01-04", hours: 6, note: "Sprint meeting" });

  assert.equal(getState().agenda.length, 1);
  assert.equal(getState().packing.length, 1);
  assert.equal(getState().work.length, 1);
  assert.equal(getState().agenda[0].title, "Tokyo Hotel");

  // Add Trip B and make it active
  const tripB = addTrip({ name: "Trip Beta", startDate: "2027-05-01", endDate: "2027-05-10" }, true);

  // Active trip is now Trip B: itinerary, packing and work should be empty for Trip B
  assert.equal(getActiveTrip().id, tripB.id);
  assert.equal(getState().agenda.length, 0);
  assert.equal(getState().packing.length, 0);
  assert.equal(getState().work.length, 0);

  // Add items while Trip B is active
  getState().agenda.push({
    id: "a2",
    title: "Paris Flight",
    date: "2027-05-01",
    endDate: "",
    time: "08:00",
    endTime: "",
    tz: "Europe/Paris",
    endTz: "Europe/Paris",
    type: "Flight",
    status: "Confirmed",
    cost: 450,
    currency: "EUR",
    notes: ""
  });
  getState().packing.push({ id: "p2", title: "Beret", category: "Clothes", qty: 2, done: true });
  getState().work.push({ id: "w2", date: "2027-05-03", hours: 4, note: "Client review" });

  assert.equal(getState().agenda.length, 1);
  assert.equal(getState().agenda[0].title, "Paris Flight");
  assert.equal(getState().packing.length, 1);
  assert.equal(getState().packing[0].title, "Beret");
  assert.equal(getState().work.length, 1);
  assert.equal(getState().work[0].hours, 4);

  // Switch back to Trip A: all Trip A data is intact
  setActiveTrip(tripA.id);
  assert.equal(getActiveTrip().id, tripA.id);
  assert.equal(getState().agenda.length, 1);
  assert.equal(getState().agenda[0].title, "Tokyo Hotel");
  assert.equal(getState().packing.length, 1);
  assert.equal(getState().packing[0].title, "Passport");
  assert.equal(getState().work.length, 1);
  assert.equal(getState().work[0].hours, 6);

  // Switch back to Trip B: all Trip B data is intact
  setActiveTrip(tripB.id);
  assert.equal(getActiveTrip().id, tripB.id);
  assert.equal(getState().agenda.length, 1);
  assert.equal(getState().agenda[0].title, "Paris Flight");
  assert.equal(getState().packing.length, 1);
  assert.equal(getState().packing[0].title, "Beret");
});

test("Trips: updating a trip name and changing end date later", () => {
  setState(defaults(), false);

  const trip = addTrip({ name: "Initial Trip", startDate: "2027-08-01", endDate: "" }, true);
  assert.equal(hasTripEndDate(), false);

  // Update trip name and add an end date later
  updateTrip(trip.id, { name: "Updated Trip Name", endDate: "2027-08-20" });

  const updated = getActiveTrip();
  assert.equal(updated.name, "Updated Trip Name");
  assert.equal(updated.endDate, "2027-08-20");
  assert.equal(hasTripEndDate(), true);
  assert.equal(getTripEnd(), "2027-08-20");
});

test("Trips: deleting a trip activates another trip, cannot delete the only trip", () => {
  setState(defaults(), false);

  const t1 = addTrip({ name: "Trip 1", startDate: "2027-01-01", endDate: "2027-01-10" }, true);
  const t2 = addTrip({ name: "Trip 2", startDate: "2027-02-01", endDate: "2027-02-10" }, true);

  // Remove the initial default-trip so only t1 and t2 exist
  const initialTrip = getTrips().find(t => t.id !== t1.id && t.id !== t2.id);
  if (initialTrip) deleteTrip(initialTrip.id);

  assert.equal(getTrips().length, 2);
  setActiveTrip(t2.id);
  assert.equal(getActiveTrip().id, t2.id);

  // Delete the active trip (t2)
  const deleted = deleteTrip(t2.id);
  assert.equal(deleted, true);
  // Active trip switches to remaining trip (t1)
  assert.equal(getActiveTrip().id, t1.id);
  assert.equal(getTrips().length, 1);

  // Cannot delete when only one trip remains
  assert.equal(deleteTrip(t1.id), false);
  assert.equal(getTrips().length, 1);
});

test("Trips: validateV2 migrates legacy state without trips into default trip", () => {
  const legacyV2WithoutTrips = {
    version: 2,
    agenda: [
      { id: "a-leg", title: "Legacy Event", date: "2026-11-10", type: "Activity", status: "Confirmed" }
    ],
    packing: [
      { id: "p-leg", title: "Shoes", category: "Clothes", qty: 2, done: false }
    ],
    work: [
      { id: "w-leg", date: "2026-11-12", hours: 5, note: "Legacy work" }
    ],
    balance: { pre: 0, novBalance: 10, accrual: 2, accrualMonths: 1, stdDay: 8 },
    rates: { base: "USD", EUR: null, GBP: null, ILS: null }
  };

  const validated = validateV2(legacyV2WithoutTrips);
  assert.equal(validated.version, 2);
  assert.ok(Array.isArray(validated.trips));
  assert.equal(validated.trips.length, 1);
  assert.equal(validated.activeTripId, validated.trips[0].id);

  // Proxies delegate to the migrated trip
  assert.equal(validated.agenda.length, 1);
  assert.equal(validated.agenda[0].title, "Legacy Event");
  assert.equal(validated.packing.length, 1);
  assert.equal(validated.packing[0].title, "Shoes");
  assert.equal(validated.work.length, 1);
  assert.equal(validated.work[0].hours, 5);
});

test("Trips: schedule view renders all days of an overnight flight on trips past default END", () => {
  setState(defaults(), false);
  addTrip({ name: "Future Trip", startDate: "2027-06-01", endDate: "2027-06-15" }, true);

  getState().agenda.push({
    id: "flight-overnight",
    title: "TLV to JFK",
    date: "2027-06-01",
    endDate: "2027-06-02",
    time: "23:30",
    endTime: "05:30",
    tz: "Asia/Jerusalem",
    endTz: "America/New_York",
    type: "Flight",
    status: "Confirmed",
    cost: null,
    currency: "USD",
    notes: ""
  });

  const container = { innerHTML: "" };
  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById: id => (id === "agendaList" ? container : null)
  };

  try {
    for (const render of [renderDesktopAgenda, renderMobileAgenda]) {
      container.innerHTML = "";
      render();
      assert.match(container.innerHTML, /data-date="2027-06-01"/);
      assert.match(container.innerHTML, /data-date="2027-06-02"/);
      assert.match(container.innerHTML, /TLV to JFK \(Arrival\)/);
    }
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Trips: calendar cursor clamps to active trip on load, trip edit, and renderCalendar", () => {
  setState(defaults(), false);
  const trip = addTrip({ name: "Autumn 2027", startDate: "2027-10-05", endDate: "2027-10-20" }, true);
  assert.equal(viewState.calendar.cursor, "2027-10-05");

  // Move cursor to end of trip, then shrink trip endDate
  viewState.calendar.cursor = "2027-10-18";
  updateTrip(trip.id, { endDate: "2027-10-12" });
  assert.equal(viewState.calendar.cursor, "2027-10-05");

  // Even if cursor is manually out of bounds before renderCalendar, renderCalendar clamps it
  viewState.calendar.cursor = "2025-01-01";
  renderDesktopCalendar();
  assert.equal(viewState.calendar.cursor, "2027-10-05");
});

test("Trips: validateV2 preserves events and work logs outside START..END or adjusted trip bounds", () => {
  const legacyFarFuture = {
    version: 2,
    agenda: [
      {
        id: "fl-1",
        title: "Overnight Flight",
        date: "2028-03-10",
        endDate: "2028-03-11",
        time: "22:00",
        endTime: "06:00",
        type: "Flight",
        status: "Confirmed"
      }
    ],
    packing: [],
    work: [
      { id: "w-far", date: "2028-03-12", hours: 7, note: "Remote day" }
    ]
  };

  const validated = validateV2(legacyFarFuture);
  assert.equal(validated.agenda[0].date, "2028-03-10");
  assert.equal(validated.agenda[0].endDate, "2028-03-11");
  assert.equal(validated.work.length, 1);
  assert.equal(validated.work[0].date, "2028-03-12");
});

test("Fullscreen item dialog: view > edit auto-focuses title, shows delete next to save, and returns to view without saving", async () => {
  setState(defaults(), false);
  addTrip({ name: "Test Trip", startDate: "2027-06-01", endDate: "2027-06-10" }, true);
  getState().agenda.push({
    id: "ev-1",
    title: "Museum visit",
    date: "2027-06-02",
    endDate: "",
    time: "10:00",
    endTime: "12:00",
    tz: "Europe/Paris",
    endTz: "Europe/Paris",
    type: "Activity",
    status: "Confirmed",
    cost: 25,
    currency: "EUR",
    notes: "Louvre"
  });

  let focusedId = null;
  const closeUse = {
    href: "#i-x",
    setAttribute(k, v) { if (k === "href") this.href = v; }
  };
  const makeEl = id => ({
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    open: false,
    dataset: {},
    attrs: {},
    classList: { remove() {}, add() {}, toggle() {} },
    setCustomValidity() {},
    removeAttribute() {},
    setAttribute(k, v) { this.attrs[k] = v; },
    closest() { return { classList: { remove() {}, add() {}, toggle() {} }, setAttribute() {} }; },
    querySelector(sel) { return sel === "use" ? closeUse : null; },
    focus() { focusedId = id; },
    setSelectionRange() {},
    showModal() { this.open = true; },
    close() { this.open = false; }
  });

  const elements = new Map();
  const getEl = id => {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  };
  getEl("fsItemForm").elements = {
    fsType: { value: "Activity" },
    fsStatus: { value: "Confirmed" }
  };

  const prevDoc = globalThis.document;
  globalThis.document = { getElementById: getEl };

  try {
    // 1. Open existing event -> starts in view mode
    openItemFullscreenDialog("ev-1");
    assert.equal(getEl("itemFullscreenDialog").open, true);
    assert.equal(getEl("fsViewBody").hidden, false);
    assert.equal(getEl("fsEditBody").hidden, true);
    assert.equal(getEl("fsViewActions").hidden, false);
    assert.equal(getEl("fsEditActions").hidden, true);
    assert.equal(closeUse.href, "#i-x");

    // 2. Click Edit -> switches to edit mode, auto-focuses title, shows delete next to save, shows back icon
    setFsMode("edit");
    assert.equal(getEl("fsViewBody").hidden, true);
    assert.equal(getEl("fsEditBody").hidden, false);
    assert.equal(getEl("fsViewActions").hidden, true);
    assert.equal(getEl("fsEditActions").hidden, false);
    assert.equal(getEl("fsSave").hidden, false);
    assert.equal(getEl("fsDelete").hidden, false);
    assert.equal(focusedId, "fsTitle");
    assert.equal(closeUse.href, "#i-left");

    // 3. Go back without saving -> stays open and returns to view screen
    await requestCloseFsDialog();
    assert.equal(getEl("itemFullscreenDialog").open, true);
    assert.equal(getEl("fsViewBody").hidden, false);
    assert.equal(getEl("fsEditBody").hidden, true);
    assert.equal(getEl("fsViewActions").hidden, false);
    assert.equal(getEl("fsEditActions").hidden, true);
    assert.equal(closeUse.href, "#i-x");

    // 4. Closing from view screen closes the dialog
    await requestCloseFsDialog();
    assert.equal(getEl("itemFullscreenDialog").open, false);

    // 5. Creating a new event auto-focuses title and hides delete button
    focusedId = null;
    openItemFullscreenDialog();
    assert.equal(getEl("itemFullscreenDialog").open, true);
    assert.equal(getEl("fsEditBody").hidden, false);
    assert.equal(getEl("fsDelete").hidden, true);
    assert.equal(focusedId, "fsTitle");
    assert.equal(closeUse.href, "#i-x");
  } finally {
    globalThis.document = prevDoc;
  }
});
