import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMEZONES, findTimezone, hasDaylightSavings, searchTimezones } from "../js/shared/data/timezones.js";

test("Timezone database: required properties on every entry", () => {
  assert.ok(TIMEZONES.length >= 195, `Expected at least 195 entries, got ${TIMEZONES.length}`);

  for (const tz of TIMEZONES) {
    assert.equal(typeof tz["country name"], "string", "country name must be a string");
    assert.ok(tz["country name"].length > 0, "country name must not be empty");

    assert.equal(typeof tz["country code"], "string", "country code must be a string");
    assert.match(tz["country code"], /^[A-Z]{2}$/, `country code must be 2 uppercase letters: ${tz["country code"]}`);

    assert.equal(typeof tz["region_city"], "string", "region_city must be a string");
    assert.ok(tz["region_city"].length > 0, `region_city must not be empty for ${tz["country name"]}`);

    assert.equal(typeof tz["timezone"], "string", "timezone must be a string");
    assert.match(tz["timezone"], /^GMT [+-]\d{2}:\d{2}$/, `timezone must follow 'GMT ±HH:MM' format: ${tz["timezone"]}`);

    assert.ok("daylight savings start" in tz, "'daylight savings start' property must exist");
    assert.ok("Daylight savings end" in tz, "'Daylight savings end' property must exist");

    if (tz["daylight savings start"]) {
      assert.match(tz["daylight savings start"], /^\d{4}-\d{2}-\d{2}$/);
      assert.match(tz["Daylight savings end"], /^\d{4}-\d{2}-\d{2}$/);
    } else {
      assert.equal(tz["daylight savings start"], "");
      assert.equal(tz["Daylight savings end"], "");
    }
  }
});

test("Timezone database: every country in the world is represented", () => {
  const countryNames = new Set(TIMEZONES.map(t => t["country name"]));
  const countryCodes = new Set(TIMEZONES.map(t => t["country code"]));

  const sampleCountries = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Brazil", "Canada",
    "China", "Egypt", "France", "Germany", "India", "Indonesia", "Israel", "Italy",
    "Japan", "Kenya", "Mexico", "Nigeria", "Russia", "Saudi Arabia", "South Africa",
    "Spain", "United Kingdom", "United States", "Vietnam", "Zimbabwe"
  ];

  for (const country of sampleCountries) {
    assert.ok(countryNames.has(country), `Missing country: ${country}`);
  }

  // All 193 UN members + observers
  assert.ok(countryCodes.size >= 195, `Expected at least 195 distinct countries, found ${countryCodes.size}`);
});

test("Timezone database: multi-timezone countries have distinct regions/cities", () => {
  const usEntries = TIMEZONES.filter(t => t["country code"] === "US");
  assert.ok(usEntries.length >= 6, "US has multiple time zones");

  const usRegions = usEntries.map(t => t["region_city"]);
  assert.ok(usRegions.some(r => r.includes("Central")), "US includes Central");
  assert.ok(usRegions.some(r => r.includes("Mountain")), "US includes Mountain");
  assert.ok(usRegions.some(r => r.includes("Eastern")), "US includes Eastern");
  assert.ok(usRegions.some(r => r.includes("Pacific")), "US includes Pacific");
});

test("Timezone search: substring search by country and region_city", () => {
  // Argentina example from prompt
  const arg = searchTimezones("Argentina");
  assert.ok(arg.length >= 1);
  assert.equal(arg[0]["country name"], "Argentina");
  assert.equal(arg[0]["region_city"], "Buenos Aires");
  assert.equal(arg[0]["timezone"], "GMT -03:00");

  // Substring search on region_city
  const buenos = searchTimezones("buenos");
  assert.ok(buenos.length >= 1);
  assert.equal(buenos[0]["country name"], "Argentina");

  // Substring search on country
  const ger = searchTimezones("germany");
  assert.ok(ger.length >= 1);
  assert.equal(ger[0]["country name"], "Germany");
  assert.equal(ger[0]["region_city"], "Berlin");

  // Multi-tz country aliases
  const usa = searchTimezones("USA");
  assert.ok(usa.length >= 6);
  assert.ok(usa.some(t => t["country name"] === "United States"));

  const central = searchTimezones("central");
  assert.ok(central.some(t => t["region_city"].includes("Central")));

  // Offset search
  const offsetResults = searchTimezones("GMT -03:00");
  assert.ok(offsetResults.length >= 1);
  assert.ok(offsetResults.some(t => t["country name"] === "Argentina"));
});

test("Timezone helpers: daylight savings and findTimezone", () => {
  const alb = findTimezone("Europe/Tirane");
  assert.ok(alb);
  assert.equal(alb["country name"], "Albania");
  assert.equal(hasDaylightSavings(alb), true);

  const afg = findTimezone("Asia/Kabul");
  assert.ok(afg);
  assert.equal(afg["country name"], "Afghanistan");
  assert.equal(hasDaylightSavings(afg), false);

  assert.equal(findTimezone("UNKNOWN"), null);
  assert.equal(hasDaylightSavings(null), false);
});
