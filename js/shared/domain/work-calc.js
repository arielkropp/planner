/* Work Log and Leave Balance Calculations */

import {
  DEFAULT_NOV_BALANCE,
  DEFAULT_ACCRUAL,
  DEFAULT_ACCRUAL_MONTHS,
  DEFAULT_STD_DAY,
  START,
  END
} from "../constants.js";
import { dowOf, todayIso, defaultDate, inTrip, TRIP_DAYS } from "../utils/date.js";
import { defaultBalance } from "../state/validation.js";
import { getState } from "../state/store.js";

export const stdDayHours = iso => {
  const w = dowOf(iso);
  const std = Number.isFinite(getState().balance?.stdDay)
    ? getState().balance.stdDay
    : DEFAULT_STD_DAY;
  return w >= 1 && w <= 5 ? std : 0;
};

export const getTripWorkdays = () => TRIP_DAYS.filter(d => stdDayHours(d) > 0);

export const getTripHoursNeeded = () =>
  Math.round(getTripWorkdays().reduce((sum, d) => sum + stdDayHours(d), 0) * 100) / 100;

export function leave(overrideLogged) {
  const work = getState().work || [];
  const logged = overrideLogged !== undefined
    ? overrideLogged
    : Math.round(work.reduce((sum, w) => sum + w.hours, 0) * 100) / 100;

  const b = getState().balance || defaultBalance();
  const pre = Math.min(300, Math.max(0, Number(b.pre) || 0));
  const novBal = Number.isFinite(b.novBalance) ? b.novBalance : DEFAULT_NOV_BALANCE;
  const acc = Number.isFinite(b.accrual) ? b.accrual : DEFAULT_ACCRUAL;
  const months = Number.isInteger(b.accrualMonths) ? b.accrualMonths : DEFAULT_ACCRUAL_MONTHS;

  const pool = Math.round((novBal + months * acc - pre) * 100) / 100;
  const needed = getTripHoursNeeded();
  const leaveHours = Math.max(0, Math.round((needed - logged) * 100) / 100);
  const balance = Math.round((pool - leaveHours) * 100) / 100;

  return { logged, balance, pool, needed, leaveHours, pre, novBal, acc, months };
}

export function maxHoursFor(date, id) {
  const work = getState().work || [];
  const others = work
    .filter(w => w.date === date && w.id !== id)
    .reduce((sum, w) => sum + w.hours, 0);
  return Math.max(0, Math.round((24 - others) * 100) / 100);
}

export function nextWorkDate() {
  const today = todayIso();
  const workdays = getTripWorkdays();
  const work = getState().work || [];
  const loggedDates = new Set(work.map(w => w.date));

  if (inTrip(today) && stdDayHours(today) > 0 && !loggedDates.has(today)) {
    return today;
  }

  if (work.length > 0) {
    const lastDate = work.map(w => w.date).sort().pop();
    const nextAfter = workdays.find(d => d > lastDate && !loggedDates.has(d));
    if (nextAfter) return nextAfter;
  }

  const firstUnlogged = workdays.find(d => !loggedDates.has(d));
  if (firstUnlogged) return firstUnlogged;

  const dayTotals = new Map();
  for (const w of work) {
    dayTotals.set(w.date, (dayTotals.get(w.date) || 0) + w.hours);
  }
  const anyWorkdayRoom = workdays.find(d => (dayTotals.get(d) || 0) <= 23.99);
  if (anyWorkdayRoom) return anyWorkdayRoom;

  const anyTripRoom = TRIP_DAYS.find(d => (dayTotals.get(d) || 0) <= 23.99);
  if (anyTripRoom) return anyTripRoom;

  return defaultDate();
}

