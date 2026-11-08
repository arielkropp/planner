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
  PACK_BAGS,
  PACK_LOCATIONS,
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

test("Packing: Bag options are properly configured", () => {
  assert.equal(PACK_BAGS.length, 4);
  const labels = PACK_BAGS.map(b => b.label);
  assert.deepEqual(labels, ["Suitcase", "Backpack", "Trolley", "Hiking bag"]);
  assert.equal(PACK_LOCATIONS, PACK_BAGS);
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

test("Packing: initPacking runs and populates categories and bags when container is present", async () => {
  const dummyCats = {
    hasChildNodes: () => false,
    innerHTML: ""
  };
  const dummyBags = {
    hasChildNodes: () => false,
    innerHTML: "",
    addEventListener: () => {}
  };
  globalThis.document = {
    getElementById: (id) => {
      if (id === "packCategories") return dummyCats;
      if (id === "packBags") return dummyBags;
      return null;
    },
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
  assert.ok(dummyCats.innerHTML.includes("Clothes"));
  assert.ok(dummyCats.innerHTML.includes("Electronics"));
  assert.ok(dummyBags.innerHTML.includes("Suitcase"));
  assert.ok(dummyBags.innerHTML.includes("Backpack"));
  assert.ok(dummyBags.innerHTML.includes("Trolley"));
  assert.ok(dummyBags.innerHTML.includes("Hiking bag"));
});

test("Packing: updatePackLens positions lens accurately with getBoundingClientRect", async () => {
  const lens = {
    style: {},
    classList: { add: () => {} }
  };
  const activeBtn = {
    getBoundingClientRect: () => ({ left: 104.671875, width: 69.640625 }),
    offsetLeft: 105,
    offsetWidth: 70
  };
  const container = {
    getBoundingClientRect: () => ({ left: 0, width: 177.3125 }),
    clientLeft: 0,
    querySelector: () => activeBtn,
    querySelectorAll: () => [activeBtn]
  };

  globalThis.document = {
    getElementById: (id) => {
      if (id === "packViews") return container;
      if (id === "packLens") return lens;
      return null;
    },
    querySelectorAll: () => []
  };

  const { updatePackLens, setPackView } = await import("../js/shared/screens/packing/index.js");
  activeBtn.dataset = { packView: "to-pack" };
  activeBtn.setAttribute = () => {};
  setPackView("to-pack");
  updatePackLens(true);

  assert.equal(lens.style.transform, "translateX(104.671875px)");
  assert.equal(lens.style.width, "69.640625px");
});

test("Packing: renderPacking renders row wrappers with swipe background", async () => {
  const contentEl = {
    innerHTML: "",
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: id => (id === "packingContent" ? contentEl : null),
    querySelectorAll: () => []
  };

  const { renderPacking } = await import("../js/shared/screens/packing/index.js");
  addPackingItem({ title: "Passport", category: "Documents" });

  renderPacking();

  assert.ok(contentEl.innerHTML.includes("pack-row-wrapper"));
  assert.ok(contentEl.innerHTML.includes("pack-swipe-bg"));
  assert.ok(contentEl.innerHTML.includes("pack-swipe-action"));
  assert.ok(contentEl.innerHTML.includes("Passport"));
});

test("Packing: quick add adds item with default Other category and qty 1", async () => {
  let submitHandler = null;
  const dummyForm = {
    addEventListener: (evt, handler) => {
      if (evt === "submit") submitHandler = handler;
    }
  };
  const dummyInput = { value: "Toothbrush", focus: () => {} };
  const dummyBox = { hidden: false, style: {} };
  const contentEl = { innerHTML: "", querySelectorAll: () => [], addEventListener: () => {} };

  globalThis.document = {
    getElementById: id => {
      if (id === "packQuickAddForm") return dummyForm;
      if (id === "packQuickAddInput") return dummyInput;
      if (id === "packQuickAddBox") return dummyBox;
      if (id === "packingContent") return contentEl;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  globalThis.window = {
    addEventListener: () => {},
    location: { hash: "" }
  };

  const { initPacking } = await import("../js/shared/screens/packing/index.js");
  initPacking();

  assert.ok(submitHandler, "quick add form submit handler registered");
  submitHandler({ preventDefault: () => {} });

  const items = getPackingItems();
  const added = items.find(it => it.title === "Toothbrush");
  assert.ok(added, "Toothbrush added to packing items");
  assert.equal(added.category, "Other");
  assert.equal(added.qty, 1);
  assert.equal(dummyBox.hidden, true);
});

