/* Trips UI and Management in Settings */

import { $ } from "../utils/dom.js";
import { esc } from "../utils/dom.js";
import { fmtDate, todayIso } from "../utils/date.js";
import { getTrips, getActiveTrip, setActiveTrip, addTrip, updateTrip, deleteTrip } from "../state/store.js";
import { confirmAsk } from "./dialog.js";

export function openAddTripDialog() {
  const dlg = $("tripDialog");
  if (!dlg) return;
  const titleEl = $("tripTitle");
  if (titleEl) titleEl.textContent = "Add trip";
  if ($("tripId")) $("tripId").value = "";
  if ($("tripName")) $("tripName").value = "";
  if ($("tripStartDate")) $("tripStartDate").value = todayIso();
  if ($("tripEndDate")) {
    $("tripEndDate").value = "";
    $("tripEndDate").min = todayIso();
  }
  if ($("tripSubmit")) $("tripSubmit").textContent = "Add trip";
  try {
    dlg.showModal();
  } catch (err) {
    console.error("Could not open tripDialog:", err);
  }
}

export function openEditTripDialog(tripId) {
  const dlg = $("tripDialog");
  if (!dlg) return;
  const trip = getTrips().find(t => t.id === tripId);
  if (!trip) return;
  const titleEl = $("tripTitle");
  if (titleEl) titleEl.textContent = "Edit trip";
  if ($("tripId")) $("tripId").value = trip.id;
  if ($("tripName")) $("tripName").value = trip.name || "";
  if ($("tripStartDate")) $("tripStartDate").value = trip.startDate || todayIso();
  if ($("tripEndDate")) {
    $("tripEndDate").value = trip.endDate || "";
    $("tripEndDate").min = trip.startDate || todayIso();
  }
  if ($("tripSubmit")) $("tripSubmit").textContent = "Save changes";
  try {
    dlg.showModal();
  } catch (err) {
    console.error("Could not open tripDialog:", err);
  }
}

export function renderTripsList() {
  const container = $("tripsList");
  const divider = $("tripsDivider");
  const addDesc = $("addTripDesc");

  const trips = getTrips();
  const activeTrip = getActiveTrip();

  if (divider) {
    divider.hidden = trips.length === 0;
  }
  if (addDesc) {
    addDesc.textContent = trips.length === 0
      ? "Create a trip to start planning your itinerary, packing list and work log"
      : "Create another trip with its own itinerary, packing list and work log";
  }

  if (!container) return;

  if (trips.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = trips.map((t, index) => {
    const isActive = (t.id === activeTrip?.id);
    const startFmt = (typeof t.startDate === "string" && t.startDate.length >= 10) ? fmtDate(t.startDate) : "";
    const endFmt = (typeof t.endDate === "string" && t.endDate.length >= 10) ? fmtDate(t.endDate) : "";
    const datesText = endFmt
      ? `${startFmt} – ${endFmt}`
      : (startFmt ? `From ${startFmt} (Ongoing)` : "Dates not set");
    const agendaCount = t.agenda?.length || 0;
    const packCount = t.packing?.length || 0;
    const workCount = t.work?.length || 0;
    const statsText = `${agendaCount} event${agendaCount === 1 ? "" : "s"} · ${packCount} item${packCount === 1 ? "" : "s"} · ${workCount} work log${workCount === 1 ? "" : "s"}`;
    const dividerHtml = index < trips.length - 1 ? `<div class="settings-divider" aria-hidden="true"></div>` : "";

    return `<div class="trip-row${isActive ? " is-active" : ""}" data-trip-id="${esc(t.id)}">
      <div class="settings-icon-well trip-icon">
        <svg class="i" aria-hidden="true"><use href="#i-pin"/></svg>
      </div>
      <div class="trip-info" data-action="activate" data-id="${esc(t.id)}" role="button" tabindex="0" title="${isActive ? "Current active trip" : "Click to switch to this trip"}">
        <div class="trip-name-wrap">
          <span class="trip-name">${esc(t.name)}</span>
          ${isActive ? `<span class="trip-active-pill"><svg class="i xs" aria-hidden="true"><use href="#i-check"/></svg> Active</span>` : ""}
        </div>
        <div class="trip-meta">${datesText} · ${statsText}</div>
      </div>
      <div class="trip-actions">
        ${!isActive ? `<button type="button" class="btn sm" data-action="activate" data-id="${esc(t.id)}">Set active</button>` : ""}
        <button type="button" class="icon-btn sm" data-action="edit" data-id="${esc(t.id)}" aria-label="Edit ${esc(t.name)}" title="Edit trip"><svg class="i sm" aria-hidden="true"><use href="#i-pencil"/></svg></button>
        ${trips.length > 1 ? `<button type="button" class="icon-btn sm danger" data-action="delete" data-id="${esc(t.id)}" aria-label="Delete ${esc(t.name)}" title="Delete trip"><svg class="i sm" aria-hidden="true"><use href="#i-trash"/></svg></button>` : ""}
      </div>
    </div>${dividerHtml}`;
  }).join("");
}

let controlsBound = false;

export function initTripControls() {
  if (controlsBound) return;
  controlsBound = true;

  document.addEventListener("click", async e => {
    const addBtn = e.target.closest("#addTripBtn, [data-action='add-trip']");
    if (addBtn) {
      e.preventDefault();
      openAddTripDialog();
      return;
    }

    const activateBtn = e.target.closest('[data-action="activate"]');
    if (activateBtn) {
      const id = activateBtn.dataset.id;
      if (id) setActiveTrip(id);
      return;
    }

    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      const id = editBtn.dataset.id;
      if (id) openEditTripDialog(id);
      return;
    }

    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const trip = getTrips().find(t => t.id === id);
      if (!trip) return;
      const confirmed = await confirmAsk(
        "Delete trip?",
        `Are you sure you want to delete "${trip.name}" and all of its itinerary, packing list, and work log data?`,
        "Delete trip",
        true
      );
      if (confirmed) {
        deleteTrip(id);
      }
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      const activateTarget = e.target.closest('[data-action="activate"]');
      if (activateTarget && activateTarget.tagName !== "BUTTON") {
        e.preventDefault();
        const id = activateTarget.dataset.id;
        if (id) setActiveTrip(id);
      }
    }
  });

  document.addEventListener("change", e => {
    if (e.target && e.target.id === "tripStartDate") {
      const endInp = $("tripEndDate");
      if (endInp) endInp.min = e.target.value || "";
    }
  });

  document.addEventListener("submit", e => {
    const form = e.target.closest("#tripForm");
    if (!form) return;
    e.preventDefault();

    const id = $("tripId")?.value;
    const name = $("tripName")?.value || "";
    const startDate = $("tripStartDate")?.value || "";
    const endDate = $("tripEndDate")?.value || "";
    const endInp = $("tripEndDate");

    if (endDate && endDate < startDate) {
      if (endInp) {
        endInp.setCustomValidity("End date cannot be earlier than start date.");
        endInp.reportValidity();
      }
      return;
    }

    if (id) {
      updateTrip(id, { name, startDate, endDate });
    } else {
      addTrip({ name, startDate, endDate }, true);
    }

    $("tripDialog")?.close();
  });
}
