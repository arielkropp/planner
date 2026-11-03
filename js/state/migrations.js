/* State Migration from Legacy Formats */

import { DEFAULT_TZ, DEFAULT_RATES } from "../constants.js";
import { defaultBalance, validateV2 } from "./validation.js";

export function migrateV1(old) {
  if (!old || typeof old !== "object" || Array.isArray(old)) {
    throw new Error("Invalid planner data.");
  }
  const p = old.planner && typeof old.planner === "object" ? old.planner : null;
  const list = v => (Array.isArray(v) ? v : []);

  const agenda = [
    ...list(p?.agenda).map(a => ({
      id: a.id,
      title: a.title,
      date: a.date,
      endDate: "",
      time: a.time || "",
      endTime: "",
      tz: DEFAULT_TZ,
      endTz: DEFAULT_TZ,
      type: "Activity",
      status: a.done ? "Confirmed" : "To book",
      cost: null,
      currency: "USD",
      notes: a.place || "",
      confirmation: "",
      url: "",
      bookBy: ""
    })),
    ...list(p?.bookings).map(b => ({
      id: b.id,
      title: b.title,
      date: b.date,
      endDate: "",
      time: "",
      endTime: "",
      tz: DEFAULT_TZ,
      endTz: DEFAULT_TZ,
      type: b.type,
      status: b.status,
      cost: null,
      currency: "USD",
      notes: b.details || "",
      confirmation: "",
      url: "",
      bookBy: ""
    }))
  ];

  return {
    version: 2,
    agenda,
    packing: p ? list(p.packing).map(i => ({ id: i.id, title: i.title, category: i.category, qty: 1, done: i.done })) : [],
    work: list(p?.work).map(w => ({ id: w.id, date: w.date, hours: w.hours, note: w.note || "" })),
    balance: defaultBalance(),
    rates: { ...DEFAULT_RATES }
  };
}

export const fromAnyVersion = st => validateV2(st && st.version === 2 ? st : migrateV1(st));

