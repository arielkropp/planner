import test from "node:test";
import assert from "node:assert/strict";

import { isValidTimeInterval, validateV2, defaults } from "../js/state/validation.js";
import { migrateV1, fromAnyVersion } from "../js/state/migrations.js";
import { START } from "../js/constants.js";

test("Validation: isValidTimeInterval chronological ordering", () => {
  // Same day without time
  assert.equal(isValidTimeInterval(START, START, "", ""), true);

  // Same day, same timezone
  assert.equal(isValidTimeInterval(START, START, "10:00", "12:00"), true);
  assert.equal(isValidTimeInterval(START, START, "12:00", "10:00"), false);

  // Cross timezone on same date: 10:00 ART (-3) vs 14:00 IST (+2)
  // 10:00 ART = 13:00 UTC. 14:00 IST = 12:00 UTC. 12:00 UTC < 13:00 UTC, so invalid!
  assert.equal(isValidTimeInterval(START, START, "10:00", "14:00", "America/Argentina/Buenos_Aires", "Asia/Jerusalem"), false);

  // 10:00 ART (-3) = 13:00 UTC vs 16:00 IST (+2) = 14:00 UTC -> valid!
  assert.equal(isValidTimeInterval(START, START, "10:00", "16:00", "America/Argentina/Buenos_Aires", "Asia/Jerusalem"), true);
});

test("Validation: validateV2 sanitizes state and fills defaults", () => {
  const d = defaults();
  const validated = validateV2(d);
  assert.equal(validated.version, 2);
  assert.deepEqual(validated.agenda, []);
  assert.deepEqual(validated.packing, []);
  assert.deepEqual(validated.work, []);

  // Reject non-v2
  assert.throws(() => validateV2({ version: 1 }), /Invalid planner data/);
});

test("Migrations: migrateV1 correctly transforms legacy schema", () => {
  const legacyV1 = {
    planner: {
      agenda: [
        { id: "act-1", title: "Wine Tour", date: START, time: "14:00", done: true, place: "Mendoza" }
      ],
      bookings: [
        { id: "book-1", title: "Hotel Park", date: START, type: "Stay", status: "Confirmed", details: "Room 101" }
      ],
      packing: [
        { id: "p-1", title: "Passport", category: "Documents", done: true }
      ],
      work: [
        { id: "w-1", date: START, hours: 4, note: "Sprint review" }
      ]
    }
  };

  const migrated = migrateV1(legacyV1);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.agenda.length, 2);
  assert.equal(migrated.agenda[0].title, "Wine Tour");
  assert.equal(migrated.agenda[0].status, "Confirmed");
  assert.equal(migrated.agenda[1].title, "Hotel Park");
  assert.equal(migrated.agenda[1].type, "Stay");
  assert.equal(migrated.packing.length, 1);
  assert.equal(migrated.packing[0].qty, 1);
  assert.equal(migrated.work.length, 1);
  assert.equal(migrated.work[0].hours, 4);

  // fromAnyVersion validates the migrated result
  const validated = fromAnyVersion(legacyV1);
  assert.equal(validated.version, 2);
  assert.equal(validated.agenda.length, 2);
});

