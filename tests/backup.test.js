import test from "node:test";
import assert from "node:assert/strict";

import { serializeBackup, parseBackupText } from "../js/shared/domain/backup.js";
import { defaults } from "../js/shared/state/validation.js";

test("Backup: serializeBackup produces version 2 backup and strips draft items", () => {
  const dummyState = defaults();
  dummyState.trips[0].packing = [
    { id: "p1", name: "Passport", packed: true },
    { id: "p2", name: "Draft item", _draft: true },
    { id: "p3", name: "Charger", packed: false }
  ];
  dummyState.rates = { USD: 1, EUR: 0.92 };

  const backup = serializeBackup(dummyState);
  assert.equal(backup.version, 2);
  assert.equal(backup.state.version, 2);
  assert.equal(backup.state.activeTripId, dummyState.activeTripId);
  assert.equal(backup.state.rates.EUR, 0.92);

  // Packing items must not contain draft item
  const exportPacking = backup.state.trips[0].packing;
  assert.equal(exportPacking.length, 2);
  assert.equal(exportPacking.find(p => p.id === "p2"), undefined);
  assert.equal(exportPacking[0].id, "p1");
  assert.equal(exportPacking[1].id, "p3");
});

test("Backup: parseBackupText validates JSON structure and rejects invalid formats", () => {
  assert.throws(() => parseBackupText("not-json"), /Unexpected token/);
  assert.throws(() => parseBackupText("{}"), /This is not a planner backup/);
  assert.throws(() => parseBackupText(JSON.stringify({ version: 3, state: {} })), /This is not a planner backup/);
  assert.throws(() => parseBackupText(JSON.stringify({ version: 2 })), /This is not a planner backup/);
});

test("Backup: parseBackupText migrates version 1 backups to version 2 schema", () => {
  const legacyV1State = {
    planner: {
      agenda: [
        { id: "a1", title: "Flight", date: "2026-11-15", done: true }
      ],
      packing: [
        { id: "p1", title: "Jacket", category: "Clothing", done: true }
      ],
      work: [
        { id: "w1", date: "2026-11-16", hours: 4, note: "Remote sync" }
      ]
    }
  };

  const v1Payload = JSON.stringify({
    version: 1,
    state: legacyV1State
  });

  const restored = parseBackupText(v1Payload);
  assert.equal(restored.version, 2);
  assert.ok(Array.isArray(restored.trips));
  assert.equal(restored.trips.length, 1);
  assert.equal(restored.activeTripId, restored.trips[0].id);
  assert.equal(restored.trips[0].agenda[0].title, "Flight");
  assert.equal(restored.trips[0].packing[0].title, "Jacket");
  assert.equal(restored.trips[0].work[0].hours, 4);
});

test("Backup: parseBackupText successfully parses valid version 2 backups", () => {
  const def = defaults();
  const v2Payload = JSON.stringify({
    version: 2,
    state: def
  });

  const restored = parseBackupText(v2Payload);
  assert.equal(restored.version, 2);
  assert.equal(restored.activeTripId, def.activeTripId);
  assert.equal(restored.trips.length, def.trips.length);
});
