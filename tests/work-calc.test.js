import test from "node:test";
import assert from "node:assert/strict";

import {
  stdDayHours,
  getTripWorkdays,
  getTripHoursNeeded,
  leave,
  maxHoursFor,
  nextWorkDate
} from "../js/shared/domain/work-calc.js";
import { initStore, setState } from "../js/shared/state/store.js";
import { defaults } from "../js/shared/state/validation.js";
import { START } from "../js/shared/constants.js";

test("Work calculations: workday and standard hours", () => {
  const workdays = getTripWorkdays();
  assert.ok(workdays.length > 0);
  assert.ok(workdays.every(d => stdDayHours(d) > 0));

  const needed = getTripHoursNeeded();
  assert.ok(needed > 0);
  assert.equal(needed, workdays.length * 8);
});

test("Work calculations: leave pool and balance projection", () => {
  // Test with fresh defaults
  const st = defaults();
  st.balance.novBalance = 20;
  st.balance.accrual = 5;
  st.balance.accrualMonths = 2; // total pool = 20 + 10 = 30h
  st.balance.pre = 10; // pool after pre = 20h

  const workdays = getTripWorkdays();
  const hoursNeeded = workdays.length * 8;

  // Set 16 hours logged
  st.work = [
    { id: "w1", date: workdays[0], hours: 8, note: "" },
    { id: "w2", date: workdays[1], hours: 8, note: "" }
  ];

  // Pass to store mock
  const originalState = initStore();
  setState(st, false);

  const r = leave();
  assert.equal(r.logged, 16);
  assert.equal(r.pool, 20);
  assert.equal(r.needed, hoursNeeded);
  assert.equal(r.leaveHours, hoursNeeded - 16);
  assert.equal(r.balance, Math.round((20 - (hoursNeeded - 16)) * 100) / 100);

  // Clean up
  setState(originalState, false);
});

test("Work calculations: maxHoursFor single day clamping", () => {
  const st = defaults();
  st.work = [
    { id: "w1", date: START, hours: 8, note: "" },
    { id: "w2", date: START, hours: 6, note: "" }
  ];
  const originalState = initStore();
  setState(st, false);

  // For a new entry on START, remaining is 24 - 14 = 10 hours
  assert.equal(maxHoursFor(START, "w3"), 10);

  // For w1 itself, others are 6 hours, so max is 24 - 6 = 18 hours
  assert.equal(maxHoursFor(START, "w1"), 18);

  setState(originalState, false);
});

test("Work calculations: nextWorkDate selection logic", () => {
  const originalState = initStore();
  const workdays = getTripWorkdays();
  assert.ok(workdays.length >= 3);

  // 1. Initial empty state: returns first unlogged workday (or today if today is an unlogged workday in trip)
  const stEmpty = defaults();
  stEmpty.work = [];
  setState(stEmpty, false);
  const initialDate = nextWorkDate();
  assert.ok(workdays.includes(initialDate));

  // 2. Sequential progression: if work is logged on workday 0, next should be workday 1
  const stProg = defaults();
  stProg.work = [
    { id: "w1", date: workdays[0], hours: 8, note: "" }
  ];
  setState(stProg, false);
  assert.equal(nextWorkDate(), workdays[1]);

  // 3. Wrap around: if work is logged on the last workday, picks the first unlogged workday
  const stWrap = defaults();
  stWrap.work = [
    { id: "wLast", date: workdays[workdays.length - 1], hours: 8, note: "" }
  ];
  setState(stWrap, false);
  assert.equal(nextWorkDate(), workdays[0]);

  // 4. All workdays have entries but some have capacity (< 24 hours)
  const stCapacity = defaults();
  stCapacity.work = workdays.map((d, i) => ({
    id: `w-${i}`,
    date: d,
    hours: 8,
    note: ""
  }));
  setState(stCapacity, false);
  // All workdays are logged, so it should find a workday with room <= 23.99h
  const capacityDate = nextWorkDate();
  assert.ok(workdays.includes(capacityDate));

  setState(originalState, false);
});

