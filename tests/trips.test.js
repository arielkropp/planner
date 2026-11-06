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
