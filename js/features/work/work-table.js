/* Work Log Table Rendering and Interactions */

import { START, END } from "../../constants.js";
import { fmtDate, validDate, parseDate } from "../../utils/date.js";
import { $, esc, icon } from "../../utils/dom.js";
import { uid, num } from "../../utils/format.js";
import { getState, save } from "../../state/store.js";
import { confirmAsk } from "../../components/dialog.js";
import { maxHoursFor, nextWorkDate, leave } from "./work-calc.js";

export function showWorkStatus(msg) {
  const el = $("workStatusMsg");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
  } else {
    el.textContent = msg;
    el.hidden = false;
  }
}

export function commitWorkRowDate(row, w, newIso, onStatsChanged) {
  const textInp = row.querySelector('[data-field="date"]');
  const native = row.querySelector(".fluent-dp-native");
  const hInp = row.querySelector('[data-field="hours"]');

  if (!newIso || !validDate(newIso)) {
    if (textInp) { textInp.value = fmtDate(w.date); textInp.setCustomValidity(""); }
    if (native) native.value = w.date;
    return;
  }

  const maxAllowed = maxHoursFor(newIso, w.id);
  if (maxAllowed >= 0.01) {
    w.date = newIso;
    if (w.hours > maxAllowed) {
      w.hours = maxAllowed;
      if (hInp) hInp.value = String(w.hours);
    }
    if (textInp) { textInp.value = fmtDate(w.date); textInp.setCustomValidity(""); }
    if (native) native.value = w.date;
    showWorkStatus("");
    if (onStatsChanged) onStatsChanged();
    save();
  } else {
    if (textInp) { textInp.value = fmtDate(w.date); textInp.setCustomValidity(""); }
    if (native) native.value = w.date;
    showWorkStatus(`Cannot move entry to ${fmtDate(newIso)}: that date already has 24 hours logged.`);
  }
}

