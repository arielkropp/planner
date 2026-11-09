import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMEZONES, findTimezone, searchTimezones, highlightMatch } from "../js/shared/data/timezones.js";

test("Timezone database: required properties on every entry", () => {
  assert.equal(TIMEZONES.length, 308, "Database has all 308 timezone entries");

  for (const tz of TIMEZONES) {
    assert.equal(typeof tz.title, "string", "title must be a string");
    assert.ok(tz.title.length > 0, "title must not be empty");

    assert.equal(typeof tz.offset, "string", "offset must be a string");
    assert.match(tz.offset, /^GMT[+-]\d+(?::\d{2})?$/, `offset must follow 'GMT±H' format: ${tz.offset}`);

    assert.equal(typeof tz.utcOffsetStandard, "string", "utcOffsetStandard must be a string");
    assert.match(tz.utcOffsetStandard, /^[+-]\d{2}:\d{2}$/, `utcOffsetStandard must follow '±HH:MM' format: ${tz.utcOffsetStandard}`);

    assert.equal(typeof tz.utcOffsetDST, "string", "utcOffsetDST must be a string");
    assert.match(tz.utcOffsetDST, /^[+-]\d{2}:\d{2}$/, `utcOffsetDST must follow '±HH:MM' format: ${tz.utcOffsetDST}`);

    assert.equal(typeof tz.country, "string", "country must be a string");
    assert.ok(tz.country.length > 0, "country must not be empty");

    assert.equal(typeof tz.countryCode, "string", "countryCode must be a string");
    assert.match(tz.countryCode, /^[A-Z]{2}$/, `countryCode must be 2 uppercase letters: ${tz.countryCode}`);

    assert.ok(Array.isArray(tz.searchTerms), "searchTerms must be an array");
    assert.ok(tz.searchTerms.length > 0, `searchTerms must have at least one entry for ${tz.title}`);
    for (const term of tz.searchTerms) {
      assert.equal(typeof term, "string");
      assert.ok(term.length > 0);
    }
  }
});

test("Timezone search: substring match on search terms with bold highlighting", () => {
  // Query "uai" matching "Ushuaia, Argentina" from prompt screenshot
  const uaiResults = searchTimezones("uai");
  assert.ok(uaiResults.length >= 1, "Should find matches for 'uai'");

  const argMatch = uaiResults.find(r => r.tz.country === "Argentina");
  assert.ok(argMatch, "Should find Argentina");
  assert.equal(argMatch.tz.title, "Argentina");
  assert.equal(argMatch.tz.offset, "GMT-3");
  assert.equal(argMatch.matchedTerm, "Ushuaia, Argentina");

  const highlighted = highlightMatch(argMatch.matchedTerm, "uai");
  assert.equal(highlighted, "Ush<strong>uai</strong>a, Argentina");

  // Case-insensitivity: "UAI" should highlight "uai" while preserving original casing
  const highlightedUpper = highlightMatch(argMatch.matchedTerm, "UAI");
  assert.equal(highlightedUpper, "Ush<strong>uai</strong>a, Argentina");
});

test("Timezone search: city and country search terms", () => {
  // Search "Paris"
  const parisResults = searchTimezones("Paris");
  assert.ok(parisResults.length >= 1);
  const paris = parisResults.find(r => r.tz.country === "France");
  assert.ok(paris);
  assert.equal(paris.tz.offset, "GMT+1");
  assert.equal(paris.matchedTerm, "Paris, France");
  assert.equal(highlightMatch(paris.matchedTerm, "Paris"), "<strong>Paris</strong>, France");

  // Search "New York"
  const nyResults = searchTimezones("New York");
  assert.ok(nyResults.length >= 1);
  const ny = nyResults.find(r => r.matchedTerm.includes("New York"));
  assert.ok(ny);
  assert.equal(ny.tz.title, "Eastern Standard Time");
  assert.equal(ny.tz.offset, "GMT-5");
  assert.equal(highlightMatch(ny.matchedTerm, "New York"), "<strong>New York</strong>, United States");

  // Search "Buenos Aires"
  const baResults = searchTimezones("Buenos Aires");
  assert.ok(baResults.length >= 1);
  const ba = baResults.find(r => r.tz.country === "Argentina");
  assert.ok(ba);
  assert.equal(ba.matchedTerm, "Buenos Aires, Argentina");
});

test("Timezone helpers: findTimezone", () => {
  const alb = findTimezone("AL");
  assert.ok(alb);
  assert.equal(alb.country, "Albania");

  const arg = findTimezone("America/Argentina/Buenos_Aires");
  assert.ok(arg);
  assert.equal(arg.country, "Argentina");

  assert.equal(findTimezone("UNKNOWN"), null);
});

