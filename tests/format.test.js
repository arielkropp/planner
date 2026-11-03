import test from "node:test";
import assert from "node:assert/strict";

import { num, fmtCost, parsePackQty, str, clamp, uid } from "../js/utils/format.js";

test("Format utilities: num formatting", () => {
  assert.equal(num(5), "5");
  assert.equal(num(5.234, 1), "5.2");
  assert.equal(num(-8.5, 1), "−8.5");
  assert.equal(num(0), "0");
});

test("Format utilities: fmtCost", () => {
  assert.equal(fmtCost(150, "USD"), "$150 USD");
  assert.equal(fmtCost(2500.5, "GBP"), "£2,500.5");
  assert.equal(fmtCost(80, "EUR"), "€80");
  assert.equal(fmtCost(300, "ILS"), "₪300");
  assert.equal(fmtCost(0, "USD"), "");
  assert.equal(fmtCost(-10, "USD"), "");
});

test("Format utilities: parsePackQty", () => {
  assert.equal(parsePackQty("1"), 1);
  assert.equal(parsePackQty("15"), 15);
  assert.equal(parsePackQty("99"), 99);
  assert.equal(parsePackQty("120"), 99); // max clamp to 99
  assert.equal(parsePackQty("0"), null);
  assert.equal(parsePackQty("-5"), null);
  assert.equal(parsePackQty("abc"), null);
  assert.equal(parsePackQty("1.5"), null);
});

test("Format utilities: helpers (str, clamp, uid)", () => {
  assert.equal(str("hello", 10, true), true);
  assert.equal(str("   ", 10, true), false);
  assert.equal(str("toolongstring", 5, false), false);

  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(7, 0, 10), 7);

  const id1 = uid();
  const id2 = uid();
  assert.ok(id1);
  assert.notEqual(id1, id2);
});

