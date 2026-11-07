/* Hybrid Full-Screen Itinerary Item Dialog (View + Edit Modes) */

import { TYPES, TYPE_META, STATUSES, TIMEZONES, DEFAULT_TZ } from "../../../shared/constants.js";
import { $, icon } from "../../../shared/utils/dom.js";
import { defaultDate, validDate, fmtDateLong, fmtDay, toUtcMs, formatDurationMs, tzInfo, getTripStart, getTripEnd, hasTripEndDate } from "../../../shared/utils/date.js";
import { uid, fmtCost } from "../../../shared/utils/format.js";
import { getState, save } from "../../../shared/state/store.js";
import { isValidTimeInterval } from "../../../shared/state/validation.js";
import { confirmAsk } from "../../../shared/components/dialog.js";
import { openTimezoneDialog } from "../../../shared/components/timezone-picker.js";
import { typeVar } from "./markup.js";

let editingItem = null;
let fsInitialSnapshot = "";
let currentMode = "edit";

export function getFsSnapshot() {
  const f = $("fsItemForm");
  if (!f) return "";
  return JSON.stringify({
    title: $("fsTitle")?.value || "",
    startDate: $("fsStartDate")?.value || "",
    startTime: $("fsStartTime")?.value || "",
    endDate: $("fsEndDate")?.value || "",
    endTime: $("fsEndTime")?.value || "",
    tz: $("fsTz")?.value || "",
    endTz: $("fsEndTz")?.value || "",
    type: f.elements.fsType?.value || "",
    status: f.elements.fsStatus?.value || "",
    cost: $("fsCost")?.value || "",
    currency: $("fsCurrency")?.value || "",
    notes: $("fsNotes")?.value || ""
  });
}

export function isFsDirty() {
  return currentMode === "edit" && $("itemFullscreenDialog")?.open && getFsSnapshot() !== fsInitialSnapshot;
}

function focusFsTitle() {
  const titleInput = $("fsTitle");
  if (!titleInput) return;
  titleInput.focus({ preventScroll: true });
  try {
    const len = titleInput.value.length;
    titleInput.setSelectionRange(len, len);
  } catch {}
}

export function setFsMode(mode) {
  currentMode = mode;
  const isView = mode === "view";
  if ($("fsViewBody")) $("fsViewBody").hidden = !isView;
  if ($("fsEditBody")) $("fsEditBody").hidden = isView;
  if ($("fsViewActions")) $("fsViewActions").hidden = !isView;
  if ($("fsEditActions")) $("fsEditActions").hidden = isView;
  if ($("fsSave")) $("fsSave").hidden = isView;
  if ($("fsDelete")) $("fsDelete").hidden = isView || !editingItem;
  if ($("fsDialogTitle")) {
    $("fsDialogTitle").textContent = isView ? "Item details" : (editingItem ? "Edit item" : "Add item");
  }
  const closeBtn = $("fsClose");
  if (closeBtn) {
    const canGoBack = !isView && Boolean(editingItem);
    closeBtn.setAttribute("aria-label", canGoBack ? "Back to item details" : "Close");
    closeBtn.setAttribute("title", canGoBack ? "Back" : "Close");
    const useEl = closeBtn.querySelector("use");
    if (useEl) useEl.setAttribute("href", canGoBack ? "#i-left" : "#i-x");
  }
  if (!isView && $("itemFullscreenDialog")?.open) {
    focusFsTitle();
  }
}

export async function requestCloseFsDialog() {
  const d = $("itemFullscreenDialog");
  if (!d?.open) return;
  if (isFsDirty()) {
    const discard = await confirmAsk(
      "Discard unsaved changes?",
      "Your edits to this agenda item have not been saved.",
      "Discard",
      true
    );
    if (!discard) {
      focusFsTitle();
      return;
    }
  }
  if (currentMode === "edit" && editingItem) {
    populateFsForm(editingItem);
    renderFsView(editingItem);
    setFsMode("view");
    $("fsEditBtn")?.focus({ preventScroll: true });
    return;
  }
  d.close();
}

