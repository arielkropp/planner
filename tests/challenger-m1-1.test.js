import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build } from "../scripts/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.resolve(root, "dist");

function findChromeExecutable() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const bin of ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
    if (fs.existsSync(bin)) return bin;
  }
  return undefined;
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

// =========================================================================
// PART 1: IN-MEMORY STRESS & LEAK HARNESS (NODE.JS TEST RUNNER)
// =========================================================================

describe("Challenger M1.1 - In-Memory Listener Cleanup & Reactivity Stress", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  };

  class TrackedEventTarget extends EventTarget {
    constructor(name = "Target") {
      super();
      this.name = name;
      this.activeListeners = [];
    }

    addEventListener(type, listener, options) {
      const entry = { type, listener, options, id: Math.random() };
      this.activeListeners.push(entry);

      if (options && options.signal) {
        if (options.signal.aborted) {
          this.activeListeners = this.activeListeners.filter(e => e !== entry);
        } else {
          options.signal.addEventListener("abort", () => {
            this.activeListeners = this.activeListeners.filter(e => e !== entry);
          }, { once: true });
        }
      }
      return super.addEventListener(type, listener, options);
    }

    removeEventListener(type, listener, options) {
      this.activeListeners = this.activeListeners.filter(e => !(e.type === type && e.listener === listener));
      return super.removeEventListener(type, listener, options);
    }

    getListenerCount(type) {
      return this.activeListeners.filter(e => e.type === type).length;
    }
  }

  class MockElement extends TrackedEventTarget {
    constructor(id = "") {
      super(`Element:${id}`);
      this.id = id;
      this.style = {};
      this.classList = {
        _classes: new Set(),
        add(...cls) { cls.forEach(c => this._classes.add(c)); },
        remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) { this._classes.delete(c); return false; }
            this._classes.add(c); return true;
          }
          if (force) this._classes.add(c); else this._classes.delete(c);
          return force;
        },
        contains(c) { return this._classes.has(c); }
      };
      this.dataset = {};
      this.hidden = false;
      this.value = "";
      this.checked = false;
      this.textContent = "";
      this.innerHTML = "";
      this.children = [];
    }

    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    contains() { return false; }
    hasChildNodes() { return false; }
    focus() {}
    blur() {}
    close() {}
    showModal() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 40 }; }
  }

  class MockDocument extends TrackedEventTarget {
    constructor() {
      super("Document");
      this.elements = new Map();
      this.documentElement = new MockElement("html");
      this.activeElement = null;
    }

    getElementById(id) {
      if (!this.elements.has(id)) {
        this.elements.set(id, new MockElement(id));
      }
      return this.elements.get(id);
    }

    querySelector(sel) {
      if (sel?.startsWith("#")) return this.getElementById(sel.slice(1));
      return null;
    }

    querySelectorAll() { return []; }
  }

  const mockDoc = new MockDocument();
  const mockWin = new TrackedEventTarget("Window");
  mockWin.visualViewport = new TrackedEventTarget("VisualViewport");
  mockWin.visualViewport.height = 800;
  mockWin.visualViewport.offsetTop = 0;
  mockWin.innerHeight = 800;
  mockWin.innerWidth = 1200;
  mockWin.location = { hash: "" };

  globalThis.document = mockDoc;
  globalThis.window = mockWin;
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);

  let initPacking, renderPacking;
  let addPackingItem, updatePackingItem, togglePackingItemDone, deletePackingItem, getPackingItems, getPackingItem;
  let initWork, renderWork, addWorkItem, updateWorkItem, deleteWorkItem, getWorkItems, getWorkItem, commitActiveEdit;
  let getState, setState, commit, subscribe, initStore, getActiveTrip, defaults;

  before(async () => {
    const packingMod = await import("../js/shared/screens/packing/index.js");
    initPacking = packingMod.initPacking;
    renderPacking = packingMod.renderPacking;

    const packingStorageMod = await import("../js/shared/screens/packing/storage.js");
    addPackingItem = packingStorageMod.addPackingItem;
    updatePackingItem = packingStorageMod.updatePackingItem;
    togglePackingItemDone = packingStorageMod.togglePackingItemDone;
    deletePackingItem = packingStorageMod.deletePackingItem;
    getPackingItems = packingStorageMod.getPackingItems;
    getPackingItem = packingStorageMod.getPackingItem;

    const workMod = await import("../js/shared/screens/work/index.js");
    initWork = workMod.initWork;
    renderWork = workMod.renderWork;
    addWorkItem = workMod.addWorkItem;
    updateWorkItem = workMod.updateWorkItem;
    deleteWorkItem = workMod.deleteWorkItem;
    getWorkItems = workMod.getWorkItems;
    getWorkItem = workMod.getWorkItem;
    commitActiveEdit = workMod.commitActiveEdit;

    const storeMod = await import("../js/shared/state/store.js");
    getState = storeMod.getState;
    setState = storeMod.setState;
    commit = storeMod.commit;
    subscribe = storeMod.subscribe;
    initStore = storeMod.initStore;
    getActiveTrip = storeMod.getActiveTrip;

    const valMod = await import("../js/shared/state/validation.js");
    defaults = valMod.defaults;

    setState(defaults(), false);
  });

  test("1. Packing screen pointerdown listener lifecycle with AbortSignal", () => {
    const initialCount = mockDoc.getListenerCount("pointerdown");
    const controller = new AbortController();

    initPacking({ signal: controller.signal });
    assert.equal(mockDoc.getListenerCount("pointerdown"), initialCount + 1, "Exactly 1 pointerdown listener attached");

    controller.abort();
    assert.equal(mockDoc.getListenerCount("pointerdown"), initialCount, "Listener cleanly removed on abort");
  });

  test("2. Packing screen 100x rapid mount/unmount stress test (zero leaks)", () => {
    const baselineCount = mockDoc.getListenerCount("pointerdown");

    for (let i = 0; i < 100; i++) {
      mockDoc.elements.clear();
      const ac = new AbortController();
      initPacking({ signal: ac.signal });
      assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount + 1);
      ac.abort();
      assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount);
    }

    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount, "Zero leaked listeners after 100 iterations");
  });

  test("3. Packing screen window listeners (keydown, resize) cleaned up on abort", () => {
    const initialKeydown = mockWin.getListenerCount("keydown");
    const initialResize = mockWin.getListenerCount("resize");

    const controller = new AbortController();
    initPacking({ signal: controller.signal });

    assert.equal(mockWin.getListenerCount("keydown"), initialKeydown + 1);
    assert.equal(mockWin.getListenerCount("resize"), initialResize + 1);

    controller.abort();

    assert.equal(mockWin.getListenerCount("keydown"), initialKeydown, "Keydown listener removed");
    assert.equal(mockWin.getListenerCount("resize"), initialResize, "Resize listener removed");
  });

  test("4. Packing screen with pre-aborted signal attaches 0 active listeners", () => {
    const baselineCount = mockDoc.getListenerCount("pointerdown");
    const preAborted = new AbortController();
    preAborted.abort();

    initPacking({ signal: preAborted.signal });
    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount, "Pre-aborted signal leaves 0 active listeners");
  });

  test("5. Work screen pointerdown listener lifecycle with AbortSignal", () => {
    const initialCount = mockDoc.getListenerCount("pointerdown");
    const controller = new AbortController();

    initWork({ signal: controller.signal });
    assert.equal(mockDoc.getListenerCount("pointerdown"), initialCount + 1, "Work screen mounted exactly 1 pointerdown listener");

    controller.abort();
    assert.equal(mockDoc.getListenerCount("pointerdown"), initialCount, "Work pointerdown listener removed on abort");
  });

  test("6. Work screen 100x rapid mount/unmount stress test (zero leaks)", () => {
    const baselineCount = mockDoc.getListenerCount("pointerdown");

    for (let i = 0; i < 100; i++) {
      mockDoc.elements.clear();
      const ac = new AbortController();
      initWork({ signal: ac.signal });
      assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount + 1);
      ac.abort();
      assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount);
    }

    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineCount, "Zero leaked work listeners after 100 iterations");
  });

  test("7. Work screen prevents zombie listener callbacks after unmount", () => {
    setState(defaults(), false);
    const initialItem = addWorkItem({ note: "Initial task", hours: 4, date: "2027-01-01" });
    assert.ok(initialItem);

    const controller = new AbortController();
    initWork({ signal: controller.signal });

    let mutationDispatchedAfterAbort = false;
    const unsub = subscribe(() => {
      mutationDispatchedAfterAbort = true;
    });

    controller.abort();
    mockDoc.dispatchEvent(new Event("pointerdown"));

    assert.equal(mutationDispatchedAfterAbort, false, "Zombie pointerdown listener did not execute or cause mutations after abort");
    unsub();
  });

  test("8. Interleaved packing and work screen lifecycle stress test", () => {
    const baselineDoc = mockDoc.getListenerCount("pointerdown");
    const acP1 = new AbortController();
    const acW1 = new AbortController();
    const acP2 = new AbortController();
    const acW2 = new AbortController();

    initPacking({ signal: acP1.signal });
    initWork({ signal: acW1.signal });
    initPacking({ signal: acP2.signal });
    initWork({ signal: acW2.signal });

    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineDoc + 4);

    acW1.abort();
    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineDoc + 3);

    acP2.abort();
    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineDoc + 2);

    acP1.abort();
    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineDoc + 1);

    acW2.abort();
    assert.equal(mockDoc.getListenerCount("pointerdown"), baselineDoc);
  });

  test("9. Every packing mutation invokes store subscribers via commit()", () => {
    setState(defaults(), false);
    let subscriberCalls = 0;

    const unsubscribe = subscribe(() => {
      subscriberCalls++;
    });

    // 1. addPackingItem
    const item = addPackingItem({ title: "Passport", category: "Documents", qty: 1, bag: "Backpack", toBuy: false });
    assert.equal(subscriberCalls, 1, "Subscriber called on addPackingItem");

    // 2. updatePackingItem
    updatePackingItem(item.id, { title: "Passport & Visa", qty: 2 });
    assert.equal(subscriberCalls, 2, "Subscriber called on updatePackingItem");

    // 3. togglePackingItemDone (pack)
    const isDone1 = togglePackingItemDone(item.id);
    assert.equal(isDone1, true);
    assert.equal(subscriberCalls, 3, "Subscriber called on togglePackingItemDone (pack)");

    // 4. togglePackingItemDone (unpack)
    const isDone2 = togglePackingItemDone(item.id);
    assert.equal(isDone2, false);
    assert.equal(subscriberCalls, 4, "Subscriber called on togglePackingItemDone (unpack)");

    // 5. deletePackingItem
    const deleted = deletePackingItem(item.id);
    assert.equal(deleted, true);
    assert.equal(subscriberCalls, 5, "Subscriber called on deletePackingItem");

    unsubscribe();
  });

  test("10. Every work mutation invokes store subscribers via commit()", () => {
    setState(defaults(), false);
    let subscriberCalls = 0;
    let lastObservedWork = [];

    const unsubscribe = subscribe(state => {
      subscriberCalls++;
      const active = state.trips?.find(t => t.id === state.activeTripId);
      lastObservedWork = [...(active?.work || [])];
    });

    // 1. addWorkItem
    const workId = addWorkItem({ note: "Feature planning", hours: 3.5, date: "2027-01-02" });
    assert.ok(workId);
    assert.equal(subscriberCalls, 1, "Subscriber called on addWorkItem");
    assert.equal(lastObservedWork.length, 1);

    // 2. updateWorkItem
    updateWorkItem(workId, { note: "Feature planning & design", hours: 5 });
    assert.equal(subscriberCalls, 2, "Subscriber called on updateWorkItem");
    assert.equal(lastObservedWork[0].hours, 5);

    // 3. deleteWorkItem
    deleteWorkItem(workId);
    assert.equal(subscriberCalls, 3, "Subscriber called on deleteWorkItem");
    assert.equal(lastObservedWork.length, 0);

    // 4. workTarget setting mutation via commit()
    const active = getActiveTrip();
    active.workTarget = 50;
    commit();
    assert.equal(subscriberCalls, 4, "Subscriber called on workTarget commit()");

    unsubscribe();
  });

  test("11. 1,000 rapid sequential packing mutations (high-throughput burst)", () => {
    setState(defaults(), false);
    let notificationCount = 0;
    const unsub = subscribe(() => {
      notificationCount++;
    });

    const ids = [];
    for (let i = 0; i < 500; i++) {
      const item = addPackingItem({ title: `Item ${i}`, category: "Electronics", qty: 1 });
      ids.push(item.id);
    }
    for (let i = 0; i < 250; i++) {
      togglePackingItemDone(ids[i]);
    }
    for (let i = 250; i < 500; i++) {
      deletePackingItem(ids[i]);
    }

    assert.equal(notificationCount, 1000, "Exactly 1,000 notifications delivered for 1,000 packing mutations");
    assert.equal(getPackingItems().length, 250, "Consistent store state after burst");
    unsub();
  });

  test("12. 1,000 rapid sequential work mutations (high-throughput burst)", () => {
    setState(defaults(), false);
    let notificationCount = 0;
    const unsub = subscribe(() => {
      notificationCount++;
    });

    const ids = [];
    for (let i = 0; i < 500; i++) {
      const id = addWorkItem({ note: `Sprint task ${i}`, hours: 2, date: "2027-01-03" });
      ids.push(id);
    }
    for (let i = 0; i < 250; i++) {
      updateWorkItem(ids[i], { note: `Sprint task ${i} updated`, hours: 4 });
    }
    for (let i = 250; i < 500; i++) {
      deleteWorkItem(ids[i]);
    }

    assert.equal(notificationCount, 1000, "Exactly 1,000 notifications delivered for 1,000 work mutations");
    assert.equal(getWorkItems().length, 250, "Consistent work log state after burst");
    unsub();
  });

  test("13. 50 concurrent subscribers & unsubscribe isolation", () => {
    setState(defaults(), false);
    const subscriberCounters = new Array(50).fill(0);
    const unsubs = [];

    for (let i = 0; i < 50; i++) {
      const idx = i;
      unsubs.push(subscribe(() => {
        subscriberCounters[idx]++;
      }));
    }

    addPackingItem({ title: "Multi-sub test", category: "Other" });

    for (let i = 0; i < 50; i++) {
      assert.equal(subscriberCounters[i], 1, `Subscriber ${i} notified`);
    }

    // Unsubscribe first 25
    for (let i = 0; i < 25; i++) {
      unsubs[i]();
    }

    addWorkItem({ note: "Work test", hours: 1, date: "2027-01-04" });

    for (let i = 0; i < 25; i++) {
      assert.equal(subscriberCounters[i], 1, `Unsubscribed ${i} did not receive notification`);
    }
    for (let i = 25; i < 50; i++) {
      assert.equal(subscriberCounters[i], 2, `Active subscriber ${i} received second notification`);
    }

    for (let i = 25; i < 50; i++) {
      unsubs[i]();
    }
  });

  test("14. Store subscriber resilience against throwing subscribers", () => {
    setState(defaults(), false);
    let healthySubscriberExecuted = false;

    const unsubFaulty = subscribe(() => {
      throw new Error("Adversarial subscriber fault injection");
    });

    const unsubHealthy = subscribe(() => {
      healthySubscriberExecuted = true;
    });

    const origError = console.error;
    console.error = () => {};

    try {
      addPackingItem({ title: "Fault tolerance test", category: "Other" });
    } finally {
      console.error = origError;
    }

    assert.equal(healthySubscriberExecuted, true, "Healthy subscriber executed despite preceding subscriber error");
    unsubFaulty();
    unsubHealthy();
  });
});

