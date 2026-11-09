/* Packing Storage and State Manager */

import { getState, commit, subscribe } from "../../state/store.js";
import { uid } from "../../utils/format.js";

export const PACK_CATEGORY_META = {
  Documents: {
    label: "Documents",
    slug: "documents",
    bg: "#E5F0FF",
    color: "#1856A3",
    darkBg: "#152942",
    darkColor: "#73B2F2"
  },
  Clothes: {
    label: "Clothes",
    slug: "clothes",
    bg: "#FCE8EE",
    color: "#B4234E",
    darkBg: "#3A1926",
    darkColor: "#F48FB1"
  },
  Electronics: {
    label: "Electronics",
    slug: "electronics",
    bg: "#EDE9FE",
    color: "#4F3CC9",
    darkBg: "#231D47",
    darkColor: "#A594F9"
  },
  Toiletries: {
    label: "Toiletries",
    slug: "toiletries",
    bg: "#E0F7FA",
    color: "#006978",
    darkBg: "#0F2E38",
    darkColor: "#4DD0E1"
  },
  Health: {
    label: "Health",
    slug: "health",
    bg: "#ECFCCB",
    color: "#366912",
    darkBg: "#1D3311",
    darkColor: "#9CE06F"
  },
  Other: {
    label: "Other",
    slug: "other",
    bg: "#EEF1F5",
    color: "#4A525D",
    darkBg: "#21262E",
    darkColor: "#9AA2AD"
  }
};

export const PACK_CATEGORIES = Object.keys(PACK_CATEGORY_META);

export const PACK_BAGS = [
  { id: "suitcase", label: "Suitcase", icon: "i-suitcase" },
  { id: "backpack", label: "Backpack", icon: "i-backpack" },
  { id: "trolley", label: "Trolley", icon: "i-luggage" },
  { id: "hiking-bag", label: "Hiking bag", icon: "i-mountain" }
];

export const PACK_LOCATIONS = PACK_BAGS;

export function getPackingItems() {
  const state = getState();
  return (state && Array.isArray(state.packing)) ? state.packing : [];
}

export function getPackingItem(id) {
  return getPackingItems().find(item => item.id === id) || null;
}

export function addPackingItem({ title, category = "Other", qty = 1, bag = "", notes = "", done = false, toBuy = false }) {
  const items = getPackingItems();
  const newItem = {
    id: uid(),
    title: String(title).trim(),
    category: PACK_CATEGORIES.includes(category) ? category : "Other",
    qty: Math.max(1, Math.min(99, parseInt(qty, 10) || 1)),
    done: Boolean(done),
    toBuy: Boolean(toBuy),
    bag: String(bag || "").trim(),
    notes: String(notes || "").trim(),
    createdAt: new Date().toISOString()
  };
  items.unshift(newItem);
  commit();
  return newItem;
}

export function updatePackingItem(id, updates) {
  const items = getPackingItems();
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    title: updates.title !== undefined ? String(updates.title).trim() : current.title,
    category: updates.category !== undefined && PACK_CATEGORIES.includes(updates.category) ? updates.category : current.category,
    qty: updates.qty !== undefined ? Math.max(1, Math.min(99, parseInt(updates.qty, 10) || 1)) : current.qty,
    done: updates.done !== undefined ? Boolean(updates.done) : current.done,
    toBuy: updates.toBuy !== undefined ? Boolean(updates.toBuy) : current.toBuy,
    bag: updates.bag !== undefined ? String(updates.bag).trim() : current.bag,
    notes: updates.notes !== undefined ? String(updates.notes).trim() : current.notes
  };

  items[index] = updated;
  commit();
  return updated;
}

export function togglePackingItemDone(id) {
  const items = getPackingItems();
  const item = items.find(i => i.id === id);
  if (!item) return false;
  item.done = !item.done;
  commit();
  return item.done;
}

export function deletePackingItem(id) {
  const items = getPackingItems();
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return false;
  items.splice(index, 1);
  commit();
  return true;
}

export function subscribePacking(listener) {
  return subscribe(listener);
}