export function renderWork(updateWorkStats) {
  if (updateWorkStats) updateWorkStats();

  const balPreInp = $("balPre");
  if (balPreInp && document.activeElement !== balPreInp) {
    balPreInp.value = getState().balance?.pre ?? 0;
  }

  const work = getState().work || [];
  const rows = work
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w.date.localeCompare(a.w.date) || b.i - a.i)
    .map(x => x.w);

  const container = $("workRows");
  if (!container) return;

  if (rows.length > 0) {
    container.innerHTML = rows.map(w => {
      const pickerVal = validDate(w.date) ? w.date : START;
      return `<tr id="work-row-${esc(w.id)}" data-id="${esc(w.id)}">
        <td class="date">
          <div class="fluent-dp">
            <input class="fluent-dp-input" data-field="date" type="text" value="${fmtDate(w.date)}" placeholder="dd/mm/yy" autocomplete="off" spellcheck="false" aria-label="Date">
            <button type="button" class="fluent-dp-btn date-picker-btn" tabindex="-1" aria-label="Open calendar" title="Open calendar">${icon("calendar", "sm")}</button>
            <input type="date" class="fluent-dp-native" min="${START}" max="${END}" tabindex="-1" value="${esc(pickerVal)}">
          </div>
        </td>
        <td class="num">
          <input class="tbl-input" data-field="hours" type="number" min="0.01" max="24" step="any" inputmode="decimal" value="${esc(String(w.hours))}" aria-label="Hours" required>
        </td>
        <td class="note">
          <input class="tbl-input" data-field="note" type="text" maxlength="200" value="${esc(w.note || "")}" placeholder="Notes" autocomplete="off" aria-label="Notes">
        </td>
        <td class="actions">
          <div class="row-actions">
            <button type="button" class="icon-btn danger" data-delete="${esc(w.id)}" aria-label="Delete entry for ${fmtDate(w.date)}" title="Delete">${icon("trash", "sm")}</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  } else {
    container.innerHTML = `<tr class="empty-row"><td colspan="4" class="empty-history">No hours logged yet. Click + to add a row.</td></tr>`;
  }
}

export function addWorkRow(updateWorkStats) {
  const date = nextWorkDate();
  const id = uid();
  const maxAllowed = maxHoursFor(date, id);
  const defaultH = Math.round(Math.min(8, maxAllowed) * 100) / 100;

  if (defaultH < 0.01) {
    showWorkStatus("All trip dates already have the maximum 24 hours logged. Reduce or delete an entry before adding another row.");
    return;
  }

  showWorkStatus("");
  getState().work.push({ id, date, hours: defaultH, note: "" });
  save();
  renderWork(updateWorkStats);

  const row = $(`work-row-${id}`);
  if (row) {
    const hoursInp = row.querySelector('[data-field="hours"]');
    if (hoursInp) {
      hoursInp.focus();
      hoursInp.select?.();
    }
  }
}

export function initWorkTable({ updateWorkStats }) {
  const rowsContainer = $("workRows");
  if (!rowsContainer) return;

  // Delete work row
  rowsContainer.addEventListener("click", async e => {
    const del = e.target.closest("[data-delete]");
    if (del) {
      const delId = del.dataset.delete;
      const state = getState();
      const w = state.work.find(x => x.id === delId);
      if (!w || !(await confirmAsk("Delete entry?", `${num(w.hours, 2)} h on ${fmtDate(w.date)} will be removed.`, "Delete", true))) return;
      state.work = state.work.filter(x => x !== w);
      showWorkStatus("");
      save();
      renderWork(updateWorkStats);
      $("addWork")?.focus({ preventScroll: true });
    }
  });

  // Committed change handler
  rowsContainer.addEventListener("change", e => {
    const row = e.target.closest("tr");
    if (!row) return;
    const w = getState().work.find(x => x.id === row.dataset.id);
    if (!w) return;

    if (e.target.classList.contains("fluent-dp-native")) {
      commitWorkRowDate(row, w, e.target.value, updateWorkStats);
    } else if (e.target.dataset.field === "date") {
      commitWorkRowDate(row, w, parseDate(e.target.value), updateWorkStats);
    } else if (e.target.dataset.field === "hours") {
      const val = parseFloat(e.target.value);
      const maxAllowed = maxHoursFor(w.date, w.id);
      const rounded = Number.isFinite(val) ? Math.round(Math.min(maxAllowed, val) * 100) / 100 : NaN;
      if (!Number.isFinite(rounded) || rounded < 0.01) {
        e.target.value = String(w.hours >= 0.01 ? w.hours : Math.min(8, maxAllowed));
      } else {
        w.hours = rounded;
        e.target.value = String(w.hours);
      }
      if (updateWorkStats) updateWorkStats();
      save();
    } else if (e.target.dataset.field === "note") {
      w.note = (e.target.value || "").slice(0, 200);
      save();
    }
  });

  // Input changes
  rowsContainer.addEventListener("input", e => {
    const row = e.target.closest("tr");
    if (!row) return;
    const state = getState();
    const w = state.work.find(x => x.id === row.dataset.id);
    if (!w) return;

    const field = e.target.dataset.field;
    if (field === "hours") {
      const val = parseFloat(e.target.value);
      const maxAllowed = maxHoursFor(w.date, w.id);
      const rounded = Number.isFinite(val) ? Math.round(Math.min(maxAllowed, val) * 100) / 100 : NaN;
      if (Number.isFinite(rounded) && rounded >= 0.01) {
        w.hours = rounded;
        if (updateWorkStats) updateWorkStats();
        save();
      } else if (Number.isFinite(val) && val < 0.01) {
        const tempLogged = Math.round((state.work.reduce((sum, x) => sum + (x === w ? 0 : x.hours), 0)) * 100) / 100;
        const r = leave(tempLogged);
        $("workLogged").textContent = num(r.logged, 1);
        $("balance").textContent = num(r.balance, 1);
        $("balanceWrap")?.classList.toggle("crit", r.balance < 0);
        $("balanceWrap")?.classList.toggle("ok", r.balance >= 0);
      }
    } else if (field === "note") {
      w.note = (e.target.value || "").slice(0, 200);
      save();
    } else if (field === "date") {
      const iso = parseDate(e.target.value);
      if (iso) {
        commitWorkRowDate(row, w, iso, updateWorkStats);
      }
    }
  });

  rowsContainer.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  });

  // Pre-trip input
  const balPre = $("balPre");
  if (balPre) {
    balPre.addEventListener("input", e => {
      const raw = Number(e.target.value);
      const clamped = Number.isFinite(raw) ? Math.min(300, Math.max(0, Math.round(raw * 100) / 100)) : 0;
      getState().balance.pre = clamped;
      if (Number.isFinite(raw) && raw > 300) e.target.value = "300";
      if (updateWorkStats) updateWorkStats();
      save();
    });
    balPre.addEventListener("change", e => {
      e.target.value = String(getState().balance?.pre ?? 0);
    });
  }

  $("addWork")?.addEventListener("click", () => addWorkRow(updateWorkStats));
}