// =========================================================================
// PART 2: REAL CHROMIUM BROWSER VERIFICATION (PLAYWRIGHT)
// =========================================================================

describe("Challenger M1.1 - Real Chromium Browser Leak & Reactivity Verification", () => {
  let server;
  let baseUrl;
  let browser;

  before(async () => {
    build({ outDir: distDir });

    server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, "index.html");
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const executablePath = findChromeExecutable();
    browser = await chromium.launch({
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--ignore-certificate-errors"
      ]
    });
  });

  after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test("15. Chromium: Viewport switching (Desktop <-> Mobile) does not leak pointerdown listeners", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.addInitScript(() => {
        window.__pointerdownListeners = [];
        const originalAdd = Document.prototype.addEventListener;
        const originalRemove = Document.prototype.removeEventListener;

        Document.prototype.addEventListener = function(type, listener, options) {
          if (type === "pointerdown") {
            const entry = { listener, options };
            window.__pointerdownListeners.push(entry);

            if (options && options.signal) {
              options.signal.addEventListener("abort", () => {
                const idx = window.__pointerdownListeners.indexOf(entry);
                if (idx !== -1) window.__pointerdownListeners.splice(idx, 1);
              });
            }
          }
          return originalAdd.call(this, type, listener, options);
        };

        Document.prototype.removeEventListener = function(type, listener, options) {
          if (type === "pointerdown") {
            const idx = window.__pointerdownListeners.findIndex(e => e.listener === listener);
            if (idx !== -1) window.__pointerdownListeners.splice(idx, 1);
          }
          return originalRemove.call(this, type, listener, options);
        };
      });

      await page.goto(baseUrl, { waitUntil: "networkidle" });

      await page.click('a[href="#packing"]');
      await page.waitForSelector('section[data-screen="packing"]:not([hidden])');

      const initialCount = await page.evaluate(() => window.__pointerdownListeners.length);
      assert.ok(initialCount >= 1, `Expected >= 1 pointerdown listener on packing, got ${initialCount}`);

      for (let i = 0; i < 10; i++) {
        const isMobile = (i % 2 === 0);
        const width = isMobile ? 390 : 1280;
        const height = isMobile ? 844 : 800;
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(200);
      }

      const countAfterSwitches = await page.evaluate(() => window.__pointerdownListeners.length);
      assert.ok(
        countAfterSwitches <= initialCount + 1,
        `Expected document pointerdown listeners to remain bounded (<= ${initialCount + 1}), but got ${countAfterSwitches}`
      );
    } finally {
      await page.close();
    }
  });

  test("16. Chromium: Store commit() reactivity reflects immediately across packing and work UI", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      // 1. Packing Reactivity
      await page.click('a[href="#packing"]');
      await page.waitForSelector('section[data-screen="packing"]:not([hidden])');

      const initialPackCount = await page.evaluate(() => document.querySelectorAll(".pack-row").length);

      await page.click("#quickAddPackItem");
      await page.waitForSelector("#packQuickAddBox:not([hidden])");
      await page.fill("#packQuickAddInput", "Empirical Challenger Packing Item");
      await page.press("#packQuickAddInput", "Enter");

      await page.waitForTimeout(100);
      const newPackCount = await page.evaluate(() => document.querySelectorAll(".pack-row").length);
      assert.equal(newPackCount, initialPackCount + 1, "Packing row added to DOM immediately via commit reactivity");

      const rowContent = await page.textContent(".pack-row");
      assert.ok(rowContent.includes("Empirical Challenger Packing Item"));

      // 2. Work Reactivity
      await page.click('a[href="#work"]');
      await page.waitForSelector('section[data-screen="work"]:not([hidden])');

      const initialLoggedText = await page.textContent("#workLogged");
      const initialLogged = parseFloat(initialLoggedText) || 0;

      await page.click("#addWorkItem");
      await page.waitForSelector('.work-row-wrapper .work-inline-desc');
      await page.fill('.work-row-wrapper .work-inline-desc', "Adversarial Stress Test Work Log");
      await page.fill('.work-row-wrapper .work-inline-hrs', "6.5");

      await page.click(".work-header-row");
      await page.waitForTimeout(200);

      const updatedLoggedText = await page.textContent("#workLogged");
      const updatedLogged = parseFloat(updatedLoggedText) || 0;
      assert.equal(updatedLogged, initialLogged + 6.5, "Work logged hours updated immediately via commit reactivity");
    } finally {
      await page.close();
    }
  });
});
