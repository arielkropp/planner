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

import {
  PACK_CATEGORIES,
  PACK_CATEGORY_META,
  getPackingItems,
  getPackingItem,
  addPackingItem,
  updatePackingItem,
  togglePackingItemDone,
  deletePackingItem
} from "../js/shared/screens/packing/storage.js";

test("Packing: Categories and metadata are properly configured", () => {
  assert.equal(PACK_CATEGORIES.length, 6);
  for (const cat of PACK_CATEGORIES) {
    const meta = PACK_CATEGORY_META[cat];
    assert.ok(meta, `Category ${cat} has metadata`);
    assert.ok(meta.slug, `Category ${cat} has a slug`);
    assert.ok(meta.bg, `Category ${cat} has a background color`);
    assert.ok(meta.color, `Category ${cat} has a text color`);
  }
});

test("Packing: Loads items array", () => {
  const items = getPackingItems();
  assert.ok(Array.isArray(items));
});

test("Packing: Adding and finding an item with toBuy", () => {
  const newItem = addPackingItem({
    title: "Hiking boots",
    category: "Clothes",
    qty: 2,
    toBuy: true,
    bag: "Checked bag",
    notes: "Broken in leather"
  });

  assert.ok(newItem.id);
  assert.equal(newItem.title, "Hiking boots");
  assert.equal(newItem.category, "Clothes");
  assert.equal(newItem.qty, 2);
  assert.equal(newItem.toBuy, true);
  assert.equal(newItem.bag, "Checked bag");
  assert.equal(newItem.notes, "Broken in leather");
  assert.equal(newItem.done, false);

  const fetched = getPackingItem(newItem.id);
  assert.deepEqual(fetched, newItem);
});

test("Packing: Updating an item and toggling packed state", () => {
  const item = addPackingItem({
    title: "USB-C Cable",
    category: "Electronics",
    qty: 1,
    toBuy: true
  });

  // Toggle done (packed)
  const done1 = togglePackingItemDone(item.id);
  assert.equal(done1, true);
  assert.equal(getPackingItem(item.id).done, true);

  const done2 = togglePackingItemDone(item.id);
  assert.equal(done2, false);
  assert.equal(getPackingItem(item.id).done, false);

  // Update details (toBuy is set via edit)
  const updated = updatePackingItem(item.id, {
    title: "Braided 2m USB-C Cable",
    qty: 3,
    bag: "Carry-on",
    toBuy: false
  });
  assert.equal(updated.title, "Braided 2m USB-C Cable");
  assert.equal(updated.qty, 3);
  assert.equal(updated.bag, "Carry-on");
  assert.equal(updated.toBuy, false);
});

test("Packing: Deleting an item", () => {
  const item = addPackingItem({ title: "Temporary note", category: "Other" });
  assert.ok(getPackingItem(item.id));

  const deleted = deletePackingItem(item.id);
  assert.equal(deleted, true);
  assert.equal(getPackingItem(item.id), null);
});

test("Packing: New items are added to the top of the list", () => {
  const topItem = addPackingItem({ title: "First on top", category: "Documents" });
  const items = getPackingItems();
  assert.equal(items[0].id, topItem.id);
  assert.equal(items[0].title, "First on top");
});

test("Packing: initPacking runs and populates categories when container is present", async () => {
  const dummyContainer = {
    hasChildNodes: () => false,
    innerHTML: ""
  };
  globalThis.document = {
    getElementById: (id) => id === "packCategories" ? dummyContainer : null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  globalThis.window = {
    addEventListener: () => {},
    location: { hash: "" }
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

  const { initPacking } = await import("../js/shared/screens/packing/index.js");
  assert.doesNotThrow(() => {
    initPacking();
  });
  assert.ok(dummyContainer.innerHTML.includes("Clothes"));
  assert.ok(dummyContainer.innerHTML.includes("Electronics"));
});
