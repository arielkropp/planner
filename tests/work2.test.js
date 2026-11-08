import test from "node:test";
import assert from "node:assert/strict";

// In-memory mock for localStorage in Node test runner
const store = new Map();
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: key => store.delete(key),
  clear: () => store.clear()
};

import { defaults } from "../js/shared/state/validation.js";
import { setState, getActiveTrip } from "../js/shared/state/store.js";
import {
  getWork2Items,
  getWork2Item,
  addWork2Item,
  updateWork2Item,
  deleteWork2Item,
  renderWork2Stats,
  renderWork2List,
  renderSettingsTarget,
  parseAnyDate,
  activateInlineEdit,
  commitActiveEdit,
  openWork2Dialog
} from "../js/shared/screens/work2/index.js";

test("Work Log 2: loads items array from active trip", () => {
  setState(defaults(), false);
  const items = getWork2Items();
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 0);
});

test("Work Log 2: adding work items calculates hours and adds to store", () => {
  setState(defaults(), false);

  addWork2Item({
    note: "Bug fix for promos, urgent...",
    date: "2027-01-04",
    hours: 4
  });

  addWork2Item({
    note: "check jobs",
    date: "2027-01-08",
    hours: 2
  });

  const items = getWork2Items();
  assert.equal(items.length, 2);
  assert.equal(items[0].note, "Bug fix for promos, urgent...");
  assert.equal(items[0].hours, 4);
  assert.equal(items[0].date, "2027-01-04");
  assert.equal(items[1].note, "check jobs");
  assert.equal(items[1].hours, 2);
});

test("Work Log 2: updating a work item", () => {
  setState(defaults(), false);
  addWork2Item({
    note: "meeting with Or",
    date: "2027-01-10",
    hours: 1
  });

  const item = getWork2Items()[0];
  assert.ok(item);
  updateWork2Item(item.id, {
    note: "meeting with Or - completed",
    date: "2027-01-10",
    hours: 1.5
  });

  const updated = getWork2Item(item.id);
  assert.equal(updated.note, "meeting with Or - completed");
  assert.equal(updated.hours, 1.5);
});

test("Work Log 2: deleting a work item", () => {
  setState(defaults(), false);
  addWork2Item({ note: "Task A", date: "2027-01-05", hours: 3 });
  addWork2Item({ note: "Task B", date: "2027-01-06", hours: 2 });

  assert.equal(getWork2Items().length, 2);
  const firstId = getWork2Items()[0].id;

  deleteWork2Item(firstId);
  assert.equal(getWork2Items().length, 1);
  assert.equal(getWork2Items()[0].note, "Task B");
});

test("Work Log 2: target hours defaults to 42 and can be set in settings", () => {
  setState(defaults(), false);
  const active = getActiveTrip();
  assert.equal(active.workTarget, 42);

  // Mock DOM elements
  const targetEl = { textContent: "" };
  const loggedEl = { textContent: "" };
  const inputEl = { value: "" };

  globalThis.document = {
    getElementById: id => {
      if (id === "work2Target") return targetEl;
      if (id === "work2Logged") return loggedEl;
      if (id === "workTargetInput") return inputEl;
      return null;
    },
    querySelectorAll: () => []
  };

  addWork2Item({ note: "Task 1", date: "2027-01-09", hours: 10 });

  renderWork2Stats();
  renderSettingsTarget();

  assert.equal(loggedEl.textContent, "10");
  assert.equal(targetEl.textContent, "42");
  assert.equal(inputEl.value, 42);

  // Update target in active trip
  active.workTarget = 35;
  renderWork2Stats();
  renderSettingsTarget();

  assert.equal(targetEl.textContent, "35");
  assert.equal(inputEl.value, 35);
});

