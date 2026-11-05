/* Material Itinerary Item Dialog (Create & Edit) */

import { TYPES, TYPE_META, STATUSES, TIMEZONES, DEFAULT_TZ, START, END } from "../constants.js";
import { $, icon } from "../utils/dom.js";
import { defaultDate, validDate, fmtDateLong, fmtDay, toUtcMs, formatDurationMs, tzInfo } from "../utils/date.js";
import { uid } from "../utils/format.js";
import { getState, save } from "../state/store.js";
import { isValidTimeInterval } from "../state/validation.js";
import { confirmAsk } from "../components/dialog.js";

let editingItem = null;

export function updateTzBadges2() {
  const sTz = $("itemTz2")?.value || DEFAULT_TZ;
  const eTz = $("itemEndTz2")?.value || sTz;
  const sInfo = tzInfo(sTz);
  const eInfo = tzInfo(eTz);
  const sEl = $("itemTz2");
  const eEl = $("itemEndTz2");
  if (sEl) sEl.title = `Start timezone: ${sInfo.label}`;
  if (eEl) eEl.title = `End timezone: ${eInfo.label}`;
}

export function populateTimezoneSelects2() {
  const sTzEl = $("itemTz2");
  const eTzEl = $("itemEndTz2");
  if (!sTzEl || !eTzEl) return;
  const opts = TIMEZONES.map(t =>
    `<md-select-option value="${t.id}"><div slot="headline">${t.label}</div></md-select-option>`
  ).join("");
  if (sTzEl.innerHTML !== opts) sTzEl.innerHTML = opts;
  if (eTzEl.innerHTML !== opts) eTzEl.innerHTML = opts;
  updateTzBadges2();
}

export function updateItemTzPreview2() {
  const box = $("itemTzPreview2");
  if (!box) return;
  const sDate = $("itemStartDate2")?.value;
  const sTime = $("itemStartTime2")?.value;
  const eDate = $("itemEndDate2")?.value || sDate;
  const eTime = $("itemEndTime2")?.value;
  const sTz = $("itemTz2")?.value || DEFAULT_TZ;
  const eTz = $("itemEndTz2")?.value || sTz;

  if (!sDate || !sTime || !eTime) {
    box.hidden = true;
    box.textContent = "";
    return;
  }

  const u1 = toUtcMs(sDate, sTime, sTz);
  const u2 = toUtcMs(eDate, eTime, eTz);
  if (!u1 || !u2) {
    box.hidden = true;
    box.textContent = "";
    return;
  }
  const durMs = u2 - u1;
  const durStr = durMs > 0 ? formatDurationMs(durMs) : "";

  if (durStr) {
    box.textContent = `Duration: ${durStr}`;
    box.hidden = false;
  } else {
    box.textContent = "";
    box.hidden = true;
  }
}

export function setSelectedType2(type) {
  const container = $("itemTypes2");
  if (!container) return;
  container.querySelectorAll("md-filter-chip").forEach(chip => {
    chip.selected = (chip.dataset.type === type);
  });
}

export function getSelectedType2() {
  const sel = $("itemTypes2")?.querySelector("md-filter-chip[selected]");
  return sel?.dataset.type || "Activity";
}

export function setSelectedStatus2(status) {
  const container = $("itemStatuses2");
  if (!container) return;
  container.querySelectorAll("md-filter-chip").forEach(chip => {
    chip.selected = (chip.dataset.status === status);
  });
}

export function getSelectedStatus2() {
  const sel = $("itemStatuses2")?.querySelector("md-filter-chip[selected]");
  return sel?.dataset.status || "To book";
}

export function clearErrors2() {
  ["itemTitle2", "itemStartDate2", "itemEndDate2", "itemStartTime2", "itemEndTime2"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.error = false;
    el.errorText = "";
  });
}

