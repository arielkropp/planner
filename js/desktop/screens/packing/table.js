/* Packing Table Rendering and Table Event Handlers */

import { CATEGORIES } from "../../../shared/constants.js";
import { $, esc, icon } from "../../../shared/utils/dom.js";
import { uid, parsePackQty } from "../../../shared/utils/format.js";
import { getState, save } from "../../../shared/state/store.js";
import { confirmAsk } from "../../../shared/components/dialog.js";

export function renderPackingRow(p) {
  return `<tr id="pack-row-${esc(p.id)}" data-id="${esc(p.id)}">
    <td class="check"><input type="checkbox" data-field="done" ${p.done ? "checked" : ""} aria-label="Mark ${esc(p.title || "item")} as packed"></td>
    <td class="item"><input class="tbl-input${p.done ? " done" : ""}" data-field="title" type="text" maxlength="200" value="${esc(p.title)}" placeholder="Item name..." autocomplete="off" aria-label="Item" required></td>
    <td class="cat"><select class="tbl-input" data-field="category" aria-label="Category"><option value=""${!p.category ? " selected" : ""}>Unassigned</option>${CATEGORIES.map(c => `<option value="${c}"${c === p.category ? " selected" : ""}>${c}</option>`).join("")}</select></td>
    <td class="qty-cell"><input class="tbl-input" data-field="qty" type="number" min="1" max="99" step="1" inputmode="numeric" value="${esc(String(p.qty))}" aria-label="Quantity" required></td>
    <td class="actions"><div class="row-actions"><button type="button" class="icon-btn danger" data-delete="${esc(p.id)}" aria-label="Delete ${esc(p.title || "item")}" title="Delete">${icon("trash", "sm")}</button></div></td>
  </tr>`;
}

export function initPackingTable({ packingFilter, renderPacking, updatePackingStats }) {
  const tableRows = $("packingRows");
  if (!tableRows) return;

  // Delete row
  tableRows.addEventListener("click", async e => {
    const del = e.target.closest("[data-delete]");
    if (del) {
      const state = getState();
      const item = state.packing.find(p => p.id === del.dataset.delete);
      if (!item) return;
      if (!item._draft && !(await confirmAsk("Delete packing item?", `"${item.title || "This item"}" will be removed from your list.`, "Delete", true))) return;
      state.packing = state.packing.filter(p => p !== item);
      if (!item._draft) save();
      renderPacking();
      $("addPack")?.focus({ preventScroll: true });
    }
  });

  // Fast input changes for draft title & qty
  tableRows.addEventListener("input", e => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const p = getState().packing.find(x => x.id === row.dataset.id);
    if (!p) return;

    const field = e.target.dataset.field;
    if (field === "title") {
      if (e.target.value.trim()) {
        p.title = e.target.value.trim().slice(0, 200);
        delete p._draft;
        save();
        updatePackingStats();
      }
    } else if (field === "qty") {
      const parsed = parsePackQty(e.target.value);
      if (parsed !== null) {
        p.qty = parsed;
        if (!p._draft) save();
      }
    }
  });

  // Remove abandoned empty draft rows on focusout
  tableRows.addEventListener("focusout", e => {
    if (e.target.dataset?.field !== "title") return;
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const state = getState();
    const p = state.packing.find(x => x.id === row.dataset.id);
    if (!p || !p._draft) return;
    setTimeout(() => {
      if (row.contains(document.activeElement)) return;
      if (!e.target.value.trim() && p._draft) {
        state.packing = state.packing.filter(x => x !== p);
        renderPacking();
      }
    }, 0);
  });

  // Committed change handler
  tableRows.addEventListener("change", e => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const state = getState();
    const p = state.packing.find(x => x.id === row.dataset.id);
    if (!p) return;

    const field = e.target.dataset.field;
    if (field === "done") {
      p.done = e.target.checked;
      if (!p._draft) save();
      if (packingFilter.unpackedOnly) {
        renderPacking();
      } else {
        updatePackingStats();
        const titleInp = row.querySelector('[data-field="title"]');
        if (titleInp) titleInp.classList.toggle("done", p.done);
        if (packingFilter.groupByCat) {
          const catKey = p.category || "";
          const catAll = state.packing.filter(x => !x._draft && (x.category || "") === catKey);
          const catPacked = catAll.filter(x => x.done).length;
          const groupRow = [...document.querySelectorAll("tr.cat-group-row")].find(
            r => r.dataset.catGroup === catKey
          )?.querySelector(".cat-count");
          if (groupRow) {
            groupRow.textContent = `${catPacked}/${catAll.length}`;
          }
        }
      }
    } else if (field === "title") {
      if (!e.target.value.trim()) {
        if (p._draft) {
          state.packing = state.packing.filter(x => x !== p);
          renderPacking();
        } else {
          e.target.value = p.title;
        }
      } else {
        p.title = e.target.value.trim().slice(0, 200);
        delete p._draft;
        e.target.value = p.title;
        save();
        updatePackingStats();
      }
    } else if (field === "category") {
      if (e.target.value === "" || CATEGORIES.includes(e.target.value)) {
        p.category = e.target.value;
        if (!p._draft) save();
        if (!packingFilter.groupByCat && packingFilter.category === "All") {
          return;
        }
        renderPacking();
        const newRow = $(`pack-row-${p.id}`);
        if (newRow) {
          const catSelect = newRow.querySelector('[data-field="category"]');
          if (catSelect) catSelect.focus();
        }
      }
    } else if (field === "qty") {
      const rawNum = Number(String(e.target.value).trim());
      if (!Number.isFinite(rawNum) || !Number.isInteger(rawNum) || rawNum < 1) {
        e.target.value = String(p.qty);
      } else {
        p.qty = Math.min(99, rawNum);
        e.target.value = String(p.qty);
        if (!p._draft) save();
      }
    }
  });

  // Keyboard navigation across table cells
  tableRows.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches("input")) {
      e.preventDefault();
      e.target.blur();
      return;
    }
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.target.dataset.field === "title" || e.target.dataset.field === "qty")) {
      e.preventDefault();
      const rows = [...document.querySelectorAll("#packingRows tr[data-id]")];
      const curRow = e.target.closest("tr[data-id]");
      const idx = rows.indexOf(curRow);
      if (idx === -1) return;
      const targetRow = e.key === "ArrowUp" ? rows[idx - 1] : rows[idx + 1];
      if (targetRow) {
        const targetInp = targetRow.querySelector(`[data-field="${e.target.dataset.field}"]`);
        if (targetInp) {
          targetInp.focus();
          targetInp.select?.();
        }
      }
    }
  });
}