test("Work Log 2: renderWork2List renders mockup columns and swipe backgrounds", () => {
  setState(defaults(), false);
  addWork2Item({ note: "Bug fix for promos, urgent...", date: "2027-01-04", hours: 4 });
  addWork2Item({ note: "check jobs", date: "2027-01-08", hours: 2 });
  addWork2Item({ note: "meeting with Or", date: "2027-01-10", hours: 1 });
  addWork2Item({ note: "request from Royi", date: "2027-01-09", hours: 3 });

  const listEl = {
    innerHTML: "",
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: id => (id === "work2List" ? listEl : null),
    querySelectorAll: () => []
  };

  renderWork2List();

  // Verify rendered HTML contains row classes and data
  assert.ok(listEl.innerHTML.includes("work2-row-wrapper"));
  assert.ok(listEl.innerHTML.includes("work2-swipe-bg"));
  assert.ok(listEl.innerHTML.includes("work2-row-content"));
  assert.ok(listEl.innerHTML.includes("Bug fix for promos, urgent..."));
  assert.ok(listEl.innerHTML.includes("04/01/27"));
  assert.ok(listEl.innerHTML.includes("check jobs"));
  assert.ok(listEl.innerHTML.includes("08/01/27"));
  assert.ok(listEl.innerHTML.includes("meeting with Or"));
  assert.ok(listEl.innerHTML.includes("10/01/27"));
  assert.ok(listEl.innerHTML.includes("request from Royi"));
  assert.ok(listEl.innerHTML.includes("09/01/27"));
});

test("Work Log 2: parseAnyDate handles text dates accurately", () => {
  assert.equal(parseAnyDate("04/01/27"), "2027-01-04");
  assert.equal(parseAnyDate("4/1/2027"), "2027-01-04");
  assert.equal(parseAnyDate("2027-01-08"), "2027-01-08");
  assert.equal(parseAnyDate("invalid-date"), null);
  assert.equal(parseAnyDate(""), null);
});

test("Work Log 2: inline edit mode renders inputs with no box styling", () => {
  setState(defaults(), false);
  addWork2Item({ note: "Feature planning", date: "2027-01-12", hours: 5 });
  const item = getWork2Items()[0];

  const listEl = {
    innerHTML: "",
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: id => (id === "work2List" ? listEl : null),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.requestAnimationFrame = fn => fn();

  activateInlineEdit(item.id);

  // The active row should be rendered in edit mode
  assert.ok(listEl.innerHTML.includes("is-editing"));
  assert.ok(listEl.innerHTML.includes("work2-inline-desc"));
  assert.ok(listEl.innerHTML.includes("work2-inline-date"));
  assert.ok(listEl.innerHTML.includes("work2-date-picker"));
  assert.ok(listEl.innerHTML.includes("work2-date-picker-btn"));
  assert.ok(listEl.innerHTML.includes("work2-inline-hrs"));
  assert.ok(listEl.innerHTML.includes('value="Feature planning"'));
  assert.ok(listEl.innerHTML.includes('value="12/01/27"'));
  assert.ok(listEl.innerHTML.includes('value="5"'));
});

test("Work Log 2: commitActiveEdit saves modified values to active trip work", () => {
  setState(defaults(), false);
  addWork2Item({ note: "Initial title", date: "2027-01-12", hours: 4 });
  const item = getWork2Items()[0];

  const descInput = { value: "Updated title inline" };
  const dateInput = { value: "15/01/27" };
  const pickerInput = { value: "2027-01-15" };
  const hrsInput = { value: "6.5" };

  const rowWrapper = {
    querySelector: sel => {
      if (sel === ".work2-inline-desc") return descInput;
      if (sel === ".work2-inline-date") return dateInput;
      if (sel === ".work2-date-picker") return pickerInput;
      if (sel === ".work2-inline-hrs") return hrsInput;
      return null;
    }
  };

  const listEl = { innerHTML: "", querySelectorAll: () => [] };
  globalThis.document = {
    getElementById: id => (id === "work2List" ? listEl : null),
    querySelector: sel => (sel.includes(item.id) ? rowWrapper : null),
    querySelectorAll: () => []
  };
  globalThis.requestAnimationFrame = fn => fn();

  activateInlineEdit(item.id);
  commitActiveEdit();

  const updated = getWork2Item(item.id);
  assert.equal(updated.note, "Updated title inline");
  assert.equal(updated.date, "2027-01-15");
  assert.equal(updated.hours, 6.5);
});

test("Work Log 2: openWork2Dialog(null) adds a new row and activates inline edit", () => {
  setState(defaults(), false);
  const listEl = { innerHTML: "", querySelectorAll: () => [] };
  globalThis.document = {
    getElementById: id => (id === "work2List" ? listEl : null),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.requestAnimationFrame = fn => fn();

  openWork2Dialog(null);

  const items = getWork2Items();
  assert.equal(items.length, 1);
  assert.equal(items[0].hours, 4);
  assert.ok(listEl.innerHTML.includes("is-editing"));
});

