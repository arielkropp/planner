import test from "node:test";
import assert from "node:assert/strict";

import {
  toDate,
  addDays,
  daysDiff,
  dowOf,
  fmtDate,
  fmtDateLong,
  fmtDay,
  validAnyDate,
  validDate,
  parseDate,
  toUtcMs,
  convertTimezone,
  formatDurationMs,
  tzDifferenceLabel
} from "../js/utils/date.js";
import { START } from "../js/constants.js";

test("Date utilities: basic math and formatting", () => {
  const base = "2026-11-15";
  assert.equal(addDays(base, 1), "2026-11-16");
  assert.equal(addDays(base, 10), "2026-11-25");
  assert.equal(addDays(base, -5), "2026-11-10");
  assert.equal(daysDiff(base, "2026-11-20"), 5);
  assert.equal(daysDiff("2026-11-20", base), -5);

  assert.equal(fmtDate("2026-11-15"), "15/11/26");
  assert.equal(fmtDateLong("2026-11-15"), "15/11/2026");

  // Sunday is dow 0
  assert.equal(dowOf("2026-11-15"), 0);
  assert.equal(fmtDay("2026-11-15"), "Sun 15/11/26");
});

test("Date utilities: validation and parsing", () => {
  assert.equal(validAnyDate("2026-11-15"), true);
  assert.equal(validAnyDate("invalid"), false);
  assert.equal(validAnyDate("2026-02-30"), false); // Feb 30 does not exist

  // START date is always valid in trip
  assert.equal(validDate(START), true);

  // Parsing formats: ISO and dd/mm/yy or dd/mm/yyyy
  assert.equal(parseDate(START), START);
  const parts = START.split("-");
  const ddmmyy = `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  assert.equal(parseDate(ddmmyy), START);
});

test("Timezone utilities: UTC conversion and timezone offsets", () => {
  const utcMs = toUtcMs("2026-11-15", "14:00", "America/Argentina/Buenos_Aires");
  // Buenos Aires is UTC-3, so 14:00 ART is 17:00 UTC
  const d = new Date(utcMs);
  assert.equal(d.getUTCHours(), 17);

  // Convert 14:00 ART (UTC-3) to IST (UTC+2) -> should be 19:00 (+5 hours)
  const conv = convertTimezone("2026-11-15", "14:00", "America/Argentina/Buenos_Aires", "Asia/Jerusalem");
  assert.ok(conv);
  assert.equal(conv.time, "19:00");
  assert.equal(conv.diffDays, 0);

  // Timezone difference label
  const diffLabel = tzDifferenceLabel("Asia/Jerusalem", "America/Argentina/Buenos_Aires");
  assert.equal(diffLabel, "IST is 5h ahead of ART");

  // Duration formatting
  assert.equal(formatDurationMs(3600000), "1h");
  assert.equal(formatDurationMs(5400000), "1h 30m");
  assert.equal(formatDurationMs(900000), "15m");
});

