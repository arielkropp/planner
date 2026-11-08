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
  getWorkItems,
  getWorkItem,
  addWorkItem,
  updateWorkItem,
  deleteWorkItem,
  renderWorkStats,
  renderWorkList,
  renderSettingsTarget,
  parseAnyDate,
  activateInlineEdit,
  commitActiveEdit,
  openWorkDialog
} from "../js/shared/screens/work/index.js";

test("Work Log: loads items array from active trip", () => {
  setState(defaults(), false);
  const items = getWorkItems();
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 0);
});

test("Work Log: adding work items calculates hours and adds to store", () => {
  setState(defaults(), false);

  addWorkItem({
    note: "Bug fix for promos, urgent...",
    date: "2027-01-04",
    hours: 4
  });

  addWorkItem({
    note: "check jobs",
    date: "2027-01-08",
    hours: 2
  });

  const items = getWorkItems();
  assert.equal(items.length, 2);
  assert.equal(items[0].note, "Bug fix for promos, urgent...");
  assert.equal(items[0].hours, 4);
  assert.equal(items[0].date, "2027-01-04");
  assert.equal(items[1].note, "check jobs");
  assert.equal(items[1].hours, 2);
});

test("Work Log: updating a work item", () => {
  setState(defaults(), false);
  addWorkItem({
    note: "meeting with Or",
    date: "2027-01-10",
    hours: 1
  });

  const item = getWorkItems()[0];
  assert.ok(item);
  updateWorkItem(item.id, {
    note: "meeting with Or - completed",
    date: "2027-01-10",
    hours: 1.5
  });

  const updated = getWorkItem(item.id);
  assert.equal(updated.note, "meeting with Or - completed");
  assert.equal(updated.hours, 1.5);
});

test("Work Log: deleting a work item", () => {
  setState(defaults(), false);
  addWorkItem({ note: "Task A", date: "2027-01-05", hours: 3 });
  addWorkItem({ note: "Task B", date: "2027-01-06", hours: 2 });

  assert.equal(getWorkItems().length, 2);
  const firstId = getWorkItems()[0].id;

  deleteWorkItem(firstId);
  assert.equal(getWorkItems().length, 1);
  assert.equal(getWorkItems()[0].note, "Task B");
});

test("Work Log: target hours defaults to 42 and can be set in settings", () => {
  setState(defaults(), false);
  const active = getActiveTrip();
  assert.equal(active.workTarget, 42);

  // Mock DOM elements
  const targetEl = { textContent: "" };
  const loggedEl = { textContent: "" };
  const inputEl = { value: "" };

  globalThis.document = {
    getElementById: id => {
      if (id === "workTarget") return targetEl;
      if (id === "workLogged") return loggedEl;
      if (id === "workTargetInput") return inputEl;
      return null;
    },
    querySelectorAll: () => []
  };

  addWorkItem({ note: "Task 1", date: "2027-01-09", hours: 10 });

  renderWorkStats();
  renderSettingsTarget();

  assert.equal(loggedEl.textContent, "10");
  assert.equal(targetEl.textContent, "42");
  assert.equal(inputEl.value, 42);

  // Update target in active trip
  active.workTarget = 35;
  renderWorkStats();
  renderSettingsTarget();

  assert.equal(targetEl.textContent, "35");
  assert.equal(inputEl.value, 35);
});

test("Work Log: renderWorkList renders mockup columns and swipe backgrounds", () => {
  setState(defaults(), false);
  addWorkItem({ note: "Bug fix for promos, urgent...", date: "2027-01-04", hours: 4 });
  addWorkItem({ note: "check jobs", date: "2027-01-08", hours: 2 });
  addWorkItem({ note: "meeting with Or", date: "2027-01-10", hours: 1 });
  addWorkItem({ note: "request from Royi", date: "2027-01-09", hours: 3 });

  const listEl = {
    innerHTML: "",
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: id => (id === "workList" ? listEl : null),
    querySelectorAll: () => []
  };

  renderWorkList();

  // Verify rendered HTML contains row classes and data
  assert.ok(listEl.innerHTML.includes("work-row-wrapper"));
  assert.ok(listEl.innerHTML.includes("work-swipe-bg"));
  assert.ok(listEl.innerHTML.includes("work-row-content"));
  assert.ok(listEl.innerHTML.includes("Bug fix for promos, urgent..."));
  assert.ok(listEl.innerHTML.includes("04/01/27"));
  assert.ok(listEl.innerHTML.includes("check jobs"));
  assert.ok(listEl.innerHTML.includes("08/01/27"));
  assert.ok(listEl.innerHTML.includes("meeting with Or"));
  assert.ok(listEl.innerHTML.includes("10/01/27"));
  assert.ok(listEl.innerHTML.includes("request from Royi"));
  assert.ok(listEl.innerHTML.includes("09/01/27"));
});

