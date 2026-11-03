import test from "node:test";
import assert from "node:assert/strict";

import {
  stdDayHours,
  getTripWorkdays,
  getTripHoursNeeded,
  leave,
  maxHoursFor,
  nextWorkDate
} from "../js/features/work/work-calc.js";
import { initStore, setState } from "../js/state/store.js";
import { defaults } from "../js/state/validation.js";
import { START } from "../js/constants.js";

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

