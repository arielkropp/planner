/* Itinerary Ordering and Label Rules (no DOM) */

import { DEFAULT_TZ } from "../constants.js";
import { daysDiff, tzInfo } from "../utils/date.js";
import { getState } from "../state/store.js";

export const sortItems = (a, b) =>
  a.date.localeCompare(b.date)
  || (a.time ? 1 : 0) - (b.time ? 1 : 0)
  || a.time.localeCompare(b.time)
  || a.title.localeCompare(b.title);

export function eventTitleText(a, currentDay) {
  if (!a.endDate || a.endDate <= a.date || !currentDay) return a.title;
  if (a.type === "Stay") {
    if (currentDay === a.date) return `Check-in: ${a.title}`;
    if (currentDay === a.endDate) return `Check-out: ${a.title}`;
    const night = daysDiff(a.date, currentDay);
    const totalNights = daysDiff(a.date, a.endDate);
    return `${a.title} (Night ${night}/${totalNights})`;
  } else if (a.type === "Flight") {
    if (currentDay === a.date) return `${a.title} (Departure)`;
    if (currentDay === a.endDate) return `${a.title} (Arrival)`;
    const day = daysDiff(a.date, currentDay) + 1;
    const totalDays = daysDiff(a.date, a.endDate) + 1;
    return `${a.title} (Day ${day}/${totalDays})`;
  } else {
    if (currentDay === a.date) return `${a.title} (Start)`;
    if (currentDay === a.endDate) return `${a.title} (End)`;
    const day = daysDiff(a.date, currentDay) + 1;
    const totalDays = daysDiff(a.date, a.endDate) + 1;
    return `${a.title} (Day ${day}/${totalDays})`;
  }
}

export function scheduleTimeText(a, currentDay, isCont = false) {
  const sTz = a.tz || DEFAULT_TZ;
  const eTz = a.endTz || sTz;
  const isCrossTz = sTz !== eTz;
  const sInfo = tzInfo(sTz);
  const eInfo = tzInfo(eTz);
  const timeLabel = (time, info) => isCrossTz
    ? `${time} ${info.city}`
    : time;

  if (isCont) return currentDay === a.endDate && a.endTime ? timeLabel(a.endTime, eInfo) : "";

  const isSingleDay = !a.endDate || a.endDate === a.date;
  if (a.time && a.endTime && isSingleDay) {
    return isCrossTz
      ? `${timeLabel(a.time, sInfo)} – ${timeLabel(a.endTime, eInfo)}`
      : `${a.time}–${a.endTime}`;
  }
  if (a.time) return timeLabel(a.time, sInfo);
  return a.endTime && isSingleDay ? timeLabel(a.endTime, eInfo) : "";
}

export function eventHourOnDay(a, currentDay) {
  const isMulti = Boolean(a.endDate && a.endDate > a.date);
  if (!isMulti) {
    if (a.time) return +a.time.slice(0, 2);
    return null;
  }
  if (currentDay === a.date && a.time) return +a.time.slice(0, 2);
  if (currentDay === a.endDate && a.endTime) return +a.endTime.slice(0, 2);
  return null;
}

export const itemsForDay = iso => {
  const agenda = getState().agenda || [];
  return [...agenda].filter(a => {
    if (a.date === iso) return true;
    if (a.endDate && a.date <= iso && iso <= a.endDate) return true;
    return false;
  }).sort((a, b) => {
    const ha = eventHourOnDay(a, iso);
    const hb = eventHourOnDay(b, iso);
    if ((ha !== null) !== (hb !== null)) return ha !== null ? 1 : -1;
    if (ha !== null && hb !== null && ha !== hb) return ha - hb;
    return sortItems(a, b);
  });
};
