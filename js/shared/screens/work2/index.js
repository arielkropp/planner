/* Work Log 2 Screen Coordinator */

import { $, esc } from "../../utils/dom.js";
import { fmtDate, validAnyDate, todayIso } from "../../utils/date.js";
import { uid, num } from "../../utils/format.js";
import { getState, getActiveTrip, save } from "../../state/store.js";
import { confirmAsk } from "../../components/dialog.js";
import { nextWorkDate } from "../../domain/work-calc.js";

export function getWork2Items() {
  return getActiveTrip()?.work || [];
}

export function getWork2Item(id) {
  return getWork2Items().find(w => w.id === id) || null;
}

export function addWork2Item({ date, hours, note }) {
  const active = getActiveTrip();
  if (!active) return;
  if (!active.work) active.work = [];
  const id = uid();
  const parsedHours = Math.round(Math.min(24, Math.max(0.1, Number(hours) || 0)) * 100) / 100;
  active.work.push({
    id,
    date: validAnyDate(date) ? date : todayIso(),
    hours: parsedHours,
    note: typeof note === "string" ? note.slice(0, 200) : ""
  });
  save();
  renderWork2();
}

export function updateWork2Item(id, { date, hours, note }) {
  const active = getActiveTrip();
  if (!active || !active.work) return;
  const item = active.work.find(w => w.id === id);
  if (!item) return;
  const parsedHours = Math.round(Math.min(24, Math.max(0.1, Number(hours) || 0)) * 100) / 100;
  item.date = validAnyDate(date) ? date : item.date;
  item.hours = parsedHours;
  item.note = typeof note === "string" ? note.slice(0, 200) : "";
  save();
  renderWork2();
}

export function deleteWork2Item(id) {
  const active = getActiveTrip();
  if (!active || !active.work) return;
  const idx = active.work.findIndex(w => w.id === id);
  if (idx !== -1) {
    active.work.splice(idx, 1);
    save();
    renderWork2();
  }
}

export function renderWork2Stats() {
  const active = getActiveTrip();
  const work = active?.work || [];
  const logged = Math.round(work.reduce((sum, w) => sum + (Number(w.hours) || 0), 0) * 100) / 100;
  const loggedStr = Number.isInteger(logged) ? String(logged) : num(logged, 1);

  const target = Number.isFinite(Number(active?.workTarget)) ? Number(active.workTarget) : 42;
  const targetStr = Number.isInteger(target) ? String(target) : num(target, 1);

  const loggedEl = $("work2Logged");
  if (loggedEl) loggedEl.textContent = loggedStr;

  const targetEl = $("work2Target");
  if (targetEl) targetEl.textContent = targetStr;
}

export function renderSettingsTarget() {
  const inp = $("workTargetInput");
  if (inp && document.activeElement !== inp) {
    const active = getActiveTrip();
    inp.value = active?.workTarget ?? 42;
  }
}

function attachSwipeHandlers(wrapper, item) {
  const content = wrapper.querySelector(".work2-row-content");
  const bg = wrapper.querySelector(".work2-swipe-bg");
  if (!content) return;

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isSwiping = false;
  let isDragging = false;
  let activePointerId = null;

  const threshold = 75;

  content.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    currentX = startX;
    isSwiping = false;
    isDragging = false;
    activePointerId = e.pointerId;
  });

  content.addEventListener("pointermove", e => {
    if (activePointerId !== e.pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isDragging) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          isDragging = true;
          isSwiping = true;
          content.classList.add("is-swiping");
          try {
            content.setPointerCapture(e.pointerId);
          } catch {}
        }
      } else if (Math.abs(dy) > 8) {
        activePointerId = null;
        return;
      }
    }

    if (isSwiping) {
      currentX = e.clientX;
      const moveX = Math.max(0, dx);
      content.style.transform = `translateX(${moveX}px)`;
      if (moveX >= threshold) {
        bg?.classList.add("is-triggered");
      } else {
        bg?.classList.remove("is-triggered");
      }
    }
  });

  const finishGesture = async e => {
    if (activePointerId !== e.pointerId) return;
    activePointerId = null;

    if (isSwiping) {
      content.classList.remove("is-swiping");
      const dx = Math.max(0, currentX - startX);
      bg?.classList.remove("is-triggered");

      if (dx >= threshold) {
        // Slide out to the right (classic animation)
        content.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1)";
        content.style.transform = "translateX(100%)";

        const desc = item.note || fmtDate(item.date) || "this work entry";
        const ok = await confirmAsk(`Delete "${desc}"?`, "Delete work entry", "Delete", true);
        if (ok) {
          wrapper.style.maxHeight = `${wrapper.offsetHeight}px`;
          void wrapper.offsetHeight;
          wrapper.classList.add("is-deleting");
          setTimeout(() => {
            deleteWork2Item(item.id);
          }, 240);
        } else {
          content.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
          content.style.transform = "translateX(0)";
        }
      } else {
        content.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
        content.style.transform = "translateX(0)";
      }
      isSwiping = false;
      isDragging = false;
    } else {
      // Tap or click -> open edit dialog
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx < 6 && dy < 6) {
        openWork2Dialog(item.id);
      }
    }
  };

  content.addEventListener("pointerup", finishGesture);
  content.addEventListener("pointercancel", finishGesture);
}