test("Timezone search: deduplicates search results per timezone", () => {
  // Query "Isr" should only return Israel once, not multiple times for Jerusalem and Tel Aviv
  const isrResults = searchTimezones("Isr");
  const israelMatches = isrResults.filter(r => r.tz.id === "Asia/Jerusalem");
  assert.equal(israelMatches.length, 1, "Should only return Israel once in search results");

  // Query "Argentina" should only return Argentina once, not 14 times
  const argResults = searchTimezones("Argentina");
  const argMatches = argResults.filter(r => r.tz.id === "America/Argentina/Buenos_Aires");
  assert.equal(argMatches.length, 1, "Should only return Argentina once in search results");

  // Query "United States" should return distinct timezones with no duplicate ids
  const usResults = searchTimezones("United States");
  const ids = usResults.map(r => r.tz.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, "Every returned timezone in US search must have a unique id");
});

test("Timezone search: handles entries with missing or fallback searchTerms without throwing", () => {
  // Empty query returns all timezones
  const emptyResults = searchTimezones("");
  assert.ok(emptyResults.length >= 308, "Empty query returns all timezone entries");
  for (const r of emptyResults) {
    assert.ok(r.tz, "Entry must have tz");
    assert.ok(typeof r.matchedTerm === "string" && r.matchedTerm.length > 0, "Entry must have non-empty matchedTerm");
  }
});

test("Timezone picker: openTimezoneDialog function is exported and can be called", async () => {
  const { openTimezoneDialog, initTimezoneDialog } = await import("../js/shared/components/timezone-picker.js");
  assert.equal(typeof openTimezoneDialog, "function");
  assert.equal(typeof initTimezoneDialog, "function");

  const origDoc = globalThis.document;
  try {
    let showModalCalled = false;
    const mockDlg = {
      dataset: {},
      showModal: () => { showModalCalled = true; },
      close: () => {},
      addEventListener: () => {}
    };
    const mockList = {
      innerHTML: "",
      hidden: false,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
    const mockInput = { value: "", addEventListener: () => {}, focus: () => {} };

    globalThis.document = {
      getElementById: id => {
        if (id === "timezoneDialog") return mockDlg;
        if (id === "tzResultsList") return mockList;
        if (id === "tzSearchInput") return mockInput;
        if (id === "tzSearchClear") return { hidden: true, addEventListener: () => {} };
        if (id === "tzEmptyMsg") return { hidden: true };
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => []
    };

    openTimezoneDialog({ currentTz: "Asia/Jerusalem", onSelect: () => {} });
    assert.equal(showModalCalled, true, "showModal must be called on timezoneDialog");
  } finally {
    globalThis.document = origDoc;
  }
});

test("Timezone picker: renders combobox ARIA attributes, unique option IDs and active descendant", async () => {
  const { openTimezoneDialog } = await import("../js/shared/components/timezone-picker.js");
  const origDoc = globalThis.document;
  try {
    const setAttrs = {};
    const mockInput = {
      value: "",
      setAttribute: (k, v) => { setAttrs[k] = v; },
      removeAttribute: k => { delete setAttrs[k]; },
      addEventListener: () => {},
      focus: () => {}
    };
    const mockDlg = {
      dataset: {},
      showModal: () => {},
      close: () => {},
      addEventListener: () => {}
    };
    let renderedHtml = "";
    const mockList = {
      set innerHTML(html) { renderedHtml = html; },
      get innerHTML() { return renderedHtml; },
      hidden: false,
      querySelector: sel => {
        if (sel === ".tz-item.selected" || sel === ".tz-item") {
          return { id: "tzOpt_0", classList: { add: () => {} } };
        }
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: () => {}
    };

    globalThis.document = {
      getElementById: id => {
        if (id === "timezoneDialog") return mockDlg;
        if (id === "tzResultsList") return mockList;
        if (id === "tzSearchInput") return mockInput;
        if (id === "tzSearchClear") return { hidden: true, addEventListener: () => {} };
        if (id === "tzEmptyMsg") return { hidden: true };
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => []
    };

    openTimezoneDialog({ currentTz: "Asia/Jerusalem" });
    assert.equal(setAttrs["aria-expanded"], "true");
    assert.equal(setAttrs["aria-activedescendant"], "tzOpt_0");
    assert.ok(renderedHtml.includes('id="tzOpt_0"'), "renders unique option id");
    assert.ok(renderedHtml.includes('tabindex="-1"'), "renders option with tabindex -1");
  } finally {
    globalThis.document = origDoc;
  }
});


