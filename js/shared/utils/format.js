/* Formatting and General Helper Utilities */

export const num = (n, dp = 1) => (n < 0 ? "−" : "") + Number(Math.abs(n).toFixed(dp));

export const fmtCost = (cost, cur = "USD") => {
  if (!Number.isFinite(cost) || cost <= 0) return "";
  const formatted = cost.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (cur === "USD") return `$${formatted} USD`;
  if (cur === "EUR") return `€${formatted}`;
  if (cur === "GBP") return `£${formatted}`;
  if (cur === "ILS") return `₪${formatted}`;
  return `${formatted} ${cur}`;
};

export function parsePackQty(raw) {
  const sVal = String(raw ?? "").trim();
  if (!/^\d+$/.test(sVal)) return null;
  const n = Number(sVal);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(99, n);
}

export const str = (v, max, required) =>
  typeof v === "string" && v.length <= max && (!required || v.trim() !== "");

export const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

