/* Constants and Configuration */

export const pad = n => String(n).padStart(2, "0");

const today = new Date();
export const START = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const endDate = new Date(`${START}T00:00:00Z`);
endDate.setUTCDate(endDate.getUTCDate() + 37);
export const END = endDate.toISOString().slice(0, 10);

export const DEFAULT_NOV_BALANCE = 0;
export const DEFAULT_ACCRUAL = 0;
export const DEFAULT_ACCRUAL_MONTHS = 0;
export const DEFAULT_STD_DAY = 8;

export const KEY = "trip-planner-v1";
export const V1_KEY = "trip-planner-v1-backup";
export const SAVED_TEXT = "Saved in this browser only. Back up before switching browsers or devices.";

export const TYPES = ["Stay", "Transport", "Activity", "Flight", "Other"];

export const TYPE_META = {
  Stay: { icon: "bed", c: "stay" },
  Transport: { icon: "bus", c: "transport" },
  Activity: { icon: "pin", c: "activity" },
  Flight: { icon: "plane", c: "flight" },
  Other: { icon: "dots", c: "other" }
};

export const STATUSES = ["To book", "Confirmed"];
export const CATEGORIES = ["Documents", "Clothes", "Toiletries", "Health", "Electronics", "Other"];
export const CURRENCIES = ["USD", "EUR", "GBP", "ILS"];
export const DEFAULT_RATES = { base: "USD", EUR: null, GBP: null, ILS: null };

import { TIMEZONES } from "./data/timezones.js";

const browserTz = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
})();

if (!TIMEZONES.some(z => z.id === browserTz)) {
  const city = browserTz.split("/").pop().replace(/_/g, " ");
  TIMEZONES.unshift({
    title: city,
    offset: "GMT+0",
    utcOffsetStandard: "+00:00",
    utcOffsetDST: "+00:00",
    country: city,
    countryCode: "",
    searchTerms: [city],
    "country name": city,
    "country code": "",
    region_city: city,
    timezone: "GMT +00:00",
    "daylight savings start": "",
    "Daylight savings end": "",
    countryName: city,
    regionCity: city,
    id: browserTz,
    city,
    label: city,
    aliases: [city]
  });
}

export const DEFAULT_TZ = browserTz;
export { TIMEZONES };

export const PACK_TEMPLATES = [
  {
    name: "Hiking & outdoor gear",
    desc: "Windproof layers, trekking poles, trail essentials",
    items: [
      ["Waterproof shell jacket", "Clothes", 1], ["Thermal base layers", "Clothes", 2],
      ["Fleece mid-layer", "Clothes", 1], ["Hiking boots (broken in)", "Clothes", 1],
      ["Merino wool hiking socks", "Clothes", 4], ["Warm beanie & gloves", "Clothes", 1],
      ["Trekking poles", "Other", 1], ["polarized sunglasses & SPF 50", "Toiletries", 1],
      ["Blister plasters & ibuprofen", "Health", 1], ["Reusable 1L water bottle", "Other", 1]
    ]
  },
  {
    name: "Remote work kit",
    desc: "Power backup, calls, and connectivity",
    items: [
      ["Laptop & charger", "Electronics", 1], ["Noise-cancelling headphones", "Electronics", 1],
      ["Universal travel adapter", "Electronics", 2], ["High-capacity power bank", "Electronics", 1],
      ["USB-C hub / dongle", "Electronics", 1], ["eSIM / local SIM details", "Documents", 1]
    ]
  },
  {
    name: "Long-haul flight & bus comfort",
    desc: "Overnight bus & flight essentials",
    items: [
      ["Neck pillow & eye mask", "Other", 1], ["Earplugs", "Health", 2],
      ["Compression socks", "Clothes", 2], ["Lip balm & hand sanitizer", "Toiletries", 1],
      ["Offline maps & phrasebook", "Documents", 1], ["Small emergency cash stash", "Documents", 1]
    ]
  }
];

export const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const SCREENS = { itinerary: "Itinerary", packing: "Packing list", work: "Work log", settings: "Settings" };

