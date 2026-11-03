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

const ZONES = [
  ["Pacific/Honolulu", "US", "Honolulu", "United States"],
  ["America/Anchorage", "US", "Anchorage", "United States"],
  ["America/Los_Angeles", "US", "Los Angeles", "United States"],
  ["America/Denver", "US", "Denver", "United States"],
  ["America/Chicago", "US", "Chicago", "United States"],
  ["America/New_York", "US", "New York", "United States"],
  ["America/Toronto", "CA", "Toronto", "Canada"],
  ["America/Mexico_City", "MX", "Mexico City", "Mexico"],
  ["America/Bogota", "CO", "Bogota", "Colombia"],
  ["America/Lima", "PE", "Lima", "Peru"],
  ["America/La_Paz", "BO", "La Paz", "Bolivia"],
  ["America/Santiago", "CL", "Santiago", "Chile"],
  ["America/Montevideo", "UY", "Montevideo", "Uruguay"],
  ["America/Sao_Paulo", "BR", "São Paulo", "Brazil"],
  ["Atlantic/Reykjavik", "IS", "Reykjavik", "Iceland"],
  ["Europe/London", "GB", "London", "United Kingdom"],
  ["Europe/Lisbon", "PT", "Lisbon", "Portugal"],
  ["Europe/Paris", "FR", "Paris", "France"],
  ["Europe/Madrid", "ES", "Madrid", "Spain"],
  ["Europe/Rome", "IT", "Rome", "Italy"],
  ["Europe/Berlin", "DE", "Berlin", "Germany"],
  ["Europe/Athens", "GR", "Athens", "Greece"],
  ["Europe/Istanbul", "TR", "Istanbul", "Türkiye"],
  ["Asia/Jerusalem", "IL", "Tel Aviv", "Israel"],
  ["Africa/Cairo", "EG", "Cairo", "Egypt"],
  ["Africa/Johannesburg", "ZA", "Johannesburg", "South Africa"],
  ["Africa/Nairobi", "KE", "Nairobi", "Kenya"],
  ["Asia/Dubai", "AE", "Dubai", "United Arab Emirates"],
  ["Asia/Kolkata", "IN", "Delhi", "India"],
  ["Asia/Bangkok", "TH", "Bangkok", "Thailand"],
  ["Asia/Singapore", "SG", "Singapore", "Singapore"],
  ["Asia/Hong_Kong", "HK", "Hong Kong", "Hong Kong"],
  ["Asia/Shanghai", "CN", "Shanghai", "China"],
  ["Asia/Seoul", "KR", "Seoul", "South Korea"],
  ["Asia/Tokyo", "JP", "Tokyo", "Japan"],
  ["Australia/Perth", "AU", "Perth", "Australia"],
  ["Australia/Sydney", "AU", "Sydney", "Australia"],
  ["Pacific/Auckland", "NZ", "Auckland", "New Zealand"]
];

const browserTz = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
})();

if (!ZONES.some(z => z[0] === browserTz)) {
  const city = browserTz.split("/").pop().replace(/_/g, " ");
  ZONES.unshift([browserTz, "", city, browserTz.includes("/") ? browserTz.split("/")[0] : ""]);
}

export const DEFAULT_TZ = browserTz;

export const TIMEZONES = ZONES.map(([id, country, city, name]) => ({
  id, country, city, label: name ? `${city} (${name})` : city
}));

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
export const PAGES = { itinerary: "Itinerary", packing: "Packing list", work: "Work log" };