export function openItemDialog2(id, initialDate, defaultType) {
  const dialog = $("itemDialog2");
  if (!dialog) return;

  const agenda = getState().agenda || [];
  editingItem = id ? agenda.find(a => a.id === id) : null;
  const a = editingItem || {
    title: "",
    date: initialDate || defaultDate(),
    endDate: "",
    time: "",
    endTime: "",
    tz: DEFAULT_TZ,
    endTz: DEFAULT_TZ,
    type: defaultType || "Activity",
    status: "To book",
    cost: null,
    currency: "USD",
    confirmation: "",
    bookBy: "",
    url: "",
    notes: ""
  };

  clearErrors2();
  $("itemDialog2Title").textContent = editingItem ? "Edit item" : "Add item";

  const titleEl = $("itemTitle2");
  if (titleEl) {
    titleEl.value = a.title;
    titleEl.title = a.title || "";
  }

  const sDateEl = $("itemStartDate2");
  if (sDateEl) sDateEl.value = a.date || defaultDate();

  const sTimeEl = $("itemStartTime2");
  if (sTimeEl) sTimeEl.value = a.time || "";

  const eDateEl = $("itemEndDate2");
  if (eDateEl) {
    eDateEl.value = a.endDate || "";
    eDateEl.min = sDateEl?.value || START;
  }

  const eTimeEl = $("itemEndTime2");
  if (eTimeEl) eTimeEl.value = a.endTime || "";

  populateTimezoneSelects2();
  const sTzEl = $("itemTz2");
  if (sTzEl) {
    sTzEl.value = a.tz || DEFAULT_TZ;
    sTzEl.dataset.prev = sTzEl.value;
  }
  const eTzEl = $("itemEndTz2");
  if (eTzEl) {
    eTzEl.value = a.endTz || a.tz || DEFAULT_TZ;
    delete eTzEl.dataset.userModified;
  }
  updateTzBadges2();
  updateItemTzPreview2();

  setSelectedType2(a.type);
  setSelectedStatus2(a.status);

  const costEl = $("itemCost2");
  if (costEl) costEl.value = (a.cost > 0) ? String(a.cost) : "";

  const currEl = $("itemCurrency2");
  if (currEl) currEl.value = a.currency || "USD";

  const notesEl = $("itemNotes2");
  if (notesEl) notesEl.value = a.notes || "";

  const delBtn = $("itemDelete2");
  if (delBtn) delBtn.hidden = !editingItem;

  dialog.show();
  setTimeout(() => titleEl?.focus(), 50);
}

