import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../scripts/build.mjs";

const root = resolve(import.meta.dirname, "..");

function extractCssRules(cssText) {
  // Strip comments first
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = {};
  // Simple regex parser for top-level CSS rule blocks
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(clean)) !== null) {
    const rawSelectors = match[1].trim();
    const body = match[2].trim();
    const declarations = {};
    body.split(";").forEach(decl => {
      const parts = decl.split(":");
      if (parts.length >= 2) {
        const prop = parts[0].trim();
        const val = parts.slice(1).join(":").trim();
        if (prop && val) {
          declarations[prop] = val;
        }
      }
    });
    // Support comma-separated selectors sharing same body
    rawSelectors.split(",").forEach(sel => {
      rules[sel.trim().replace(/\s+/g, " ")] = declarations;
    });
  }
  return rules;
}

test("Challenger M1.2 - 1. CSS parity for #packToBuyChip across states and dark mode", () => {
  const desktopCss = readFileSync(resolve(root, "css/desktop/packing.css"), "utf8");
  const mobileCss = readFileSync(resolve(root, "css/mobile/packing.css"), "utf8");

  assert.ok(desktopCss.includes("#packToBuyChip"), "Desktop packing.css contains #packToBuyChip rules");
  assert.ok(mobileCss.includes("#packToBuyChip"), "Mobile packing.css contains #packToBuyChip rules");

  const desktopRules = extractCssRules(desktopCss);
  const mobileRules = extractCssRules(mobileCss);

  // 1. Unchecked default state
  const uncheckSel = "#packToBuyChip input:not(:checked) + span";
  assert.ok(desktopRules[uncheckSel], `Desktop defines ${uncheckSel}`);
  assert.ok(mobileRules[uncheckSel], `Mobile defines ${uncheckSel}`);
  assert.equal(desktopRules[uncheckSel]["border-color"], "var(--c)");
  assert.equal(desktopRules[uncheckSel]["color"], "var(--c)");
  assert.equal(desktopRules[uncheckSel]["background"], "color-mix(in srgb, var(--c) 10%, transparent)");
  assert.deepEqual(desktopRules[uncheckSel], mobileRules[uncheckSel], "Unchecked state declarations match exactly");

  // 2. Active / Hover state for unselected
  const activeSel = "#packToBuyChip input:not(:checked) + span:active";
  const hoverSel = "#packToBuyChip input:not(:checked) + span:hover";
  assert.ok(desktopRules[activeSel], `Desktop defines ${activeSel}`);
  assert.ok(desktopRules[hoverSel], `Desktop defines hover state ${hoverSel} for desktop pointers`);
  assert.ok(mobileRules[activeSel], `Mobile defines ${activeSel}`);
  assert.equal(desktopRules[activeSel]["background"], "color-mix(in srgb, var(--c) 18%, transparent)");
  assert.equal(desktopRules[hoverSel]["background"], "color-mix(in srgb, var(--c) 18%, transparent)");
  assert.equal(mobileRules[activeSel]["background"], "color-mix(in srgb, var(--c) 18%, transparent)");

  // 3. Checked state
  const checkedSel = "#packToBuyChip input:checked + span";
  assert.ok(desktopRules[checkedSel], `Desktop defines ${checkedSel}`);
  assert.ok(mobileRules[checkedSel], `Mobile defines ${checkedSel}`);
  assert.equal(desktopRules[checkedSel]["background"], "var(--c)");
  assert.equal(desktopRules[checkedSel]["border-color"], "var(--c)");
  assert.equal(desktopRules[checkedSel]["color"], "#ffffff");
  assert.deepEqual(desktopRules[checkedSel], mobileRules[checkedSel], "Checked state declarations match exactly");

  // 4. Dark theme checked state
  const darkCheckedSel = ':root[data-theme="dark"] #packToBuyChip input:checked + span';
  assert.ok(desktopRules[darkCheckedSel], `Desktop defines dark mode rule ${darkCheckedSel}`);
  assert.ok(mobileRules[darkCheckedSel], `Mobile defines dark mode rule ${darkCheckedSel}`);
  assert.equal(desktopRules[darkCheckedSel]["color"], "#101317");
  assert.deepEqual(desktopRules[darkCheckedSel], mobileRules[darkCheckedSel], "Dark mode checked state matches exactly");

  // 5. Verify variable definitions in variables.css and markup wiring in pack-item.html
  const varsCss = readFileSync(resolve(root, "css/shared/variables.css"), "utf8");
  assert.match(varsCss, /--pack-tobuy:\s*#C85A17;/, "Light mode defines --pack-tobuy (#C85A17)");
  assert.match(varsCss, /--pack-tobuy:\s*#F5A64C;/, "Dark mode defines --pack-tobuy (#F5A64C)");

  const packItemHtml = readFileSync(resolve(root, "html/shared/dialogs/pack-item.html"), "utf8");
  assert.match(packItemHtml, /id="packToBuyChip"[^>]*style="--c:\s*var\(--pack-tobuy\);"/, "pack-item.html binds --c: var(--pack-tobuy) on #packToBuyChip");
});

test("Challenger M1.2 - 2. Complete absence of dead files and dead code in source and dist", () => {
  // Check dead files on filesystem
  const deadFiles = [
    "html/shared/dialogs/item.html",
    "html/shared/dialogs/leave.html",
    "js/desktop/screens/itinerary/dialog.js",
    "js/mobile/screens/itinerary/dialog.js",
    "js/shared/screens/itinerary/dialog.js"
  ];
  for (const relPath of deadFiles) {
    assert.strictEqual(existsSync(resolve(root, relPath)), false, `Dead file must not exist: ${relPath}`);
    assert.strictEqual(existsSync(resolve(root, "dist", relPath)), false, `Dead file must not exist in dist: ${relPath}`);
  }

  // Check no item.html or leave.html in html/
  function scanDir(dir) {
    let files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...scanDir(full));
      } else {
        files.push(full);
      }
    }
    return files;
  }
  const allHtmlFiles = scanDir(resolve(root, "html")).map(p => p.split(/[/\\]/).pop());
  assert.ok(!allHtmlFiles.includes("item.html"), "Zero files named item.html in html/");
  assert.ok(!allHtmlFiles.includes("leave.html"), "Zero files named leave.html in html/");

  // Check dead code strings in active source
  const appHtml = readFileSync(resolve(root, "html/shared/app.html"), "utf8");
  assert.ok(!/(?:@include\s+[^"'\s]*\/item\.html\b)/.test(appHtml), "app.html does not include item.html");
  assert.ok(!/(?:@include\s+[^"'\s]*\/leave\.html\b)/.test(appHtml), "app.html does not include leave.html");
  assert.ok(!appHtml.includes("itemDialog"), "app.html does not reference itemDialog");
  assert.ok(!appHtml.includes("leaveDialog"), "app.html does not reference leaveDialog");

  const constantsJs = readFileSync(resolve(root, "js/shared/constants.js"), "utf8");
  assert.ok(!constantsJs.includes("PACK_TEMPLATES"), "constants.js does not contain PACK_TEMPLATES");

  // Check built dist/index.html
  const distDir = resolve(root, "dist");
  if (!existsSync(resolve(distDir, "index.html"))) {
    build({ outDir: distDir });
  }
  const distHtmlPath = resolve(distDir, "index.html");
  assert.ok(existsSync(distHtmlPath), "dist/index.html exists");
  const distHtml = readFileSync(distHtmlPath, "utf8");

  assert.ok(!distHtml.includes('id="itemDialog"'), "dist/index.html does not contain id='itemDialog'");
  assert.ok(!distHtml.includes('id="leaveDialog"'), "dist/index.html does not contain id='leaveDialog'");
  assert.ok(!distHtml.includes("leaveTitle"), "dist/index.html does not contain leaveTitle");
  assert.ok(!distHtml.includes("PACK_TEMPLATES"), "dist/index.html does not contain PACK_TEMPLATES");

  // Check all JS in js/ and dist/js/ for PACK_TEMPLATES and dead dialog imports
  const allJs = [...scanDir(resolve(root, "js")), ...scanDir(resolve(root, "dist/js"))];
  for (const jsFile of allJs) {
    const content = readFileSync(jsFile, "utf8");
    assert.ok(!content.includes("PACK_TEMPLATES"), `PACK_TEMPLATES must not exist in ${jsFile}`);
    assert.ok(!content.includes("screens/itinerary/dialog.js"), `Import of screens/itinerary/dialog.js must not exist in ${jsFile}`);
  }
});

test("Challenger M1.2 - 3. Dialog count in build output is exactly 6 for desktop and 6 for mobile", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "challenger-build-"));
  try {
    build({ outDir: tempDir, buildId: "test-dialog-count" });
    const builtHtml = readFileSync(join(tempDir, "index.html"), "utf8");

    function getPlatformMarkup(html, platform) {
      const match = html.match(new RegExp(`<template id="platform-${platform}">([\\s\\S]*?)</template>`));
      assert.ok(match, `Found platform-${platform} template`);
      return match[1];
    }

    const expectedDialogIds = [
      "itemFullscreenDialog",
      "ratesDialog",
      "confirmDialog",
      "tripDialog",
      "timezoneDialog",
      "packItemDialog"
    ];

    for (const platform of ["desktop", "mobile"]) {
      const markup = getPlatformMarkup(builtHtml, platform);
      const dialogMatches = [...markup.matchAll(/<dialog\b[^>]*\bid="([^"]+)"[^>]*>/g)];
      const dialogIds = dialogMatches.map(m => m[1]);

      assert.equal(dialogIds.length, 6, `${platform} must contain exactly 6 dialogs, found ${dialogIds.length}`);
      assert.deepEqual(dialogIds, expectedDialogIds, `${platform} dialog IDs match the expected 6 dialogs`);

      // Verify closing tag count matches opening tag count
      const closingTags = (markup.match(/<\/dialog>/g) || []).length;
      assert.equal(closingTags, 6, `${platform} has matching 6 </dialog> closing tags`);

      // Verify each dialog has accessibility labelling
      for (const match of dialogMatches) {
        const tag = match[0];
        const hasAria = /aria-labelledby="[^"]+"/.test(tag) || /aria-label="[^"]+"/.test(tag);
        assert.ok(hasAria, `Dialog ${match[1]} on ${platform} must have aria-labelledby or aria-label`);
      }
    }

    // Also verify dist/index.html produced by normal build
    const distHtmlPath = resolve(root, "dist/index.html");
    if (!existsSync(distHtmlPath)) {
      build({ outDir: resolve(root, "dist") });
    }
    const distHtml = readFileSync(distHtmlPath, "utf8");
    for (const platform of ["desktop", "mobile"]) {
      const markup = getPlatformMarkup(distHtml, platform);
      const dialogIds = [...markup.matchAll(/<dialog\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(m => m[1]);
      assert.equal(dialogIds.length, 6, `dist/index.html ${platform} has exactly 6 dialogs`);
      assert.deepEqual(dialogIds, expectedDialogIds, `dist/index.html ${platform} dialog IDs match`);
    }

    const totalDialogsInDist = (distHtml.match(/<dialog\b/g) || []).length;
    assert.equal(totalDialogsInDist, 12, "Total dialog tags in dist/index.html across both platform templates is exactly 12");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
