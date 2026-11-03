/* Packing Feature Coordinator */

import { CATEGORIES } from "../../constants.js";
import { $, esc } from "../../utils/dom.js";
import { uid, parsePackQty } from "../../utils/format.js";
import { getState, save } from "../../state/store.js";
import { confirmAsk } from "../../components/dialog.js";
import { renderPackingRow, initPackingTable } from "./packing-table.js";
import { initPackingTemplates } from "./packing-templates.js";

export const PACK_FILTERS = ["All", ...CATEGORIES, "Unassigned"];

export const packingFilter = {
  search: "",
  unpackedOnly: false,
  groupByCat: false,
  category: "All"
};

export function getReversedPacking() {
  const packing = getState().packing || [];
  return packing
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (a.p.addedAt && b.p.addedAt && a.p.addedAt !== b.p.addedAt) {
        return b.p.addedAt.localeCompare(a.p.addedAt);
      }
      return b.i - a.i;
    })
    .map(x => x.p);
}

export function matchesPackCatFilter(p, catFilter) {
  if (catFilter === "All") return true;
  if (catFilter === "Unassigned") return !p.category;
  return p.category === catFilter;
}

export function getVisiblePackingItems() {
  const q = (packingFilter.search || "").trim().toLowerCase();
  return getReversedPacking().filter(p => {
    if (!matchesPackCatFilter(p, packingFilter.category)) return false;
    if (packingFilter.unpackedOnly && p.done) return false;
    if (q && !(p.title || "").toLowerCase().includes(q) && !(p.category || "").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function updatePackingStats() {
  const packing = getState().packing || [];
  const savedPacking = packing.filter(p => !p._draft);
  const total = savedPacking.length;
  const packed = savedPacking.filter(p => p.done).length;
  const progressEl = $("packingProgress");
  if (progressEl) {
    progressEl.max = total || 1;
    progressEl.value = packed;
  }
}

export function renderPacking() {
  const tableRows = $("packingRows");
  if (!tableRows) return;

  const state = getState();
  const visibleItems = getVisiblePackingItems();
  updatePackingStats();

  if (visibleItems.length === 0) {
    if ((state.packing || []).length === 0) {
      tableRows.innerHTML = `<tr class="empty-row"><td colspan="5" class="empty-history">Your packing list is empty. Use the quick-add bar or + to add an item.</td></tr>`;
    } else {
      tableRows.innerHTML = `<tr class="empty-row"><td colspan="5" class="empty-history">No items match your filter.</td></tr>`;
    }
    return;
  }

  if (!packingFilter.groupByCat) {
    tableRows.innerHTML = visibleItems.map(renderPackingRow).join("");
    return;
  }

  const q = (packingFilter.search || "").trim().toLowerCase();
  const cats = packingFilter.category === "All"
    ? ["", ...CATEGORIES]
    : [packingFilter.category === "Unassigned" ? "" : packingFilter.category];

  const rowsHtml = cats.map(cat => {
    const catAll = (state.packing || []).filter(p => !p._draft && (p.category || "") === cat);
    const catTotal = catAll.length;
    const catPacked = catAll.filter(p => p.done).length;
    const items = getReversedPacking().filter(p => {
      if ((p.category || "") !== cat) return false;
      if (packingFilter.unpackedOnly && p.done) return false;
      if (q && !(p.title || "").toLowerCase().includes(q) && !(p.category || "").toLowerCase().includes(q)) return false;
      return true;
    });
    if (!items.length) return "";

    const catLabel = cat || "Unassigned";
    const groupRow = `<tr class="cat-group-row" data-cat-group="${esc(cat)}"><td colspan="5"><span>${esc(catLabel)}</span><span class="cat-count">${catPacked}/${catTotal}</span></td></tr>`;
    const itemRows = items.map(renderPackingRow).join("");
    return groupRow + itemRows;
  }).join("");

  tableRows.innerHTML = rowsHtml;
}

export function addPackRow() {
  const cat = (packingFilter.category !== "All" && packingFilter.category !== "Unassigned") ? packingFilter.category : "";
  const id = uid();
  const item = { id, title: "", category: cat, qty: 1, done: false, _draft: true };
  const state = getState();
  state.packing.push(item);

  if (packingFilter.search) {
    packingFilter.search = "";
    if ($("packSearch")) $("packSearch").value = "";
    if ($("packSearchClear")) $("packSearchClear").hidden = true;
  }

  renderPacking();
  const row = $(`pack-row-${id}`);
  if (row) {
    const titleInp = row.querySelector('[data-field="title"]');
    if (titleInp) titleInp.focus();
  }
}

export function setPackFilterCat(cat) {
  packingFilter.category = cat;
  document.querySelectorAll("#packCatFilter .filter-chip").forEach(btn => {
    const active = btn.dataset.cat === cat;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

export function initPacking() {
  // Category filter chips
  const catFilterContainer = $("packCatFilter");
  if (catFilterContainer) {
    catFilterContainer.innerHTML = PACK_FILTERS.map((c, i) =>
      `<button type="button" class="filter-chip${i === 0 ? " active" : ""}" aria-pressed="${i === 0 ? "true" : "false"}" data-cat="${c}">${c}</button>`
    ).join("");

    catFilterContainer.addEventListener("click", e => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      setPackFilterCat(chip.dataset.cat);
      renderPacking();
    });
  }

  // Quick add category dropdown
  const quickCat = $("packQuickCat");
  if (quickCat) {
    quickCat.innerHTML = `<option value="">Category</option>` + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  // Quick add form
  $("packQuickForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const titleInp = $("packQuickTitle");
    const catSel = $("packQuickCat");
    const qtyInp = $("packQuickQty");
    const title = (titleInp?.value || "").trim().slice(0, 200);
    if (!title) {
      titleInp?.focus();
      return;
    }
    const cat = catSel?.value || ((packingFilter.category !== "All" && packingFilter.category !== "Unassigned") ? packingFilter.category : "");
    const qty = parsePackQty(qtyInp?.value) || 1;
    getState().packing.push({ id: uid(), title, category: cat, qty, done: false });
    save();
    if (titleInp) titleInp.value = "";
    if (qtyInp) qtyInp.value = "1";
    renderPacking();
    titleInp?.focus();
  });

  // Search input and clear button
  $("packSearch")?.addEventListener("input", e => {
    packingFilter.search = e.target.value;
    const clearBtn = $("packSearchClear");
    if (clearBtn) clearBtn.hidden = !e.target.value;
    renderPacking();
  });

  $("packSearchClear")?.addEventListener("click", () => {
    packingFilter.search = "";
    const searchInp = $("packSearch");
    if (searchInp) {
      searchInp.value = "";
      searchInp.focus();
    }
    const clearBtn = $("packSearchClear");
    if (clearBtn) clearBtn.hidden = true;
    renderPacking();
  });

  // Toggles
  $("packGroupByCat")?.addEventListener("click", () => {
    packingFilter.groupByCat = !packingFilter.groupByCat;
    $("packGroupByCat")?.setAttribute("aria-pressed", String(packingFilter.groupByCat));
    renderPacking();
  });

  $("packUnpackedOnly")?.addEventListener("click", () => {
    packingFilter.unpackedOnly = !packingFilter.unpackedOnly;
    $("packUnpackedOnly")?.setAttribute("aria-pressed", String(packingFilter.unpackedOnly));
    renderPacking();
  });

  // Reset checks
  $("packResetAll")?.addEventListener("click", async () => {
    const confirmed = await confirmAsk(
      "Reset all checks?",
      "All packing items will be marked as unpacked.",
      "Reset checks",
      false
    );
    if (!confirmed) return;
    (getState().packing || []).forEach(p => p.done = false);
    save();
    renderPacking();
  });

  $("addPack")?.addEventListener("click", addPackRow);

  // Table events & Templates
  initPackingTable({ packingFilter, renderPacking, updatePackingStats });
  initPackingTemplates(() => renderPacking());
}