export function initItemDialog2(onItemChanged) {
  // Populate type chips in itemTypes2
  const typesContainer = $("itemTypes2");
  if (typesContainer && !typesContainer.children.length) {
    typesContainer.innerHTML = TYPES.map(t =>
      `<md-filter-chip data-type="${t}" label="${t}"><svg slot="icon" class="i sm" aria-hidden="true"><use href="#i-${TYPE_META[t].icon}"/></svg></md-filter-chip>`
    ).join("");
  }

  // Handle single-selection radio-like behavior on chips
  ["itemTypes2", "itemStatuses2"].forEach(containerId => {
    const container = $(containerId);
    if (!container) return;
    container.addEventListener("click", e => {
      const chip = e.target.closest("md-filter-chip");
      if (!chip) return;
      container.querySelectorAll("md-filter-chip").forEach(c => {
        c.selected = (c === chip);
      });
    });
  });

  // Timezone link logic
  const sTzEl = $("itemTz2");
  const eTzEl = $("itemEndTz2");
  sTzEl?.addEventListener("change", () => {
    if (!eTzEl?.dataset.userModified || eTzEl?.value === sTzEl.dataset.prev) {
      if (eTzEl) eTzEl.value = sTzEl.value;
    }
    sTzEl.dataset.prev = sTzEl.value;
    updateTzBadges2();
    updateItemTzPreview2();
  });
  eTzEl?.addEventListener("change", () => {
    eTzEl.dataset.userModified = "true";
    updateTzBadges2();
    updateItemTzPreview2();
  });

  // Input changes clear errors & update preview
  ["itemStartDate2", "itemStartTime2", "itemEndDate2", "itemEndTime2"].forEach(fid => {
    const el = $(fid);
    if (!el) return;
    el.addEventListener("input", () => {
      el.error = false;
      el.errorText = "";
      updateItemTzPreview2();
    });
    el.addEventListener("change", updateItemTzPreview2);
  });

  $("itemTitle2")?.addEventListener("input", () => {
    const el = $("itemTitle2");
    if (el) {
      el.error = false;
      el.errorText = "";
    }
  });

  // Cancel button
  $("itemCancel2")?.addEventListener("click", () => {
    $("itemDialog2")?.close();
  });

  // Save button
  $("itemSave2")?.addEventListener("click", () => {
    const titleEl = $("itemTitle2");
    const sDateEl = $("itemStartDate2");
    const eDateEl = $("itemEndDate2");
    const sTimeEl = $("itemStartTime2");
    const eTimeEl = $("itemEndTime2");

    clearErrors2();

    const title = titleEl?.value?.trim() || "";
    if (!title) {
      if (titleEl) {
        titleEl.error = true;
        titleEl.errorText = "Please enter a title.";
        titleEl.focus();
      }
      return;
    }

    const startDate = sDateEl?.value || "";
    const rangeMsg = `Select a trip date between ${fmtDateLong(START)} and ${fmtDateLong(END)}.`;
    if (!validDate(startDate)) {
      if (sDateEl) {
        sDateEl.error = true;
        sDateEl.errorText = rangeMsg;
        sDateEl.focus();
      }
      return;
    }

    const endDate = eDateEl?.value || "";
    if (endDate && !validDate(endDate)) {
      if (eDateEl) {
        eDateEl.error = true;
        eDateEl.errorText = rangeMsg;
        eDateEl.focus();
      }
      return;
    }
    if (endDate && endDate < startDate) {
      if (eDateEl) {
        eDateEl.error = true;
        eDateEl.errorText = "End date cannot be earlier than start date.";
        eDateEl.focus();
      }
      return;
    }

    const startTime = sTimeEl?.value || "";
    const endTime = eTimeEl?.value || "";
    const sTz = $("itemTz2")?.value || DEFAULT_TZ;
    const eTz = $("itemEndTz2")?.value || sTz;

    if (!isValidTimeInterval(startDate, endDate, startTime, endTime, sTz, eTz)) {
      if (eTimeEl) {
        eTimeEl.error = true;
        eTimeEl.errorText = "End datetime cannot be earlier than start datetime.";
        eTimeEl.focus();
      }
      return;
    }

    const costVal = parseFloat($("itemCost2")?.value);
    const cost = (!isNaN(costVal) && costVal > 0) ? Math.round(costVal * 100) / 100 : null;

    const data = {
      title,
      date: startDate,
      endDate: endDate || "",
      time: startTime,
      endTime: endTime || "",
      tz: sTz,
      endTz: eTz,
      cost,
      currency: $("itemCurrency2")?.value || "USD",
      confirmation: editingItem ? (editingItem.confirmation || "") : "",
      bookBy: editingItem ? (editingItem.bookBy || "") : "",
      url: editingItem ? (editingItem.url || "") : "",
      type: getSelectedType2(),
      status: getSelectedStatus2(),
      notes: $("itemNotes2")?.value?.trim() || ""
    };

    let id;
    const state = getState();
    if (editingItem) {
      Object.assign(editingItem, data);
      id = editingItem.id;
    } else {
      id = uid();
      state.agenda.push({ id, ...data });
    }

    $("itemDialog2")?.close();
    save();
    if (onItemChanged) onItemChanged(id);
  });

  // Delete button
  $("itemDelete2")?.addEventListener("click", async () => {
    if (!editingItem) return;
    const confirmed = await confirmAsk(
      "Delete item?",
      `"${editingItem.title}" on ${fmtDay(editingItem.date)} will be removed.`,
      "Delete",
      true
    );
    if (!confirmed) return;

    const state = getState();
    state.agenda = state.agenda.filter(a => a !== editingItem);
    $("itemDialog2")?.close();
    save();
    if (onItemChanged) onItemChanged(null);
  });
}

