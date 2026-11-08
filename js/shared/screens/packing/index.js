/* Packing Screen Coordinator */

import { $, esc } from "../../utils/dom.js";
import { confirmAsk } from "../../components/dialog.js";
import {
  PACK_CATEGORIES,
  PACK_BAGS,
  getPackingItems,
  getPackingItem,
  addPackingItem,
  updatePackingItem,
  togglePackingItemDone,
  deletePackingItem,
  subscribePacking
} from "./storage.js";

const packState = {
  view: "all" // "all" | "to-buy" | "to-pack"
};

export function updatePackLens(immediate = false) {
  const container = $("packViews");
  const lens = $("packLens");
  if (!container || !lens) return;

  const active = container.querySelector(`[data-pack-view="${packState.view}"]`);
  if (!active || active.offsetWidth === 0) return;

  if (immediate) {
    lens.style.transition = "none";
    lens.style.transform = `translateX(${active.offsetLeft}px)`;
    lens.style.width = `${active.offsetWidth}px`;
    lens.classList.add("is-ready");
    void lens.offsetHeight;
    lens.style.transition = "";
    return;
  }

  lens.style.transform = `translateX(${active.offsetLeft}px)`;
  lens.style.width = `${active.offsetWidth}px`;
  lens.classList.add("is-ready");
}

export function setPackView(view) {
  if (!["all", "to-buy", "to-pack"].includes(view)) return;
  packState.view = view;

  const container = $("packViews");
  if (container) {
    container.querySelectorAll("[data-pack-view]").forEach(btn => {
      btn.setAttribute("aria-pressed", String(btn.dataset.packView === view));
    });
  }

  updatePackLens();
  renderPacking();
}

function renderItemRow(item) {
  const isPacked = Boolean(item.done);
  const catSlug = item.category ? item.category.toLowerCase() : "";
  const showCat = catSlug && catSlug !== "other";
  const hasBadges = showCat || item.toBuy || Boolean(item.bag);
  const qty = item.qty || 1;

  return `
    <div class="pack-row ${isPacked ? "is-packed" : ""}" data-id="${esc(item.id)}">
      <button type="button" class="pack-check-circle ${isPacked ? "is-checked" : ""}" data-action="toggle" data-id="${esc(item.id)}" aria-label="${isPacked ? "Mark unpacked" : "Mark packed"}">
        <svg class="i sm" aria-hidden="true"><use href="#i-check"/></svg>
      </button>
      <div class="pack-row-content" data-action="edit" data-id="${esc(item.id)}">
        <span class="pack-title">${esc(item.title)}</span>
        ${hasBadges ? `
          <div class="pack-row-badges">
            ${showCat ? `<span class="pack-pill cat-${esc(catSlug)}">${esc(catSlug)}</span>` : ""}
            ${item.bag ? `<span class="pack-pill bag">${esc(item.bag.toLowerCase())}</span>` : ""}
            ${item.toBuy ? `<span class="pack-pill to-buy">to buy</span>` : ""}
          </div>
        ` : ""}
      </div>
      <span class="pack-qty-pill" data-action="edit" data-id="${esc(item.id)}" title="Quantity: ${qty}. Click to edit.">x${qty}</span>
    </div>
  `;
}

export function renderPacking() {
  const contentEl = $("packingContent");
  if (!contentEl) return;

  const allItems = getPackingItems();

  let visibleItems = allItems;
  if (packState.view === "to-buy") {
    visibleItems = allItems.filter(item => item.toBuy);
  } else if (packState.view === "to-pack") {
    visibleItems = allItems.filter(item => !item.done);
  }

  // Empty state for specific view
  if (visibleItems.length === 0) {
    let msg = "No items in this view";
    if (packState.view === "to-buy") {
      msg = "No items marked to buy. Use the + button or edit an item to mark it to buy.";
    } else if (packState.view === "to-pack") {
      msg = allItems.length > 0 ? "All items are packed and ready to go!" : "Your list is empty. Add an item to get started.";
    } else if (allItems.length === 0) {
      msg = "Your packing list is empty. Add an item to get started.";
    }

    contentEl.innerHTML = `<div class="pack-empty-row">${esc(msg)}</div>`;
    return;
  }

  // Render straight list of rows
  contentEl.innerHTML = visibleItems.map(renderItemRow).join("");
}

const PACK_CATEGORY_ICONS = {
  Clothes: "i-shirt",
  Electronics: "i-zap",
  Documents: "i-briefcase",
  Toiletries: "i-sparkles",
  Health: "i-heart",
  Other: "i-package"
};

