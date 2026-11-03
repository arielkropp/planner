/* Work Coverage Grid and Breakdown */

import { WD } from "../../constants.js";
import { dowOf, fmtDay } from "../../utils/date.js";
import { $ } from "../../utils/dom.js";
import { num } from "../../utils/format.js";
import { getState } from "../../state/store.js";
import { stdDayHours, getTripWorkdays, leave } from "./work-calc.js";

export function renderWorkCoverage() {
  const grid = $("workCoverageGrid");
  const breakdown = $("leaveBreakdown");
  const summary = $("workCoverageSummary");
  if (!grid || !breakdown) return;

  const workdays = getTripWorkdays();
  const work = getState().work || [];
  const dayTotals = new Map();

  for (const w of work) {
    dayTotals.set(w.date, Math.round(((dayTotals.get(w.date) || 0) + w.hours) * 100) / 100);
  }

  let coveredDays = 0;
  grid.innerHTML = workdays.map(d => {
    const req = stdDayHours(d);
    const log = dayTotals.get(d) || 0;
    const isFull = log >= req && req > 0;
    const isPart = log > 0 && log < req;
    if (isFull) coveredDays++;
    const cls = isFull ? " full" : (isPart ? " part" : "");
    return `<button type="button" class="cov-cell${cls}" data-cov-date="${d}" title="Log or edit hours for ${fmtDay(d)}">
      <span class="cov-d">${WD[dowOf(d)]} ${d.slice(8, 10)}/${d.slice(5, 7)}</span>
      <span class="cov-h">${num(log, 1)} / ${num(req, 1)}h</span>
    </button>`;
  }).join("");

  const r = leave();
  if (summary) {
    summary.textContent = `Workday coverage (${coveredDays}/${workdays.length} full days) & balance breakdown`;
  }

  breakdown.innerHTML = `
    <span>Starting balance: <strong>${num(r.novBal, 1)}h</strong></span>
    <span>Accrual (${r.months} × ${num(r.acc, 1)}h): <strong>+${num(r.months * r.acc, 1)}h</strong></span>
    <span>Pre-trip leave: <strong>−${num(r.pre, 1)}h</strong></span>
    <span>Available pool: <strong>${num(r.pool, 1)}h</strong></span>
    <span>Trip required: <strong>${num(r.needed, 1)}h</strong></span>
    <span>Trip logged: <strong>${num(r.logged, 1)}h</strong></span>
    <span>Net leave used: <strong>${num(r.leaveHours, 1)}h</strong></span>`;
}

