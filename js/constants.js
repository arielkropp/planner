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

export const KEY = "arg-plan-public-v1";
export const V1_KEY = "arg-plan-public-v1-backup";
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
export const CURRENCIES = ["USD", "ARS", "EUR", "ILS"];
export const DEFAULT_RATES = { base: "USD", ARS: null, EUR: null, ILS: null };
export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export const TIMEZONES = [
  { id: "America/Argentina/Buenos_Aires", country: "AR", label: "ART −3 (Argentina)", short: "ART", offset: -3, city: "Buenos Aires" },
  { id: "Asia/Jerusalem", country: "IL", label: "IST +2 (Israel)", short: "IST", offset: 2, city: "Tel Aviv" },
  { id: "America/Santiago", country: "CL", label: "CLT −3 (Chile)", short: "CLT", offset: -3, city: "Santiago" },
  { id: "America/Sao_Paulo", country: "BR", label: "BRT −3 (Brazil)", short: "BRT", offset: -3, city: "São Paulo" },
  { id: "America/Montevideo", country: "UY", label: "UYT −3 (Uruguay)", short: "UYT", offset: -3, city: "Montevideo" },
  { id: "America/La_Paz", country: "BO", label: "BOT −4 (Bolivia)", short: "BOT", offset: -4, city: "La Paz" },
  { id: "America/Lima", country: "PE", label: "PET −5 (Peru)", short: "PET", offset: -5, city: "Lima" },
  { id: "America/Bogota", country: "CO", label: "COT −5 (Colombia)", short: "COT", offset: -5, city: "Bogota" }
];

export const PACK_TEMPLATES = [
  {
    name: "Patagonia & hiking gear",
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
      ["Universal travel adapter (Type C/I)", "Electronics", 2], ["High-capacity power bank", "Electronics", 1],
      ["USB-C hub / dongle", "Electronics", 1], ["eSIM / local SIM details", "Documents", 1]
    ]
  },
  {
    name: "Long-haul flight & bus comfort",
    desc: "Overnight bus & flight essentials",
    items: [
      ["Neck pillow & eye mask", "Other", 1], ["Earplugs", "Health", 2],
      ["Compression socks", "Clothes", 2], ["Lip balm & hand sanitizer", "Toiletries", 1],
      ["Offline maps & Spanish phrasebook", "Documents", 1], ["Small USD cash stash (clean bills)", "Documents", 1]
    ]
  }
];

export const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const PAGES = { itinerary: "Itinerary", packing: "Packing list", work: "Work log" };