const PACK_CATEGORY_COLORS = {
  Clothes: "var(--pack-clothes)",
  Electronics: "var(--pack-electronics)",
  Documents: "var(--pack-documents)",
  Toiletries: "var(--pack-toiletries)",
  Health: "var(--pack-health)",
  Other: "var(--pack-other)"
};

function getSelectedCategory() {
  const checked = document.querySelector('input[name="packCategory"]:checked');
  return checked ? checked.value : "Other";
}

function setSelectedCategory(catName) {
  const target = document.querySelector(`input[name="packCategory"][value="${catName}"]`)
    || document.querySelector('input[name="packCategory"][value="Other"]');
  if (target) target.checked = true;
}

function ensureCategoryChips() {
  const catsContainer = $("packCategories");
  if (catsContainer && !catsContainer.hasChildNodes()) {
    catsContainer.innerHTML = PACK_CATEGORIES.map(cat => {
      const iconId = PACK_CATEGORY_ICONS[cat] || "i-tag";
      const color = PACK_CATEGORY_COLORS[cat] || "var(--accent)";
      return `
        <label class="chip-opt" style="--c: ${color};">
          <input type="radio" name="packCategory" value="${esc(cat)}" required>
          <span><svg class="i" aria-hidden="true"><use href="#${iconId}"/></svg>${esc(cat)}</span>
        </label>
      `;
    }).join("");
  }
}

function ensureBagChips() {
  const bagsContainer = $("packBags");
  if (bagsContainer && !bagsContainer.hasChildNodes()) {
    bagsContainer.innerHTML = PACK_BAGS.map(bag => `
      <label class="chip-opt" style="--c: var(--accent);">
        <input type="radio" name="packBag" value="${esc(bag.label)}">
        <span><svg class="i" aria-hidden="true"><use href="#${esc(bag.icon)}"/></svg>${esc(bag.label)}</span>
      </label>
    `).join("");
  }
}

function getSelectedBag() {
  const checked = document.querySelector('input[name="packBag"]:checked');
  return checked ? checked.value : "";
}

function setSelectedBag(bagName) {
  const target = bagName
    ? document.querySelector(`input[name="packBag"][value="${bagName}" i]`)
    : null;
  document.querySelectorAll('input[name="packBag"]').forEach(r => {
    r.checked = Boolean(target && r === target);
    r.dataset.wasChecked = String(r.checked);
  });
}

// Dialog management
function openItemDialog(itemId = null) {
  const dlg = $("packItemDialog");
  if (!dlg) return;

  ensureCategoryChips();
  ensureBagChips();

  const titleEl = $("packDialogTitle");
  const idEl = $("packItemId");
  const nameEl = $("packItemTitle");
  const qtyEl = $("packItemQty");
  const toBuyEl = $("packItemToBuy");
  const doneEl = $("packItemDone");
  const notesEl = $("packItemNotes");
  const deleteBtn = $("packItemDelete");
  const submitBtn = $("packItemSubmit");

  if (itemId) {
    const item = getPackingItem(itemId);
    if (!item) return;

    if (titleEl) titleEl.textContent = "Edit item";
    if (idEl) idEl.value = item.id;
    if (nameEl) nameEl.value = item.title;
    setSelectedCategory(item.category || "Other");
    setSelectedBag(item.bag || "");
    if (qtyEl) qtyEl.value = item.qty || 1;
    if (toBuyEl) toBuyEl.checked = Boolean(item.toBuy);
    if (doneEl) doneEl.checked = Boolean(item.done);
    if (notesEl) notesEl.value = item.notes || "";
    if (deleteBtn) deleteBtn.hidden = false;
    if (submitBtn) submitBtn.textContent = "Save";
  } else {
    const defaultToBuy = packState.view === "to-buy";
    if (titleEl) titleEl.textContent = "Add item";
    if (idEl) idEl.value = "";
    if (nameEl) nameEl.value = "";
    setSelectedCategory("Clothes");
    setSelectedBag("");
    if (qtyEl) qtyEl.value = "1";
    if (toBuyEl) toBuyEl.checked = defaultToBuy;
    if (doneEl) doneEl.checked = false;
    if (notesEl) notesEl.value = "";
    if (deleteBtn) deleteBtn.hidden = true;
    if (submitBtn) submitBtn.textContent = "Save";
  }

  nameEl?.classList.remove("is-invalid");
  nameEl?.closest(".fs-title-wrap")?.classList.remove("is-invalid");

  dlg.showModal();
  requestAnimationFrame(() => nameEl?.focus());
}

