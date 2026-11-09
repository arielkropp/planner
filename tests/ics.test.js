import test from "node:test";
import assert from "node:assert/strict";

import { icsEscape, formatIcsCalendar } from "../js/shared/domain/ics.js";

test("ICS: icsEscape properly escapes special iCalendar characters", () => {
  assert.equal(icsEscape(""), "");
  assert.equal(icsEscape(null), "");
  assert.equal(icsEscape(undefined), "");
  assert.equal(icsEscape("Hello World"), "Hello World");
  assert.equal(icsEscape("Backslash \\ and semicolon ;"), "Backslash \\\\ and semicolon \\;");
  assert.equal(icsEscape("Comma , and newline\r\ntwo"), "Comma \\, and newline\\ntwo");
  assert.equal(icsEscape("Line 1\nLine 2"), "Line 1\\nLine 2");
});

test("ICS: formatIcsCalendar generates RFC 5545 compliant VCALENDAR structure", () => {
  const agenda = [
    {
      id: "ev1",
      date: "2026-11-15",
      time: "10:30",
      endDate: "2026-11-15",
      endTime: "12:00",
      tz: "Asia/Tokyo",
      endTz: "Asia/Tokyo",
      title: "Team Meeting",
      type: "Activity",
      status: "Confirmed",
      confirmation: "CONF123",
      cost: 5000,
      currency: "JPY",
      url: "https://example.com/meeting",
      notes: "Bring notes & laptop"
    },
    {
      id: "ev2",
      date: "2026-11-16",
      endDate: "2026-11-17",
      time: "22:00",
      endTime: "08:30",
      tz: "Asia/Tokyo",
      endTz: "America/Los_Angeles",
      title: "Flight HND -> SFO",
      type: "Flight",
      status: "To book",
      bookBy: "2026-11-10",
      cost: 120000,
      currency: "JPY"
    },
    {
      id: "ev3",
      date: "2026-11-18",
      endDate: "2026-11-20",
      title: "Grand Hyatt",
      type: "Stay",
      status: "Confirmed"
    }
  ];

  const ics = formatIcsCalendar(agenda);

  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Trip Planner//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH"));
  assert.ok(ics.endsWith("END:VCALENDAR"));

  // Check ev1 (timed same-day single event)
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("UID:ev1@trip-planner"));
  assert.ok(ics.includes("SUMMARY:[Activity] Team Meeting (Confirmed)"));
  assert.ok(ics.includes("Confirmation: CONF123"));
  assert.ok(ics.includes("URL:https://example.com/meeting"));
  assert.ok(ics.includes("STATUS:CONFIRMED"));

  // Check ev2 (cross-timezone flight, To book status -> TENTATIVE)
  assert.ok(ics.includes("UID:ev2@trip-planner"));
  assert.ok(ics.includes("SUMMARY:[Flight] Flight HND -> SFO (To book)"));
  assert.ok(ics.includes("STATUS:TENTATIVE"));
  assert.ok(ics.includes("Timezones: Japan → United States (Pacific Standard Time)"));
  assert.ok(ics.includes("Book by: 2026-11-10"));

  // Check ev3 (all-day multi-day event)
  assert.ok(ics.includes("UID:ev3@trip-planner"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261118"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20261121")); // Exclusive end date (+1 day)
  assert.ok(ics.includes("SUMMARY:[Stay] Grand Hyatt (Confirmed)"));
});

test("ICS: formatIcsCalendar handles single-day timed event without endTime", () => {
  const agenda = [
    {
      id: "single-timed",
      date: "2026-11-22",
      time: "14:00",
      title: "Coffee Chat",
      type: "Activity",
      status: "Confirmed"
    }
  ];

  const ics = formatIcsCalendar(agenda);
  assert.ok(ics.includes("UID:single-timed@trip-planner"));
  // Should default DTEND to 1 hour (3600000ms) after start
  assert.ok(ics.includes("DTSTART:20261122T"));
  assert.ok(ics.includes("DTEND:20261122T"));
});
