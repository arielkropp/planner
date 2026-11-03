/* Itinerary Item Dialog (Create & Edit) */

import { TYPES, TYPE_META, STATUSES, TIMEZONES, DEFAULT_TZ, START, END } from "../../constants.js";
import { $, icon } from "../../utils/dom.js";
import { defaultDate, validDate, fmtDateLong, fmtDay, toUtcMs, formatDurationMs, tzInfo } from "../../utils/date.js";
import { uid } from "../../utils/format.js";
import { getState, commit, save } from "../../state/store.js";
import { isValidTimeInterval } from "../../state/validation.js";
import { confirmAsk } from "../../components/dialog.js";
import { typeVar } from "./itinerary-utils.js";

let editingItem = null;
let itemInitialSnapshot = "";

export function getItemFormSnapshot() {
  const f = $("itemForm");
  if (!f) return "";
  return JSON.stringify({
    title: $("itemTitle")?.value || "",
    startDate: $("itemStartDate")?.value || "",
    startTime: $("itemStartTime")?.value || "",
    endDate: $("itemEndDate")?.value || "",
    endTime: $("itemEndTime")?.value || "",
    tz: $("itemTz")?.value || "",
    endTz: $("itemEndTz")?.value || "",
    type: f.elements.itemType?.value || "",
    status: f.elements.itemStatus?.value || "",
    cost: $("itemCost")?.value || "",
    currency: $("itemCurrency")?.value || "",
    notes: $("itemNotes")?.value || ""
  });
}

export function isItemDialogDirty() {
  return $("itemDialog")?.open && getItemFormSnapshot() !== itemInitialSnapshot;
}

export async function requestCloseItemDialog() {
  const d = $("itemDialog");
  if (!d?.open) return;
  if (isItemDialogDirty()) {
    const discard = await confirmAsk(
      "Discard unsaved changes?",
      "Your edits to this agenda item have not been saved.",
      "Discard",
      true
    );
    if (!discard) {
      $("itemTitle")?.focus();
      return;
    }
  }
  d.close();
}

export function updateTzBadges() {
  const sTz = $("itemTz")?.value || DEFAULT_TZ;
  const eTz = $("itemEndTz")?.value || sTz;
  const sInfo = tzInfo(sTz);
  const eInfo = tzInfo(eTz);
  const sBadge = $("itemTzBadge");
  const eBadge = $("itemEndTzBadge");
  if (sBadge) {
    sBadge.textContent = sInfo.country;
    sBadge.closest(".dtz-wrap")?.setAttribute("title", `Start timezone: ${sInfo.label}`);
  }
  if (eBadge) {
    eBadge.textContent = eInfo.country;
    eBadge.closest(".dtz-wrap")?.setAttribute("title", `End timezone: ${eInfo.label}`);
  }
}

export function populateTimezoneSelects() {
  const sTzEl = $("itemTz");
  const eTzEl = $("itemEndTz");
  if (!sTzEl || !eTzEl) return;
  const opts = TIMEZONES.map(t => `<option value="${t.id}">${t.label}</option>`).join("");
  if (sTzEl.innerHTML !== opts) sTzEl.innerHTML = opts;
  if (eTzEl.innerHTML !== opts) eTzEl.innerHTML = opts;
  updateTzBadges();
}