export function renderWork2List() {
  const listEl = $("work2List");
  if (!listEl) return;

  const work = getWork2Items();
  if (work.length === 0) {
    listEl.innerHTML = `<div class="work2-empty">No work entries logged yet. Click + to add an entry.</div>`;
    return;
  }

  // Sort by date descending
  const sorted = [...work].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""));

  listEl.innerHTML = sorted.map(w => {
    const hrs = Number.isInteger(w.hours) ? String(w.hours) : num(w.hours, 1);
    return `
      <div class="work2-row-wrapper" data-id="${esc(w.id)}">
        <div class="work2-swipe-bg" aria-hidden="true">
          <div class="work2-swipe-action">
            <svg class="i sm" aria-hidden="true"><use href="#i-trash"/></svg>
            <span>Delete</span>
          </div>
        </div>
        <div class="work2-row-content" data-action="edit" data-id="${esc(w.id)}">
          <div class="work2-col-desc">${esc(w.note || "(No description)")}</div>
          <div class="work2-col-date">${fmtDate(w.date)}</div>
          <div class="work2-col-hrs">${hrs}</div>
        </div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".work2-row-wrapper").forEach(wrapper => {
    const id = wrapper.dataset.id;
    const item = work.find(w => w.id === id);
    if (item) attachSwipeHandlers(wrapper, item);
  });
}

export function renderWork2() {
  renderWork2Stats();
  renderWork2List();
  renderSettingsTarget();
}

export function openWork2Dialog(itemId = null) {
  const dlg = $("work2ItemDialog");
  if (!dlg) return;

  const titleEl = $("work2DialogTitle");
  const idEl = $("work2ItemId");
  const noteEl = $("work2ItemNote");
  const dateEl = $("work2ItemDate");
  const hoursEl = $("work2ItemHours");
  const delBtn = $("work2ItemDelete");
  const submitBtn = $("work2ItemSubmit");

  if (itemId) {
    const item = getWork2Item(itemId);
    if (!item) return;

    if (titleEl) titleEl.textContent = "Edit work entry";
    if (idEl) idEl.value = item.id;
    if (noteEl) noteEl.value = item.note || "";
    if (dateEl) dateEl.value = item.date || todayIso();
    if (hoursEl) hoursEl.value = item.hours || 4;
    if (delBtn) delBtn.hidden = false;
    if (submitBtn) submitBtn.textContent = "Save";
  } else {
    if (titleEl) titleEl.textContent = "Add work entry";
    if (idEl) idEl.value = "";
    if (noteEl) noteEl.value = "";
    if (dateEl) dateEl.value = nextWorkDate() || todayIso();
    if (hoursEl) hoursEl.value = 4;
    if (delBtn) delBtn.hidden = true;
    if (submitBtn) submitBtn.textContent = "Save";
  }

  noteEl?.classList.remove("is-invalid");
  noteEl?.closest(".fs-title-wrap")?.classList.remove("is-invalid");

  dlg.showModal();
  requestAnimationFrame(() => noteEl?.focus());
}

export function initWork2({ signal } = {}) {
  const fab = $("addWork2Item");
  if (fab) {
    fab.addEventListener("click", () => openWork2Dialog());
  }

  const closeBtn = $("work2Close");
  const dlg = $("work2ItemDialog");
  if (closeBtn && dlg) {
    closeBtn.addEventListener("click", () => dlg.close());
  }

  const hoursDec = $("work2HoursDec");
  const hoursInc = $("work2HoursInc");
  const hoursInput = $("work2ItemHours");

  if (hoursDec && hoursInput) {
    hoursDec.addEventListener("click", () => {
      const val = parseFloat(hoursInput.value) || 1;
      const next = val > 1 ? val - 1 : Math.max(0.25, val - 0.25);
      hoursInput.value = String(Math.round(next * 100) / 100);
    });
  }

  if (hoursInc && hoursInput) {
    hoursInc.addEventListener("click", () => {
      const val = parseFloat(hoursInput.value) || 0;
      const next = Math.min(24, val + 1);
      hoursInput.value = String(Math.round(next * 100) / 100);
    });
  }

  const noteInput = $("work2ItemNote");
  if (noteInput) {
    noteInput.addEventListener("input", () => {
      noteInput.classList.remove("is-invalid");
      noteInput.closest(".fs-title-wrap")?.classList.remove("is-invalid");
    });
  }

  const delBtn = $("work2ItemDelete");
  if (delBtn) {
    delBtn.addEventListener("click", async () => {
      const id = $("work2ItemId")?.value;
      if (!id) return;

      const item = getWork2Item(id);
      const desc = item?.note || fmtDate(item?.date) || "this work entry";
      const ok = await confirmAsk(`Delete "${desc}"?`, "Delete work entry", "Delete", true);
      if (!ok) return;

      deleteWork2Item(id);
      dlg?.close();
    });
  }

  const form = $("work2ItemForm");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();

      const note = noteInput?.value?.trim() || "";
      if (!note) {
        noteInput?.classList.add("is-invalid");
        noteInput?.closest(".fs-title-wrap")?.classList.add("is-invalid");
        noteInput?.focus();
        return;
      }

      const id = $("work2ItemId")?.value;
      const date = $("work2ItemDate")?.value || todayIso();
      const hours = parseFloat(hoursInput?.value) || 4;

      if (id) {
        updateWork2Item(id, { date, hours, note });
      } else {
        addWork2Item({ date, hours, note });
      }

      dlg?.close();
    });
  }

  // Work log target setting input
  const targetInp = $("workTargetInput");
  if (targetInp) {
    targetInp.addEventListener("input", e => {
      const active = getActiveTrip();
      if (!active) return;
      const val = parseFloat(e.target.value);
      active.workTarget = Number.isFinite(val) && val >= 0 ? val : 0;
      save();
      renderWork2Stats();
    });
  }

  renderWork2();
}
