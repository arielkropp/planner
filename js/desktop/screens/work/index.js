/* Work Log Feature Coordinator */

import { $ } from "../../../shared/utils/dom.js";
import { num, uid } from "../../../shared/utils/format.js";
import { getState, save } from "../../../shared/state/store.js";
import { leave, maxHoursFor, stdDayHours } from "../../../shared/domain/work-calc.js";
import { renderWorkCoverage } from "./coverage.js";
import { renderWork, initWorkTable } from "./table.js";
import { initWorkDialogs } from "./dialogs.js";

export function updateWorkStats() {
  const r = leave();
  const workLogged = $("workLogged");
  const balance = $("balance");
  const balanceWrap = $("balanceWrap");

  if (workLogged) workLogged.textContent = num(r.logged, 1);
  if (balance) balance.textContent = num(r.balance, 1);
  if (balanceWrap) {
    balanceWrap.classList.toggle("crit", r.balance < 0);
    balanceWrap.classList.toggle("ok", r.balance >= 0);
  }

  renderWorkCoverage();
}

export function renderWorkView() {
  renderWork(updateWorkStats);
}

export function initWork({ onRatesChanged } = {}) {
  // Coverage grid click handler to add or focus row
  $("workCoverageGrid")?.addEventListener("click", e => {
    const cell = e.target.closest("[data-cov-date]");
    if (!cell) return;
    const date = cell.dataset.covDate;
    const state = getState();
    const existing = state.work.find(w => w.date === date);

    if (existing) {
      const row = $(`work-row-${existing.id}`);
      const hInp = row?.querySelector('[data-field="hours"]');
      if (hInp) {
        hInp.focus();
        hInp.select?.();
        return;
      }
    }

    const id = uid();
    const maxAllowed = maxHoursFor(date, id);
    if (maxAllowed < 0.01) return;
    const defaultH = Math.min(stdDayHours(date) || 8, maxAllowed);
    state.work.push({ id, date, hours: defaultH, note: "" });
    save();
    renderWorkView();
    const row = $(`work-row-${id}`);
    const hInp = row?.querySelector('[data-field="hours"]');
    if (hInp) {
      hInp.focus();
      hInp.select?.();
    }
  });

  // Init table interactions
  initWorkTable({ updateWorkStats });

  // Init Dialogs
  initWorkDialogs({
    onRatesSaved: () => {
      if (onRatesChanged) onRatesChanged();
    },
    onLeaveSaved: () => {
      renderWorkView();
    }
  });
}