export function updateItemTzPreview() {
  const box = $("itemTzPreview");
  if (!box) return;
  const sDate = $("itemStartDate")?.value;
  const sTime = $("itemStartTime")?.value;
  const eDate = $("itemEndDate")?.value || sDate;
  const eTime = $("itemEndTime")?.value;
  const sTz = $("itemTz")?.value || DEFAULT_TZ;
  const eTz = $("itemEndTz")?.value || sTz;

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

export function openItemDialog(id, initialDate, defaultType) {
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

  $("itemForm").classList.remove("was-validated");
  $("itemDialogTitle").textContent = editingItem ? "Edit item" : "Add item";
  $("itemTitle").value = a.title;
  $("itemTitle").title = a.title || "";
  $("itemTitle").setCustomValidity("");
  $("itemTitle").classList.remove("is-invalid");
  $("itemTitle").closest(".title-status-box")?.classList.remove("is-invalid");

  $("itemStartDate").value = a.date || defaultDate();
  $("itemStartTime").value = a.time || "";
  $("itemEndDate").value = a.endDate || "";
  $("itemEndDate").min = $("itemStartDate").value || START;
  $("itemEndTime").value = a.endTime || "";

  populateTimezoneSelects();
  $("itemTz").value = a.tz || DEFAULT_TZ;
  $("itemEndTz").value = a.endTz || a.tz || DEFAULT_TZ;
  delete $("itemEndTz").dataset.userModified;
  $("itemTz").dataset.prev = $("itemTz").value;
  updateTzBadges();
  updateItemTzPreview();

  ["itemStartDate", "itemEndDate", "itemStartTime", "itemEndTime"].forEach(fid => {
    const el = $(fid);
    if (!el) return;
    el.setCustomValidity("");
    el.classList.remove("is-invalid");
    el.closest(".dt-box")?.classList.remove("is-invalid");
  });

  $("itemCost").value = (a.cost > 0) ? a.cost : "";
  $("itemCurrency").value = a.currency || "USD";
  $("itemForm").elements.itemType.value = a.type;
  $("itemForm").elements.itemStatus.value = a.status;
  $("itemNotes").value = a.notes || "";
  $("itemDelete").hidden = !editingItem;
  itemInitialSnapshot = getItemFormSnapshot();

  $("itemDialog").showModal();
  $("itemTitle").focus();
}

export function initItemDialog(onItemChanged) {
  // Initialize dynamic date bounds
  ["itemStartDate", "itemEndDate"].forEach(id => {
    const el = $(id);
    if (el) { el.min = START; el.max = END; }
  });

  // Populate type chips
  const typesContainer = $("itemTypes");
  if (typesContainer) {
    typesContainer.innerHTML = TYPES.map(t =>
      `<label class="chip-opt" style="${typeVar(t)}"><input type="radio" name="itemType" value="${t}" required><span>${icon(TYPE_META[t].icon)}${t}</span></label>`
    ).join("");
  }

  // Populate status chips
  const statusesContainer = $("itemStatuses");
  if (statusesContainer) {
    statusesContainer.innerHTML = STATUSES.map(st =>
      `<label class="chip-opt" title="Status: ${st} (click to switch)" style="--c:var(${st === "Confirmed" ? "--ok" : "--warn"})"><input type="radio" name="itemStatus" value="${st}" required><span>${icon(st === "Confirmed" ? "check" : "clock")}<em class="chip-lbl">${st}</em></span></label>`
    ).join("");

    statusesContainer.addEventListener("click", e => {
      if (e.target.tagName === "INPUT") return;
      const opt = e.target.closest(".chip-opt");
      const inp = opt?.querySelector("input");
      if (!opt || inp?.checked) {
        const other = [...statusesContainer.querySelectorAll("input")].find(r => !r.checked);
        if (other) {
          e.preventDefault();
          other.checked = true;
          other.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  // Title validation & text requirement
  const titleInput = $("itemTitle");
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      titleInput.setCustomValidity(titleInput.value.trim() ? "" : "Enter some text, not just spaces.");
      titleInput.title = titleInput.value;
    });
    titleInput.closest(".title-status-box")?.addEventListener("click", e => {
      if (!e.target.closest(".title-status-chips")) titleInput.focus();
    });
    titleInput.addEventListener("blur", () => {
      const isMissing = titleInput.required && !titleInput.value.trim();
      titleInput.classList.toggle("is-invalid", isMissing);
      titleInput.closest(".title-status-box")?.classList.toggle("is-invalid", isMissing);
    });
  }

  // Date and Time field listeners
  $("itemStartDate")?.addEventListener("change", () => {
    $("itemEndDate").min = $("itemStartDate").value || START;
  });
  $("itemStartDate")?.addEventListener("blur", () => {
    if (!validDate($("itemStartDate").value)) {
      $("itemStartDate").classList.add("is-invalid");
      $("itemStartDate").closest(".dt-box")?.classList.add("is-invalid");
    }
  });

  ["itemTitle", "itemStartDate", "itemEndDate", "itemStartTime", "itemEndTime"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      el.setCustomValidity("");
      el.classList.remove("is-invalid");
      const dtBox = el.closest(".dt-box");
      if (dtBox) dtBox.classList.remove("is-invalid");
      const titleBox = el.closest(".title-status-box");
      if (titleBox) titleBox.classList.remove("is-invalid");
    });
  });

  $("itemTz")?.addEventListener("change", () => {
    if (!$("itemEndTz").dataset.userModified || $("itemEndTz").value === $("itemTz").dataset.prev) {
      $("itemEndTz").value = $("itemTz").value;
    }
    $("itemTz").dataset.prev = $("itemTz").value;
    updateTzBadges();
    updateItemTzPreview();
  });
  $("itemTz")?.addEventListener("input", updateTzBadges);
  $("itemEndTz")?.addEventListener("change", () => {
    $("itemEndTz").dataset.userModified = "true";
    updateTzBadges();
    updateItemTzPreview();
  });
  $("itemEndTz")?.addEventListener("input", updateTzBadges);

  ["itemStartDate", "itemStartTime", "itemEndDate", "itemEndTime"].forEach(fid => {
    const el = $(fid);
    if (!el) return;
    el.addEventListener("input", updateItemTzPreview);
    el.addEventListener("change", updateItemTzPreview);
    el.addEventListener("click", () => {
      try { el.showPicker?.(); } catch {}
    });
  });

  // Dialog cancel
  $("itemDialog")?.addEventListener("cancel", e => {
    if (isItemDialogDirty()) {
      e.preventDefault();
      requestCloseItemDialog();
    }
  });

  // Form submit
  $("itemForm")?.addEventListener("submit", e => {
    e.preventDefault();
    $("itemForm").classList.add("was-validated");
    const f = $("itemForm").elements;
    const startDate = $("itemStartDate").value;
    const endDate = $("itemEndDate").value;
    const startTime = $("itemStartTime").value;
    const endTime = $("itemEndTime").value;

    ["itemTitle", "itemStartDate", "itemEndDate", "itemStartTime", "itemEndTime"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.setCustomValidity("");
      el.classList.remove("is-invalid");
      el.closest(".dt-box")?.classList.remove("is-invalid");
      el.closest(".title-status-box")?.classList.remove("is-invalid");
    });

    if (!$("itemTitle").value.trim()) {
      $("itemTitle").setCustomValidity("Please enter a title.");
      $("itemTitle").classList.add("is-invalid");
      $("itemTitle").closest(".title-status-box")?.classList.add("is-invalid");
      $("itemTitle").reportValidity();
      return;
    }
    const rangeMsg = `Please select a trip date between ${fmtDateLong(START)} and ${fmtDateLong(END)}.`;
    if (!validDate(startDate)) {
      $("itemStartDate").setCustomValidity(rangeMsg);
      $("itemStartDate").classList.add("is-invalid");
      $("itemStartDate").closest(".dt-box")?.classList.add("is-invalid");
      $("itemStartDate").reportValidity();
      return;
    }
    if (endDate && !validDate(endDate)) {
      $("itemEndDate").setCustomValidity(rangeMsg);
      $("itemEndDate").classList.add("is-invalid");
      $("itemEndDate").closest(".dt-box")?.classList.add("is-invalid");
      $("itemEndDate").reportValidity();
      return;
    }
    if (endDate && endDate < startDate) {
      $("itemEndDate").setCustomValidity("End date cannot be earlier than start date.");
      $("itemEndDate").classList.add("is-invalid");
      $("itemEndDate").closest(".dt-box")?.classList.add("is-invalid");
      $("itemEndDate").reportValidity();
      return;
    }
    const sTz = $("itemTz")?.value || DEFAULT_TZ;
    const eTz = $("itemEndTz")?.value || sTz;
    if (!isValidTimeInterval(startDate, endDate, startTime, endTime, sTz, eTz)) {
      $("itemEndTime").setCustomValidity("End datetime cannot be earlier than start datetime.");
      $("itemEndTime").classList.add("is-invalid");
      $("itemEndTime").closest(".dt-box")?.classList.add("is-invalid");
      $("itemEndTime").reportValidity();
      return;
    }
    const costVal = parseFloat($("itemCost").value);
    const cost = (!isNaN(costVal) && costVal > 0) ? Math.round(costVal * 100) / 100 : null;
    const data = {
      title: $("itemTitle").value.trim(),
      date: startDate,
      endDate: endDate || "",
      time: startTime,
      endTime: endTime || "",
      tz: sTz,
      endTz: eTz,
      cost,
      currency: $("itemCurrency").value,
      confirmation: editingItem ? (editingItem.confirmation || "") : "",
      bookBy: editingItem ? (editingItem.bookBy || "") : "",
      url: editingItem ? (editingItem.url || "") : "",
      type: f.itemType.value,
      status: f.itemStatus.value,
      notes: $("itemNotes").value.trim()
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
    itemInitialSnapshot = getItemFormSnapshot();
    $("itemDialog").close();
    save();
    if (onItemChanged) onItemChanged(id);
  });

  // Delete item
  $("itemDelete")?.addEventListener("click", async () => {
    if (!editingItem) return;
    const confirmed = await confirmAsk(
      "Delete item?",
      `"${editingItem.title}" on ${fmtDay(editingItem.date)} will be removed.`,
      "Delete",
      true
    );
    if (!confirmed) {
      $("itemDelete").focus();
      return;
    }
    const state = getState();
    state.agenda = state.agenda.filter(a => a !== editingItem);
    itemInitialSnapshot = getItemFormSnapshot();
    $("itemDialog").close();
    save();
    if (onItemChanged) onItemChanged(null);
  });
}