test("Work Log: parseAnyDate handles text dates accurately", () => {
  assert.equal(parseAnyDate("04/01/27"), "2027-01-04");
  assert.equal(parseAnyDate("4/1/2027"), "2027-01-04");
  assert.equal(parseAnyDate("2027-01-08"), "2027-01-08");
  assert.equal(parseAnyDate("invalid-date"), null);
  assert.equal(parseAnyDate(""), null);
});

test("Work Log: inline edit mode renders inputs with no box styling", () => {
  setState(defaults(), false);
  addWorkItem({ note: "Feature planning", date: "2027-01-12", hours: 5 });
  const item = getWorkItems()[0];

  const listEl = {
    innerHTML: "",
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: id => (id === "workList" ? listEl : null),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.requestAnimationFrame = fn => fn();

  activateInlineEdit(item.id);

  // The active row should be rendered in edit mode
  assert.ok(listEl.innerHTML.includes("is-editing"));
  assert.ok(listEl.innerHTML.includes("work-inline-desc"));
  assert.ok(listEl.innerHTML.includes("work-inline-date"));
  assert.ok(listEl.innerHTML.includes("work-date-picker"));
  assert.ok(listEl.innerHTML.includes("work-date-picker-btn"));
  assert.ok(listEl.innerHTML.includes("work-inline-hrs"));
  assert.ok(listEl.innerHTML.includes('value="Feature planning"'));
  assert.ok(listEl.innerHTML.includes('value="12/01/27"'));
  assert.ok(listEl.innerHTML.includes('value="5"'));
});

test("Work Log: commitActiveEdit saves modified values to active trip work", () => {
  setState(defaults(), false);
  addWorkItem({ note: "Initial title", date: "2027-01-12", hours: 4 });
  const item = getWorkItems()[0];

  const descInput = { value: "Updated title inline" };
  const dateInput = { value: "15/01/27" };
  const pickerInput = { value: "2027-01-15" };
  const hrsInput = { value: "6.5" };

  const rowWrapper = {
    querySelector: sel => {
      if (sel === ".work-inline-desc") return descInput;
      if (sel === ".work-inline-date") return dateInput;
      if (sel === ".work-date-picker") return pickerInput;
      if (sel === ".work-inline-hrs") return hrsInput;
      return null;
    }
  };

  const listEl = { innerHTML: "", querySelectorAll: () => [] };
  globalThis.document = {
    getElementById: id => (id === "workList" ? listEl : null),
    querySelector: sel => (sel.includes(item.id) ? rowWrapper : null),
    querySelectorAll: () => []
  };
  globalThis.requestAnimationFrame = fn => fn();

  activateInlineEdit(item.id);
  commitActiveEdit();

  const updated = getWorkItem(item.id);
  assert.equal(updated.note, "Updated title inline");
  assert.equal(updated.date, "2027-01-15");
  assert.equal(updated.hours, 6.5);
});

test("Work Log: openWorkDialog(null) adds a new row and activates inline edit", () => {
  setState(defaults(), false);
  const listEl = { innerHTML: "", querySelectorAll: () => [] };
  globalThis.document = {
    getElementById: id => (id === "workList" ? listEl : null),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.requestAnimationFrame = fn => fn();

  openWorkDialog(null);

  const items = getWorkItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].hours, 4);
  assert.ok(listEl.innerHTML.includes("is-editing"));
});
