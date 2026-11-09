import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { build } from "../scripts/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let distDir;

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

describe("Challenger M3-2: Empirical Verification & Adversarial Stress Tests", () => {
  let server;
  let baseUrl;
  let browser;

  before(async () => {
    distDir = fs.mkdtempSync(path.join(tmpdir(), "planner-m3-2-"));
    build({ outDir: distDir });

    server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, "index.html");
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      const stream = fs.createReadStream(filePath);
      stream.on("error", () => {
        if (!res.headersSent) res.writeHead(404);
        res.end();
      });
      stream.pipe(res);
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
    if (distDir && fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  });

  async function createTrackedPage(options = { width: 1280, height: 800 }) {
    const isMobile = Boolean(options.isMobile);
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      isMobile,
      hasTouch: isMobile
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", err => errors.push(err.message || String(err)));
    page.on("console", msg => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("ERR_CERT_AUTHORITY_INVALID") && !text.includes("Failed to load resource")) {
          errors.push(text);
        }
      }
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("main > h1");
    await page.waitForSelector('section[data-screen="itinerary"]:not([hidden])');
    return { context, page, errors };
  }

  // =========================================================================
  // 1. TOUCH TARGET GEOMETRY & COLLISION TESTING
  // =========================================================================

  test("1.1 Touch target expansion: .pack-check-circle 44x44px pseudo-element hit-test & row title collision", async () => {
    const { context, page, errors } = await createTrackedPage({ width: 390, height: 844, isMobile: true });
    try {
      await page.click('a[href="#packing"]');
      await page.waitForSelector('section[data-screen="packing"]:not([hidden])');

      // Add a test packing item
      await page.locator("#quickAddPackItem").click();
      await page.locator("#packQuickAddInput").fill("Adversarial Raincoat");
      await page.locator("#packQuickAddSave").click();

      const itemRow = page.locator('.pack-row:has-text("Adversarial Raincoat")');
      await itemRow.waitFor({ state: "visible" });

      const circleBtn = itemRow.locator(".pack-check-circle");
      const rowContent = itemRow.locator(".pack-row-content");
      const titleEl = itemRow.locator(".pack-title");
      const qtyPill = itemRow.locator(".pack-qty-pill");

      // Verify ::before pseudo-element computed dimensions
      const pseudoDimensions = await circleBtn.evaluate(el => {
        const beforeStyle = window.getComputedStyle(el, "::before");
        return {
          content: beforeStyle.content,
          width: parseFloat(beforeStyle.width),
          height: parseFloat(beforeStyle.height),
          position: beforeStyle.position
        };
      });

      assert.ok(pseudoDimensions.width >= 44, `Pseudo width must be >= 44px, got ${pseudoDimensions.width}`);
      assert.ok(pseudoDimensions.height >= 44, `Pseudo height must be >= 44px, got ${pseudoDimensions.height}`);
      assert.equal(pseudoDimensions.position, "absolute");

      const circleBox = await circleBtn.boundingBox();
      assert.ok(circleBox, "Circle must have bounding box");

      // Initially not packed
      assert.ok(!await circleBtn.evaluate(el => el.classList.contains("is-checked")), "Initially unchecked");

      // Hit-test OUTER target: click 6px to the left of the visual circle (within the 44px expanded zone)
      await page.mouse.click(circleBox.x - 6, circleBox.y + circleBox.height / 2);
      await page.waitForTimeout(100);

      const isCheckedAfterOuterTap = await circleBtn.evaluate(el => el.classList.contains("is-checked"));
      assert.ok(isCheckedAfterOuterTap, "Outer pseudo-element tap must toggle checkbox to checked");

      // Hit-test direct center: click again to untoggle
      await circleBtn.click();
      await page.waitForTimeout(100);
      const isCheckedAfterCenterTap = await circleBtn.evaluate(el => el.classList.contains("is-checked"));
      assert.ok(!isCheckedAfterCenterTap, "Direct center tap must toggle checkbox back to unchecked");

      // Collision test: Click the row title. MUST open edit dialog, MUST NOT toggle checkbox!
      const titleBox = await titleEl.boundingBox();
      assert.ok(titleBox, "Title must have bounding box");
      await page.mouse.click(titleBox.x + 8, titleBox.y + titleBox.height / 2);

      const packDlg = page.locator("#packItemDialog");
      await packDlg.waitFor({ state: "visible" });

      // Verify checkbox was NOT toggled by title tap
      const isCheckedAfterTitleTap = await circleBtn.evaluate(el => el.classList.contains("is-checked"));
      assert.ok(!isCheckedAfterTitleTap, "Tapping title must NOT toggle checkbox");

      // Close dialog via Escape
      await page.keyboard.press("Escape");
      await packDlg.waitFor({ state: "hidden" });

      // Collision test: Click qty pill. MUST open edit dialog!
      await qtyPill.click();
      await packDlg.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await packDlg.waitFor({ state: "hidden" });

      assert.deepEqual(errors, [], "No console errors during touch target testing");
    } finally {
      await context.close();
    }
  });

  test("1.2 Mobile quantity stepper: touch target dimensions (>=44x44px) and increment/decrement responsiveness", async () => {
    const { context, page, errors } = await createTrackedPage({ width: 390, height: 844, isMobile: true });
    try {
      await page.click('a[href="#packing"]');
      await page.waitForSelector('section[data-screen="packing"]:not([hidden])');

      // Open pack item dialog via FAB
      await page.locator("#addPackItem").click();
      const packDlg = page.locator("#packItemDialog");
      await packDlg.waitFor({ state: "visible" });
      // Allow spring-in entrance animation (scale 0.98 -> 1.0) to complete
      await page.waitForTimeout(300);

      const decBtn = page.locator("#packQtyDec");
      const incBtn = page.locator("#packQtyInc");
      const qtyInput = page.locator("#packItemQty");

      const decBox = await decBtn.boundingBox();
      const incBox = await incBtn.boundingBox();
      const qtyBox = await qtyInput.boundingBox();

      // Verify >= 44px touch targets on mobile
      assert.ok(decBox.width >= 44, `Dec button width must be >= 44px, got ${decBox.width}`);
      assert.ok(decBox.height >= 44, `Dec button height must be >= 44px, got ${decBox.height}`);
      assert.ok(incBox.width >= 44, `Inc button width must be >= 44px, got ${incBox.width}`);
      assert.ok(incBox.height >= 44, `Inc button height must be >= 44px, got ${incBox.height}`);
      assert.ok(qtyBox.height >= 44, `Qty input height must be >= 44px, got ${qtyBox.height}`);

      // Initial value
      assert.equal(await qtyInput.inputValue(), "1");

      // Tap increment 4 times
      for (let i = 0; i < 4; i++) {
        await incBtn.click();
      }
      assert.equal(await qtyInput.inputValue(), "5", "Qty should increment to 5");

      // Tap decrement 7 times (should clamp at 1)
      for (let i = 0; i < 7; i++) {
        await decBtn.click();
      }
      assert.equal(await qtyInput.inputValue(), "1", "Qty should decrement and clamp at 1");

      await page.keyboard.press("Escape");
      await packDlg.waitFor({ state: "hidden" });

      assert.deepEqual(errors, [], "No console errors during stepper testing");
    } finally {
      await context.close();
    }
  });

  // =========================================================================
  // 2. WORK LOG ACCESSIBLE DELETION (NON-GESTURE ALTERNATIVE)
  // =========================================================================

  test("2.1 Work Log deletion via single-pointer click on .work-inline-delete-btn (cancel & confirm branches)", async () => {
    const { context, page, errors } = await createTrackedPage({ width: 1280, height: 800 });
    try {
      await page.click('a[href="#work"]');
      await page.waitForSelector('section[data-screen="work"]:not([hidden])');

      // Add a distinct work entry
      await page.locator("#addWorkItem").click();
      const activeDesc = page.locator('.work-row-wrapper.is-editing .work-inline-desc');
      await activeDesc.waitFor({ state: "visible" });
      await activeDesc.fill("Non-Gesture Deletion Target");
      await page.keyboard.press("Enter");

      // Ensure committed and rendered in static mode
      const initialRow = page.locator('.work-row-wrapper:has-text("Non-Gesture Deletion Target")');
      await initialRow.waitFor({ state: "visible" });
      const rowId = await initialRow.getAttribute("data-id");
      const workRow = page.locator(`.work-row-wrapper[data-id="${rowId}"]`);

      // 1. Enter inline edit by clicking row
      await workRow.locator(".work-row-content").click();
      const delBtn = workRow.locator(".work-inline-delete-btn");
      await delBtn.waitFor({ state: "visible" });
      assert.equal(await delBtn.getAttribute("aria-label"), "Delete work entry");

      // 2. Click delete button -> confirm dialog opens
      await delBtn.click();
      const confirmDlg = page.locator("#confirmDialog");
      await confirmDlg.waitFor({ state: "visible" });
      assert.equal(await confirmDlg.getAttribute("aria-modal"), "true");
      assert.ok((await page.locator("#confirmTitle").textContent()).includes("Delete"));

      // 3. Test CANCEL branch
      await page.locator("#confirmCancel").click();
      await confirmDlg.waitFor({ state: "hidden" });

      // Verify item still exists
      assert.ok(await workRow.isVisible(), "Item must NOT be deleted after Cancel");

      // 4. Test CONFIRM branch
      await delBtn.click();
      await confirmDlg.waitFor({ state: "visible" });
      await page.locator("#confirmOk").click();
      await confirmDlg.waitFor({ state: "hidden" });

      // Verify item removed from DOM
      await workRow.waitFor({ state: "detached" });
      assert.equal(await page.locator(`.work-row-wrapper[data-id="${rowId}"]`).count(), 0);

      assert.deepEqual(errors, [], "No console errors during inline work deletion");
    } finally {
      await context.close();
    }
  });

  test("2.2 Work Log keyboard deletion (Delete/Backspace on static row) & Backspace isolation during typing", async () => {
    const { context, page, errors } = await createTrackedPage({ width: 1280, height: 800 });
    try {
      await page.click('a[href="#work"]');
      await page.waitForSelector('section[data-screen="work"]:not([hidden])');

      // Add task
      await page.locator("#addWorkItem").click();
      const activeDesc = page.locator('.work-row-wrapper.is-editing .work-inline-desc');
      await activeDesc.waitFor({ state: "visible" });
      await activeDesc.fill("Keyboard Backspace Safety Item");
      await page.keyboard.press("Enter");

      const initialRow = page.locator('.work-row-wrapper:has-text("Keyboard Backspace Safety Item")');
      await initialRow.waitFor({ state: "visible" });
      const rowId = await initialRow.getAttribute("data-id");
      const workRow = page.locator(`.work-row-wrapper[data-id="${rowId}"]`);

      // Test Backspace isolation during input editing:
      await workRow.locator(".work-row-content").click();
      const descInput = workRow.locator(".work-inline-desc");
      await descInput.focus();
      await page.keyboard.type(" - Editing text");
      // Hit Backspace 8 times
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Backspace");
      }
      // Confirm dialog MUST NOT appear!
      const confirmDlg = page.locator("#confirmDialog");
      assert.ok(!await confirmDlg.isVisible(), "Backspace in text input must NOT trigger delete dialog");

      // Commit edit
      await page.keyboard.press("Enter");

      // Now test Delete key on focused static row:
      const rowContent = workRow.locator(".work-row-content");
      await rowContent.focus();
      await page.keyboard.press("Delete");

      await confirmDlg.waitFor({ state: "visible" });
      // Cancel first
      await page.keyboard.press("Escape");
      await confirmDlg.waitFor({ state: "hidden" });
      assert.ok(await workRow.isVisible(), "Item still present after Escape");

      // Press Delete again and confirm
      await rowContent.focus();
      await page.keyboard.press("Delete");
      await confirmDlg.waitFor({ state: "visible" });
      await page.locator("#confirmOk").click();
      await confirmDlg.waitFor({ state: "hidden" });

      await workRow.waitFor({ state: "detached" });
      assert.equal(await page.locator('.work-row-wrapper:has-text("Keyboard Backspace Safety Item")').count(), 0);

      assert.deepEqual(errors, [], "No console errors during keyboard deletion testing");
    } finally {
      await context.close();
    }
  });

  // =========================================================================
  // 3. HORIZONTAL SWIPE GESTURE COEXISTENCE & STRESS TESTING
  // =========================================================================

  test("3.1 Work Log horizontal swipe gesture cancellation resets transform and preserves tap functionality", async () => {
    const { context, page, errors } = await createTrackedPage({ width: 390, height: 844, isMobile: true });
    try {
      await page.click('a[href="#work"]');
      await page.waitForSelector('section[data-screen="work"]:not([hidden])');

      await page.locator("#addWorkItem").click();
      const activeDesc = page.locator('.work-row-wrapper.is-editing .work-inline-desc');
      await activeDesc.waitFor({ state: "visible" });
      await activeDesc.fill("Swipe Resilience Check");
      await page.keyboard.press("Enter");

      const workRow = page.locator('.work-row-wrapper:has-text("Swipe Resilience Check")');
      await workRow.waitFor({ state: "visible" });
      const rowContent = workRow.locator(".work-row-content");

      const box = await rowContent.boundingBox();
      assert.ok(box);

      // Perform swipe left gesture (drag dx = -180px)
      await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      const confirmDlg = page.locator("#confirmDialog");
      await confirmDlg.waitFor({ state: "visible" });

      // Click Cancel on confirm dialog
      await page.locator("#confirmCancel").click();
      await confirmDlg.waitFor({ state: "hidden" });

      // Allow reset transition to complete
      await page.waitForTimeout(300);

      // Verify row transform reset to 0
      const transform = await rowContent.evaluate(el => el.style.transform);
      assert.ok(transform.includes("translateX(0") || transform === "" || transform === "none", `Row transform must reset to 0: got ${transform}`);

      // Verify normal tap to edit still works cleanly
      await rowContent.click();
      const editWrapper = page.locator('.work-row-wrapper.is-editing');
      await editWrapper.waitFor({ state: "visible" });

      assert.deepEqual(errors, [], "No console errors during swipe cancellation and recovery");
    } finally {
      await context.close();
    }
  });

  test("3.2 Work Log rapid add, edit, and deletion stress test (20-cycle burst)", async () => {
    const { context, page, errors } = await createTrackedPage({ width: 1280, height: 800 });
    try {
      await page.click('a[href="#work"]');
      await page.waitForSelector('section[data-screen="work"]:not([hidden])');

      const initialCount = await page.locator(".work-row-wrapper").count();

      // Rapidly create 5 items
      for (let i = 0; i < 5; i++) {
        await page.locator("#addWorkItem").click();
        const descInput = page.locator('.work-row-wrapper.is-editing .work-inline-desc');
        await descInput.waitFor({ state: "visible" });
        await descInput.fill(`Burst Item ${i}`);
        await page.keyboard.press("Enter");
      }

      assert.equal(await page.locator(".work-row-wrapper").count(), initialCount + 5);

      // Rapidly delete 3 of the items via inline delete button
      for (let i = 0; i < 3; i++) {
        const row = page.locator(`.work-row-wrapper:has-text("Burst Item ${i}")`);
        await row.waitFor({ state: "visible" });
        const rowId = await row.getAttribute("data-id");
        await row.locator(".work-row-content").click();
        const delBtn = page.locator(`.work-row-wrapper[data-id="${rowId}"] .work-inline-delete-btn`);
        await delBtn.waitFor({ state: "visible" });
        await delBtn.click();
        const confirmDlg = page.locator("#confirmDialog");
        await confirmDlg.waitFor({ state: "visible" });
        await page.locator("#confirmOk").click();
        await confirmDlg.waitFor({ state: "hidden" });
        await page.locator(`.work-row-wrapper[data-id="${rowId}"]`).waitFor({ state: "detached" });
      }

      assert.equal(await page.locator(".work-row-wrapper").count(), initialCount + 2);

      assert.deepEqual(errors, [], "No console errors during rapid burst stress test");
    } finally {
      await context.close();
    }
  });

  // =========================================================================
  // 4. HEADING SEMANTICS & LANDMARK STRUCTURE
  // =========================================================================

  test("4.1 Heading hierarchy integrity: document h1, settings h2, and dialog headings across viewports", async () => {
    for (const vp of [{ width: 1280, height: 800, isMobile: false }, { width: 390, height: 844, isMobile: true }]) {
      const { context, page, errors } = await createTrackedPage(vp);
      try {
        // 1. Verify single h1 landmark inside main
        await page.waitForSelector("main > h1");
        const h1Elements = page.locator("main > h1");
        assert.equal(await h1Elements.count(), 1, "Exactly one h1 landmark inside <main>");
        assert.equal(await h1Elements.first().textContent(), "Trip Planner");
        assert.ok(await h1Elements.first().evaluate(el => el.classList.contains("sr-only")), "h1 has sr-only class");

        // 2. Settings screen h2 headings
        await page.click('a[href="#settings"]');
        await page.waitForSelector('section[data-screen="settings"]:not([hidden])');
        const settingsH2 = page.locator('section[data-screen="settings"] h2');
        assert.equal(await settingsH2.count(), 3, "Settings has 3 h2 headings");
        const settingsHeadings = await settingsH2.allTextContents();
        assert.deepEqual(settingsHeadings, ["Trips", "Work Log", "Data & Export"]);

        // 3. Dialog headings (h2)
        const dialogHeadings = await page.evaluate(() => {
          const dlgs = Array.from(document.querySelectorAll("dialog"));
          return dlgs.map(d => {
            const h2 = d.querySelector("h2");
            const h3 = Array.from(d.querySelectorAll("h3")).map(h => h.textContent.trim());
            return {
              id: d.id,
              hasH2: Boolean(h2),
              h2Text: h2 ? h2.textContent.trim() : null,
              h3List: h3
            };
          });
        });

        for (const dlg of dialogHeadings) {
          assert.ok(dlg.hasH2, `Dialog #${dlg.id} must possess an <h2> heading`);
        }

        // Fullscreen dialog h3 subsections
        const fsDlg = dialogHeadings.find(d => d.id === "itemFullscreenDialog");
        assert.ok(fsDlg, "Fullscreen dialog must exist");
        assert.ok(fsDlg.h3List.includes("Schedule"), "Fullscreen dialog must include Schedule h3");
        assert.ok(fsDlg.h3List.includes("Details"), "Fullscreen dialog must include Details h3");

        assert.deepEqual(errors, [], `No console errors during heading hierarchy check at ${vp.width}x${vp.height}`);
      } finally {
        await context.close();
      }
    }
  });
});
