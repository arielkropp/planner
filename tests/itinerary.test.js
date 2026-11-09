import test from "node:test";
import assert from "node:assert/strict";

import {
  sortItems,
  eventTitleText,
  scheduleTimeText,
  eventHourOnDay,
  itemsForDay
} from "../js/shared/domain/itinerary.js";
import { initStore, setState } from "../js/shared/state/store.js";
import { defaults } from "../js/shared/state/validation.js";

test("Itinerary: sortItems orders by date, then all-day before timed, then time, then title", () => {
  const items = [
    { id: "3", date: "2026-11-15", time: "14:00", title: "B event" },
    { id: "4", date: "2026-11-15", time: "14:00", title: "A event" },
    { id: "1", date: "2026-11-15", time: "", title: "All day event" },
    { id: "2", date: "2026-11-15", time: "09:00", title: "Morning event" },
    { id: "5", date: "2026-11-16", time: "08:00", title: "Next day event" }
  ];

  const sorted = [...items].sort(sortItems);
  assert.deepEqual(sorted.map(i => i.id), ["1", "2", "4", "3", "5"]);
});

test("Itinerary: eventTitleText generates correct labels across single and multi-day spans", () => {
  // Single day event returns title directly
  const singleDay = { date: "2026-11-15", title: "Sightseeing" };
  assert.equal(eventTitleText(singleDay, "2026-11-15"), "Sightseeing");
  assert.equal(eventTitleText(singleDay, null), "Sightseeing");

  // Multi-day Stay (3 nights: Nov 15 to Nov 18)
  const stay = { date: "2026-11-15", endDate: "2026-11-18", type: "Stay", title: "Hotel Bellagio" };
  assert.equal(eventTitleText(stay, "2026-11-15"), "Check-in: Hotel Bellagio");
  assert.equal(eventTitleText(stay, "2026-11-16"), "Hotel Bellagio (Night 1/3)");
  assert.equal(eventTitleText(stay, "2026-11-17"), "Hotel Bellagio (Night 2/3)");
  assert.equal(eventTitleText(stay, "2026-11-18"), "Check-out: Hotel Bellagio");

  // Multi-day Flight (Overnight: Nov 15 to Nov 16)
  const flight = { date: "2026-11-15", endDate: "2026-11-16", type: "Flight", title: "Flight UA875" };
  assert.equal(eventTitleText(flight, "2026-11-15"), "Flight UA875 (Departure)");
  assert.equal(eventTitleText(flight, "2026-11-16"), "Flight UA875 (Arrival)");

  // Multi-day generic activity / conference (3 days: Nov 15 to Nov 17)
  const conf = { date: "2026-11-15", endDate: "2026-11-17", type: "Activity", title: "JS World" };
  assert.equal(eventTitleText(conf, "2026-11-15"), "JS World (Start)");
  assert.equal(eventTitleText(conf, "2026-11-16"), "JS World (Day 2/3)");
  assert.equal(eventTitleText(conf, "2026-11-17"), "JS World (End)");
});

test("Itinerary: scheduleTimeText formats single-day, multi-day and cross-timezone intervals", () => {
  // Single day without timezone crossing
  const sameDay = {
    date: "2026-11-15",
    time: "10:00",
    endTime: "12:30",
    tz: "Asia/Tokyo",
    endTz: "Asia/Tokyo"
  };
  assert.equal(scheduleTimeText(sameDay, "2026-11-15"), "10:00–12:30");

  // Single day start time only
  const startOnly = { date: "2026-11-15", time: "15:00" };
  assert.equal(scheduleTimeText(startOnly, "2026-11-15"), "15:00");

  // Cross-timezone flight
  const crossTzFlight = {
    date: "2026-11-15",
    endDate: "2026-11-15",
    time: "17:00",
    endTime: "10:00",
    tz: "Asia/Tokyo",
    endTz: "America/Los_Angeles"
  };
  const label = scheduleTimeText(crossTzFlight, "2026-11-15");
  assert.ok(label.includes("17:00"));
  assert.ok(label.includes("10:00"));
  assert.ok(label.includes("Kyoto") || label.includes("Tokyo"));
  assert.ok(label.includes("Las Vegas") || label.includes("Los Angeles"));

  // Multi-day continuation line
  const multiDayFlight = {
    date: "2026-11-15",
    endDate: "2026-11-16",
    time: "23:00",
    endTime: "07:00",
    tz: "Asia/Tokyo",
    endTz: "Asia/Tokyo"
  };
  assert.equal(scheduleTimeText(multiDayFlight, "2026-11-15", false), "23:00");
  assert.equal(scheduleTimeText(multiDayFlight, "2026-11-16", true), "07:00");
  assert.equal(scheduleTimeText(multiDayFlight, "2026-11-15", true), "");
});

test("Itinerary: eventHourOnDay extracts correct starting hour", () => {
  const singleTimed = { date: "2026-11-15", time: "09:45" };
  assert.equal(eventHourOnDay(singleTimed, "2026-11-15"), 9);

  const singleUntimed = { date: "2026-11-15" };
  assert.equal(eventHourOnDay(singleUntimed, "2026-11-15"), null);

  const multiDay = { date: "2026-11-15", endDate: "2026-11-17", time: "18:00", endTime: "11:00" };
  assert.equal(eventHourOnDay(multiDay, "2026-11-15"), 18);
  assert.equal(eventHourOnDay(multiDay, "2026-11-16"), null);
  assert.equal(eventHourOnDay(multiDay, "2026-11-17"), 11);
});

test("Itinerary: itemsForDay filters and correctly sorts items spanning given date", () => {
  const st = defaults();
  st.agenda = [
    { id: "ev1", date: "2026-11-15", endDate: "2026-11-17", title: "Hotel Grand", type: "Stay" },
    { id: "ev2", date: "2026-11-16", time: "14:00", title: "Lunch Meeting", type: "Activity" },
    { id: "ev3", date: "2026-11-16", time: "09:00", title: "Breakfast", type: "Activity" },
    { id: "ev4", date: "2026-11-16", title: "All day museum pass", type: "Activity" },
    { id: "ev5", date: "2026-11-20", title: "Future event", type: "Activity" }
  ];

  const originalState = initStore();
  setState(st, false);

  const nov16Items = itemsForDay("2026-11-16");
  assert.equal(nov16Items.length, 4);

  // All-day items / items with null hour on that day come first, followed by timed items in order
  const ids = nov16Items.map(i => i.id);
  assert.ok(ids.includes("ev1"));
  assert.ok(ids.includes("ev4"));
  // ev3 (09:00) should appear before ev2 (14:00)
  assert.ok(ids.indexOf("ev3") < ids.indexOf("ev2"));
  // Future event on Nov 20 should not be present
  assert.ok(!ids.includes("ev5"));

  setState(originalState, false);
});