export function updateFsTzBadges() {
  const sTz = $("fsTz")?.value || DEFAULT_TZ;
  const eTz = $("fsEndTz")?.value || sTz;
  const sInfo = tzInfo(sTz);
  const eInfo = tzInfo(eTz);
  const sBadge = $("fsTzBadge");
  const eBadge = $("fsEndTzBadge");
  if (sBadge) {
    sBadge.textContent = sInfo.country || "TZ";
    sBadge.closest(".dtz-wrap")?.setAttribute("title", `Start timezone: ${sInfo.label}`);
  }
  if (eBadge) {
    eBadge.textContent = eInfo.country || "TZ";
    eBadge.closest(".dtz-wrap")?.setAttribute("title", `End timezone: ${eInfo.label}`);
  }
}

export function populateFsTimezoneSelects() {
  updateFsTzBadges();
}

export function updateFsTzPreview() {
  const box = $("fsTzPreview");
  if (!box) return;
  const sDate = $("fsStartDate")?.value;
  const sTime = $("fsStartTime")?.value;
  const eDate = $("fsEndDate")?.value || sDate;
  const eTime = $("fsEndTime")?.value;
  const sTz = $("fsTz")?.value || DEFAULT_TZ;
  const eTz = $("fsEndTz")?.value || sTz;

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

function renderFsView(a) {
  const badgesEl = $("fsViewBadges");
  if (badgesEl) {
    const t = a.type || "Activity";
    const st = a.status || "To book";
    badgesEl.innerHTML =
      `<span class="fs-view-badge" style="${typeVar(t)}">${icon(TYPE_META[t]?.icon || "dots")}${t}</span>` +
      `<span class="fs-view-badge" style="--c:var(${st === "Confirmed" ? "--ok" : "--warn"})">${icon(st === "Confirmed" ? "check" : "clock")}${st}</span>`;
  }

  if ($("fsViewTitle")) $("fsViewTitle").textContent = a.title || "Untitled";

  const sDateStr = fmtDay(a.date || defaultDate());
  const sTzInfo = tzInfo(a.tz || DEFAULT_TZ);
  if ($("fsViewStartText")) {
    $("fsViewStartText").textContent = a.time ? `${sDateStr} · ${a.time}` : sDateStr;
  }
  if ($("fsViewStartTz")) {
    $("fsViewStartTz").textContent = a.time ? sTzInfo.label : "All-day";
  }

  const hasEnd = Boolean(a.endDate || a.endTime);
  if ($("fsViewEndRow")) $("fsViewEndRow").hidden = !hasEnd;
  if ($("fsViewEndDivider")) $("fsViewEndDivider").hidden = !hasEnd;
  if (hasEnd) {
    const eDate = a.endDate || a.date || defaultDate();
    const eDateStr = fmtDay(eDate);
    const eTzInfo = tzInfo(a.endTz || a.tz || DEFAULT_TZ);
    if ($("fsViewEndText")) {
      $("fsViewEndText").textContent = a.endTime ? `${eDateStr} · ${a.endTime}` : eDateStr;
    }
    if ($("fsViewEndTz")) {
      $("fsViewEndTz").textContent = a.endTime ? eTzInfo.label : "";
      $("fsViewEndTz").hidden = !a.endTime;
    }
  }

  const durBox = $("fsViewDuration");
  if (durBox) {
    let durStr = "";
    if (a.date && a.time && a.endTime) {
      const u1 = toUtcMs(a.date, a.time, a.tz || DEFAULT_TZ);
      const u2 = toUtcMs(a.endDate || a.date, a.endTime, a.endTz || a.tz || DEFAULT_TZ);
      if (u1 && u2 && u2 > u1) durStr = formatDurationMs(u2 - u1);
    }
    durBox.hidden = !durStr;
    durBox.textContent = durStr ? `Duration: ${durStr}` : "";
  }

  const hasCost = Number.isFinite(a.cost) && a.cost > 0;
  const hasNotes = Boolean(a.notes && a.notes.trim());
  if ($("fsViewCostRow")) $("fsViewCostRow").hidden = !hasCost;
  if (hasCost && $("fsViewCostText")) {
    $("fsViewCostText").textContent = fmtCost(a.cost, a.currency || "USD");
  }
  if ($("fsViewNotesRow")) $("fsViewNotesRow").hidden = !hasNotes;
  if (hasNotes && $("fsViewNotesText")) {
    $("fsViewNotesText").textContent = a.notes.trim();
  }
  if ($("fsViewDetailsDivider")) $("fsViewDetailsDivider").hidden = !(hasCost && hasNotes);
  if ($("fsViewNoDetails")) $("fsViewNoDetails").hidden = hasCost || hasNotes;
}

function populateFsForm(a) {
  $("fsItemForm")?.classList.remove("was-validated");
  $("fsTitle").value = a.title;
  $("fsTitle").title = a.title || "";
  $("fsTitle").setCustomValidity("");
  $("fsTitle").classList.remove("is-invalid");
  $("fsTitle").closest(".fs-title-wrap")?.classList.remove("is-invalid");

  const tripStart = getTripStart();
  const tripEnd = getTripEnd();
  const hasEnd = hasTripEndDate();
  ["fsStartDate", "fsEndDate"].forEach(id => {
    const el = $(id);
    if (el) {
      el.min = tripStart;
      if (hasEnd) el.max = tripEnd;
      else el.removeAttribute("max");
    }
  });

  $("fsStartDate").value = a.date || defaultDate();
  $("fsStartTime").value = a.time || "";
  $("fsEndDate").value = a.endDate || "";
  $("fsEndDate").min = $("fsStartDate").value || tripStart;
  $("fsEndTime").value = a.endTime || "";

  populateFsTimezoneSelects();
  $("fsTz").value = a.tz || DEFAULT_TZ;
  $("fsEndTz").value = a.endTz || a.tz || DEFAULT_TZ;
  delete $("fsEndTz").dataset.userModified;
  $("fsTz").dataset.prev = $("fsTz").value;
  updateFsTzBadges();
  updateFsTzPreview();

  ["fsStartDate", "fsEndDate", "fsStartTime", "fsEndTime"].forEach(fid => {
    const el = $(fid);
    if (!el) return;
    el.setCustomValidity("");
    el.classList.remove("is-invalid");
    el.closest(".dt-box")?.classList.remove("is-invalid");
  });

  $("fsCost").value = (a.cost > 0) ? a.cost : "";
  $("fsCurrency").value = a.currency || "USD";
  $("fsItemForm").elements.fsType.value = a.type;
  $("fsItemForm").elements.fsStatus.value = a.status;
  $("fsNotes").value = a.notes || "";
  if ($("fsDelete")) $("fsDelete").hidden = !editingItem;
  fsInitialSnapshot = getFsSnapshot();
}

export function openItemFullscreenDialog(id, initialDate, defaultType) {
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

  populateFsForm(a);

  if (editingItem) {
    renderFsView(editingItem);
    setFsMode("view");
  } else {
    setFsMode("edit");
  }

  $("itemFullscreenDialog").showModal();
  if (editingItem) {
    $("fsClose")?.focus({ preventScroll: true });
  } else {
    focusFsTitle();
  }
}

export function initItemFullscreenDialog(onItemChanged) {
  ["fsStartDate", "fsEndDate"].forEach(id => {
    const el = $(id);
    if (el) {
      el.min = getTripStart();
      if (hasTripEndDate()) el.max = getTripEnd();
      else el.removeAttribute("max");
    }
  });

  // Populate color-coded Type chips (.chip-opt)
  const typesContainer = $("fsTypes");
  if (typesContainer) {
    typesContainer.innerHTML = TYPES.map(t =>
      `<label class="chip-opt" style="${typeVar(t)}"><input type="radio" name="fsType" value="${t}" required><span>${icon(TYPE_META[t].icon)}${t}</span></label>`
    ).join("");
  }

  // Populate color-coded Status chips (.chip-opt)
  const statusesContainer = $("fsStatuses");
  if (statusesContainer) {
    statusesContainer.innerHTML = STATUSES.map(st =>
      `<label class="chip-opt" style="--c:var(${st === "Confirmed" ? "--ok" : "--warn"})"><input type="radio" name="fsStatus" value="${st}" required><span>${icon(st === "Confirmed" ? "check" : "clock")}${st}</span></label>`
    ).join("");
  }

  // Switch from View Mode to Edit Mode
  $("fsEditBtn")?.addEventListener("click", () => {
    setFsMode("edit");
  });

  // Title validation
  const titleInput = $("fsTitle");
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      titleInput.setCustomValidity(titleInput.value.trim() ? "" : "Enter some text, not just spaces.");
      titleInput.title = titleInput.value;
    });
    titleInput.addEventListener("blur", () => {
      const isMissing = titleInput.required && !titleInput.value.trim();
      titleInput.classList.toggle("is-invalid", isMissing);
      titleInput.closest(".fs-title-wrap")?.classList.toggle("is-invalid", isMissing);
    });
  }

  // Date & Time listeners
  $("fsStartDate")?.addEventListener("change", () => {
    $("fsEndDate").min = $("fsStartDate").value || getTripStart();
  });
  $("fsStartDate")?.addEventListener("blur", () => {
    if (!validDate($("fsStartDate").value)) {
      $("fsStartDate").classList.add("is-invalid");
      $("fsStartDate").closest(".dt-box")?.classList.add("is-invalid");
    }
  });

  ["fsTitle", "fsStartDate", "fsEndDate", "fsStartTime", "fsEndTime"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      el.setCustomValidity("");
      el.classList.remove("is-invalid");
      el.closest(".dt-box")?.classList.remove("is-invalid");
      el.closest(".fs-title-wrap")?.classList.remove("is-invalid");
    });
  });

  $("fsTzBtn")?.addEventListener("click", () => {
    openTimezoneDialog({
      currentTz: $("fsTz")?.value || DEFAULT_TZ,
      onSelect: tzId => {
        const input = $("fsTz");
        if (!input) return;
        input.value = tzId;
        input.dispatchEvent(new Event("change"));
      }
    });
  });

  $("fsEndTzBtn")?.addEventListener("click", () => {
    openTimezoneDialog({
      currentTz: $("fsEndTz")?.value || $("fsTz")?.value || DEFAULT_TZ,
      onSelect: tzId => {
        const input = $("fsEndTz");
        if (!input) return;
        input.value = tzId;
        input.dispatchEvent(new Event("change"));
      }
    });
  });

  $("fsTz")?.addEventListener("change", () => {
    if (!$("fsEndTz").dataset.userModified || $("fsEndTz").value === $("fsTz").dataset.prev) {
      $("fsEndTz").value = $("fsTz").value;
    }
    $("fsTz").dataset.prev = $("fsTz").value;
    updateFsTzBadges();
    updateFsTzPreview();
  });
  $("fsTz")?.addEventListener("input", updateFsTzBadges);
  $("fsEndTz")?.addEventListener("change", () => {
    $("fsEndTz").dataset.userModified = "true";
    updateFsTzBadges();
    updateFsTzPreview();
  });
  $("fsEndTz")?.addEventListener("input", updateFsTzBadges);

  ["fsStartDate", "fsStartTime", "fsEndDate", "fsEndTime"].forEach(fid => {
    const el = $(fid);
    if (!el) return;
    el.addEventListener("input", updateFsTzPreview);
    el.addEventListener("change", updateFsTzPreview);
    el.addEventListener("click", () => {
      try { el.showPicker?.(); } catch {}
    });
  });

  // Dialog cancel
  $("itemFullscreenDialog")?.addEventListener("cancel", e => {
    if ((currentMode === "edit" && editingItem) || isFsDirty()) {
      e.preventDefault();
      requestCloseFsDialog();
    }
  });

  // Form submit
  $("fsItemForm")?.addEventListener("submit", e => {
    e.preventDefault();
    $("fsItemForm").classList.add("was-validated");
    const f = $("fsItemForm").elements;
    const startDate = $("fsStartDate").value;
    const endDate = $("fsEndDate").value;
    const startTime = $("fsStartTime").value;
    const endTime = $("fsEndTime").value;

    ["fsTitle", "fsStartDate", "fsEndDate", "fsStartTime", "fsEndTime"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.setCustomValidity("");
      el.classList.remove("is-invalid");
      el.closest(".dt-box")?.classList.remove("is-invalid");
      el.closest(".fs-title-wrap")?.classList.remove("is-invalid");
    });

    if (!$("fsTitle").value.trim()) {
      $("fsTitle").setCustomValidity("Please enter a title.");
      $("fsTitle").classList.add("is-invalid");
      $("fsTitle").closest(".fs-title-wrap")?.classList.add("is-invalid");
      $("fsTitle").reportValidity();
      return;
    }
    const tripStart = getTripStart();
    const tripEnd = getTripEnd();
    const hasEnd = hasTripEndDate();
    const rangeMsg = hasEnd
      ? `Please select a trip date between ${fmtDateLong(tripStart)} and ${fmtDateLong(tripEnd)}.`
      : `Please select a trip date on or after ${fmtDateLong(tripStart)}.`;
    if (!validDate(startDate)) {
      $("fsStartDate").setCustomValidity(rangeMsg);
      $("fsStartDate").classList.add("is-invalid");
      $("fsStartDate").closest(".dt-box")?.classList.add("is-invalid");
      $("fsStartDate").reportValidity();
      return;
    }
    if (endDate && !validDate(endDate)) {
      $("fsEndDate").setCustomValidity(rangeMsg);
      $("fsEndDate").classList.add("is-invalid");
      $("fsEndDate").closest(".dt-box")?.classList.add("is-invalid");
      $("fsEndDate").reportValidity();
      return;
    }
    if (endDate && endDate < startDate) {
      $("fsEndDate").setCustomValidity("End date cannot be earlier than start date.");
      $("fsEndDate").classList.add("is-invalid");
      $("fsEndDate").closest(".dt-box")?.classList.add("is-invalid");
      $("fsEndDate").reportValidity();
      return;
    }
    const sTz = $("fsTz")?.value || DEFAULT_TZ;
    const eTz = $("fsEndTz")?.value || sTz;
    if (!isValidTimeInterval(startDate, endDate, startTime, endTime, sTz, eTz)) {
      $("fsEndTime").setCustomValidity("End datetime cannot be earlier than start datetime.");
      $("fsEndTime").classList.add("is-invalid");
      $("fsEndTime").closest(".dt-box")?.classList.add("is-invalid");
      $("fsEndTime").reportValidity();
      return;
    }
    const costVal = parseFloat($("fsCost").value);
    const cost = (!isNaN(costVal) && costVal > 0) ? Math.round(costVal * 100) / 100 : null;
    const data = {
      title: $("fsTitle").value.trim(),
      date: startDate,
      endDate: endDate || "",
      time: startTime,
      endTime: endTime || "",
      tz: sTz,
      endTz: eTz,
      cost,
      currency: $("fsCurrency").value,
      confirmation: editingItem ? (editingItem.confirmation || "") : "",
      bookBy: editingItem ? (editingItem.bookBy || "") : "",
      url: editingItem ? (editingItem.url || "") : "",
      type: f.fsType.value,
      status: f.fsStatus.value,
      notes: $("fsNotes").value.trim()
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
    fsInitialSnapshot = getFsSnapshot();
    $("itemFullscreenDialog").close();
    save();
    if (onItemChanged) onItemChanged(id);
  });

  // Delete item (from either View mode or Edit mode)
  async function handleDelete() {
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
    fsInitialSnapshot = getFsSnapshot();
    $("itemFullscreenDialog").close();
    save();
    if (onItemChanged) onItemChanged(null);
  }

  $("fsDelete")?.addEventListener("click", handleDelete);
  $("fsViewDelete")?.addEventListener("click", handleDelete);
}