export function initPacking({ signal } = {}) {
  // Subscribe to storage changes
  const unsubscribe = subscribePacking(() => {
    renderPacking();
  });
  if (signal) {
    signal.addEventListener("abort", unsubscribe);
  }

  // Pre-render categories and bags into dialog if present
  ensureCategoryChips();
  ensureBagChips();

  // Allow toggling off a selected bag pill
  const bagsContainer = $("packBags");
  if (bagsContainer && typeof bagsContainer.addEventListener === "function") {
    bagsContainer.addEventListener("click", e => {
      const radio = e.target.closest('input[name="packBag"]');
      if (!radio) return;
      if (radio.dataset.wasChecked === "true") {
        radio.checked = false;
        radio.dataset.wasChecked = "false";
      } else {
        document.querySelectorAll('input[name="packBag"]').forEach(r => {
          r.dataset.wasChecked = "false";
        });
        radio.dataset.wasChecked = "true";
      }
    });
  }

  // Segmented view buttons
  const viewSwitcher = $("packViews");
  if (viewSwitcher) {
    viewSwitcher.addEventListener("click", e => {
      const btn = e.target.closest("[data-pack-view]");
      if (btn) setPackView(btn.dataset.packView);
    });
  }

  // FAB button (add item trigger)
  const fab = $("addPackItem");
  if (fab) {
    fab.addEventListener("click", () => openItemDialog());
  }

  // Content clicks (delegation for checkbox toggle and row edit)
  const contentEl = $("packingContent");
  if (contentEl) {
    contentEl.addEventListener("click", e => {
      // 1. Checkbox toggle (always toggles packed status)
      const checkBtn = e.target.closest('[data-action="toggle"]');
      if (checkBtn) {
        const id = checkBtn.dataset.id;
        if (id) {
          togglePackingItemDone(id);
          renderPacking();
        }
        return;
      }

      // 2. Row edit click (clicking row content or qty pill opens edit dialog)
      const editTrigger = e.target.closest('[data-action="edit"]');
      if (editTrigger) {
        const id = editTrigger.dataset.id;
        if (id) openItemDialog(id);
      }
    });
  }

  // Dialog Controls
  const dlg = $("packItemDialog");
  const form = $("packItemForm");
  const closeBtn = $("packClose");
  const deleteBtn = $("packItemDelete");
  const qtyDecBtn = $("packQtyDec");
  const qtyIncBtn = $("packQtyInc");
  const qtyInput = $("packItemQty");
  const nameInput = $("packItemTitle");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => dlg?.close());
  }

  if (qtyDecBtn && qtyInput) {
    qtyDecBtn.addEventListener("click", () => {
      const val = parseInt(qtyInput.value, 10) || 1;
      if (val > 1) qtyInput.value = val - 1;
    });
  }

  if (qtyIncBtn && qtyInput) {
    qtyIncBtn.addEventListener("click", () => {
      const val = parseInt(qtyInput.value, 10) || 1;
      if (val < 99) qtyInput.value = val + 1;
    });
  }

  if (nameInput) {
    nameInput.addEventListener("input", () => {
      nameInput.classList.remove("is-invalid");
      nameInput.closest(".fs-title-wrap")?.classList.remove("is-invalid");
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const id = $("packItemId")?.value;
      if (!id) return;

      const item = getPackingItem(id);
      const title = item?.title ? `"${item.title}"` : "this item";
      const ok = await confirmAsk(`Delete ${title}?`, "Delete item", "Delete", true);
      if (!ok) return;

      deletePackingItem(id);
      dlg?.close();
      renderPacking();
    });
  }

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();

      const title = nameInput?.value?.trim() || "";
      if (!title) {
        nameInput?.classList.add("is-invalid");
        nameInput?.closest(".fs-title-wrap")?.classList.add("is-invalid");
        nameInput?.focus();
        return;
      }

      const id = $("packItemId")?.value;
      const category = getSelectedCategory();
      const bag = getSelectedBag();
      const qty = parseInt(qtyInput?.value, 10) || 1;
      const toBuy = Boolean($("packItemToBuy")?.checked);
      const done = Boolean($("packItemDone")?.checked);
      const notes = $("packItemNotes")?.value || "";

      if (id) {
        updatePackingItem(id, { title, category, qty, bag, toBuy, done, notes });
      } else {
        addPackingItem({ title, category, qty, bag, toBuy, done, notes });
      }

      dlg?.close();
      renderPacking();
    });
  }

  // Render initial packing items
  renderPacking();
}
