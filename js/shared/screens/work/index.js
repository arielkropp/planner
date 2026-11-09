/* Work Log Screen Coordinator */

import { $, esc } from "../../utils/dom.js";
import { fmtDate, validAnyDate, todayIso } from "../../utils/date.js";
import { pad } from "../../constants.js";
import { uid, num } from "../../utils/format.js";
import { getActiveTrip, commit } from "../../state/store.js";
import { confirmAsk } from "../../components/dialog.js";
import { nextWorkDate } from "../../domain/work-calc.js";

let activeEditId = null;
let lastSwipedTime = 0;

export function getWorkItems() {
  return getActiveTrip()?.work || [];
}

export function getWorkItem(id) {
  return getWorkItems().find(w => w.id === id) || null;
}

export function parseAnyDate(text) {
  if (!text) return null;
  const t = String(text).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t) && validAnyDate(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${yr}-${pad(m[2])}-${pad(m[1])}`;
  return validAnyDate(iso) ? iso : null;
}

export function addWorkItem({ date, hours, note }) {
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
  commit();
  renderWork();
  return id;
}

export function updateWorkItem(id, { date, hours, note }) {
  const active = getActiveTrip();
  if (!active || !active.work) return;
  const item = active.work.find(w => w.id === id);
  if (!item) return;
  const parsedHours = Math.round(Math.min(24, Math.max(0.1, Number(hours) || 0)) * 100) / 100;
  item.date = validAnyDate(date) ? date : item.date;
  item.hours = parsedHours;
  item.note = typeof note === "string" ? note.slice(0, 200) : "";
  commit();
  renderWork();
}

export function deleteWorkItem(id) {
  const active = getActiveTrip();
  if (!active || !active.work) return;
  const idx = active.work.findIndex(w => w.id === id);
  if (idx !== -1) {
    active.work.splice(idx, 1);
    if (activeEditId === id) activeEditId = null;
    commit();
    renderWork();
  }
}

export function renderWorkStats() {
  const active = getActiveTrip();
  const work = active?.work || [];
  const logged = Math.round(work.reduce((sum, w) => sum + (Number(w.hours) || 0), 0) * 100) / 100;
  const loggedStr = Number.isInteger(logged) ? String(logged) : num(logged, 1);

  const target = Number.isFinite(Number(active?.workTarget)) ? Number(active.workTarget) : 42;
  const targetStr = Number.isInteger(target) ? String(target) : num(target, 1);

  const loggedEl = $("workLogged");
  if (loggedEl) loggedEl.textContent = loggedStr;

  const targetEl = $("workTarget");
  if (targetEl) targetEl.textContent = targetStr;
}

export function renderSettingsTarget() {
  const inp = $("workTargetInput");
  if (inp && document.activeElement !== inp) {
    const active = getActiveTrip();
    inp.value = active?.workTarget ?? 42;
  }
}

export function commitActiveEdit(skipRender = false) {
  if (!activeEditId) return;
  const idToCommit = activeEditId;
  const wrapper = document?.querySelector?.(`.work-row-wrapper[data-id="${idToCommit}"]`);
  if (wrapper) {
    const descInput = wrapper.querySelector(".work-inline-desc");
    const dateInput = wrapper.querySelector(".work-inline-date");
    const pickerInput = wrapper.querySelector(".work-date-picker");
    const hrsInput = wrapper.querySelector(".work-inline-hrs");

    const note = descInput ? descInput.value.trim() : "";
    const rawHrs = hrsInput ? parseFloat(hrsInput.value) : NaN;
    const parsedHrs = Number.isFinite(rawHrs) && rawHrs > 0
      ? Math.round(Math.min(24, Math.max(0.1, rawHrs)) * 100) / 100
      : 4;

    let date = null;
    if (pickerInput && validAnyDate(pickerInput.value)) {
      date = pickerInput.value;
    }
    if (dateInput && dateInput.value) {
      const parsed = parseAnyDate(dateInput.value);
      if (parsed) date = parsed;
    }
    if (!validAnyDate(date)) {
      const existing = getWorkItem(idToCommit);
      date = existing?.date || todayIso();
    }

    const active = getActiveTrip();
    if (active?.work) {
      const item = active.work.find(w => w.id === idToCommit);
      if (item) {
        item.date = date;
        item.hours = parsedHrs;
        item.note = typeof note === "string" ? note.slice(0, 200) : "";
        activeEditId = null;
        commit();
      }
    }
  }

  activeEditId = null;
  if (!skipRender) {
    renderWork();
    const row = document?.querySelector?.(`.work-row-wrapper[data-id="${idToCommit}"] .work-row-content`);
    row?.focus?.();
    requestAnimationFrame(() => {
      const row = document?.querySelector?.(`.work-row-wrapper[data-id="${idToCommit}"] .work-row-content`);
      row?.focus?.();
    });
  }
}

export function cancelActiveEdit() {
  if (!activeEditId) return;
  const idToRestore = activeEditId;
  activeEditId = null;
  renderWork();
  const row = document?.querySelector?.(`.work-row-wrapper[data-id="${idToRestore}"] .work-row-content`);
  if (row) {
    row.focus();
  } else {
    $("addWorkItem")?.focus?.();
  }
  requestAnimationFrame(() => {
    const r = document?.querySelector?.(`.work-row-wrapper[data-id="${idToRestore}"] .work-row-content`);
    if (r) r.focus();
  });
}

export function activateInlineEdit(id) {
  if (!id) return;
  if (activeEditId === id) return;
  if (activeEditId) {
    commitActiveEdit(true);
  }
  activeEditId = id;
  renderWork();
  requestAnimationFrame(() => {
    const descInput = document?.querySelector?.(`.work-row-wrapper[data-id="${id}"] .work-inline-desc`);
    descInput?.focus?.();
    if (descInput && typeof descInput.select === "function") {
      descInput.selectionStart = descInput.selectionEnd = descInput.value.length;
    }
  });
}

// Legacy alias in case invoked elsewhere
export function openWorkDialog(id = null) {
  if (id) {
    activateInlineEdit(id);
  } else {
    handleAddNewRow();
  }
}

function handleAddNewRow() {
  if (activeEditId) {
    commitActiveEdit(true);
  }
  const active = getActiveTrip();
  if (!active) return;
  if (!active.work) active.work = [];
  const id = uid();
  const date = nextWorkDate() || todayIso();
  active.work.unshift({
    id,
    date,
    hours: 4,
    note: ""
  });
  activeEditId = id;
  commit();
  renderWork();
  requestAnimationFrame(() => {
    const descInput = document?.querySelector?.(`.work-row-wrapper[data-id="${id}"] .work-inline-desc`);
    descInput?.focus?.();
  });
}

async function requestDeleteWorkItem(item, wrapper, isSwipe = false) {
  const desc = item.note || fmtDate(item.date) || "this work entry";
  const ok = await confirmAsk(`Delete "${desc}"?`, "Delete work entry", "Delete", true);
  if (ok) {
    if (isSwipe && wrapper) {
      wrapper.style.maxHeight = `${wrapper.offsetHeight}px`;
      void wrapper.offsetHeight;
      wrapper.classList.add("is-deleting");
      setTimeout(() => {
        deleteWorkItem(item.id);
      }, 240);
    } else {
      deleteWorkItem(item.id);
    }
  } else if (isSwipe && wrapper) {
    const content = wrapper.querySelector(".work-row-content");
    if (content) {
      content.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
      content.style.transform = "translateX(0)";
    }
  }
}

function attachSwipeHandlers(wrapper, item) {
  const content = wrapper.querySelector(".work-row-content");
  const bg = wrapper.querySelector(".work-swipe-bg");
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
        if (dx < 0) {
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
      const moveX = Math.min(0, dx);
      content.style.transform = `translateX(${moveX}px)`;
      if (moveX <= -threshold) {
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
      lastSwipedTime = Date.now();
      content.classList.remove("is-swiping");
      const dx = Math.min(0, currentX - startX);
      bg?.classList.remove("is-triggered");

      if (dx <= -threshold) {
        content.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1)";
        content.style.transform = "translateX(-100%)";
        await requestDeleteWorkItem(item, wrapper, true);
      } else {
        content.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
        content.style.transform = "translateX(0)";
      }
      isSwiping = false;
      isDragging = false;
    } else {
      // Tap/click -> activate inline editing on this row
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx < 6 && dy < 6) {
        activateInlineEdit(item.id);
      }
    }
  };

  content.addEventListener("pointerup", finishGesture);
  content.addEventListener("pointercancel", finishGesture);
}

function wireInlineEditInputs(wrapper, item) {
  const descInput = wrapper.querySelector(".work-inline-desc");
  const dateInput = wrapper.querySelector(".work-inline-date");
  const datePicker = wrapper.querySelector(".work-date-picker");
  const dateBtn = wrapper.querySelector(".work-date-picker-btn");
  const hrsInput = wrapper.querySelector(".work-inline-hrs");
  const deleteBtn = wrapper.querySelector(".work-inline-delete-btn") || wrapper.querySelector(".work-inline-delete");

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async e => {
      e.stopPropagation();
      e.preventDefault();
      await requestDeleteWorkItem(item, wrapper);
    });
  }

  if (dateBtn && datePicker) {
    dateBtn.addEventListener("click", e => {
      e.stopPropagation();
      try {
        if (typeof datePicker.showPicker === "function") {
          datePicker.showPicker();
        } else {
          datePicker.focus();
        }
      } catch {
        datePicker.focus();
      }
    });
  }

  if (datePicker && dateInput) {
    datePicker.addEventListener("change", () => {
      if (datePicker.value) {
        dateInput.value = fmtDate(datePicker.value);
      }
    });
  }

  if (dateInput && datePicker) {
    dateInput.addEventListener("change", () => {
      const parsed = parseAnyDate(dateInput.value);
      if (parsed) {
        datePicker.value = parsed;
        dateInput.value = fmtDate(parsed);
      }
    });
  }

  if (hrsInput) {
    hrsInput.addEventListener("input", () => {
      let val = hrsInput.value.replace(/[^0-9.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) {
        val = parts[0] + "." + parts.slice(1).join("");
      }
      hrsInput.value = val;
    });
  }

  // Only text inputs commit on Enter
  [descInput, dateInput, hrsInput].forEach(inp => {
    inp?.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitActiveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelActiveEdit();
      }
    });
  });

  // Buttons in inline edit row cancel on Escape, but allow native Enter/Space activation
  [dateBtn, deleteBtn].forEach(btn => {
    btn?.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelActiveEdit();
      }
    });
  });
}

export function renderWorkList() {
  const listEl = $("workList");
  if (!listEl) return;

  const work = getWorkItems();
  if (work.length === 0) {
    listEl.innerHTML = `<div class="work-empty">No work entries logged yet. Click + to add an entry.</div>`;
    return;
  }

  // Sort by date descending, then id descending
  const sorted = [...work].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""));

  listEl.innerHTML = sorted.map(w => {
    const isEditing = w.id === activeEditId;
    const hrs = Number.isInteger(w.hours) ? String(w.hours) : num(w.hours, 1);

    if (isEditing) {
      return `
        <div class="work-row-wrapper is-editing" data-id="${esc(w.id)}">
          <div class="work-row-content is-editing" data-id="${esc(w.id)}">
            <div class="work-col-desc">
              <input type="text" class="work-inline-input work-inline-desc" value="${esc(w.note || "")}" placeholder="Description of work..." maxlength="200" aria-label="Description">
            </div>
            <div class="work-col-date">
              <div class="work-date-wrap">
                <input type="text" class="work-inline-input work-inline-date" value="${esc(fmtDate(w.date))}" placeholder="DD/MM/YY" maxlength="10" aria-label="Date">
                <button type="button" class="work-date-picker-btn" aria-label="Choose date" title="Choose date">
                  <svg class="i" aria-hidden="true"><use href="#i-calendar"/></svg>
                </button>
                <input type="date" class="work-date-picker" value="${esc(w.date || todayIso())}" aria-label="Pick date" tabindex="-1">
              </div>
            </div>
            <div class="work-col-hrs">
              <input type="text" inputmode="decimal" class="work-inline-input work-inline-hrs" value="${esc(hrs)}" placeholder="Hrs" maxlength="5" aria-label="Hours">
            </div>
            <div class="work-col-del">
              <button type="button" class="work-inline-delete-btn work-inline-delete icon-btn danger" aria-label="Delete work entry" title="Delete work entry">
                <svg class="i sm" aria-hidden="true"><use href="#i-trash"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="work-row-wrapper" data-id="${esc(w.id)}">
        <div class="work-swipe-bg" aria-hidden="true">
          <div class="work-swipe-action">
            <svg class="i sm" aria-hidden="true"><use href="#i-trash"/></svg>
            <span>Delete</span>
          </div>
        </div>
        <div class="work-row-content" data-action="inline-edit" data-id="${esc(w.id)}" role="button" tabindex="0" aria-label="Edit work entry: ${esc(w.note || 'No description')}, ${fmtDate(w.date)}, ${hrs} hours">
          <div class="work-col-desc">${esc(w.note || "(No description)")}</div>
          <div class="work-col-date">${fmtDate(w.date)}</div>
          <div class="work-col-hrs">${hrs}</div>
        </div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll?.(".work-row-wrapper")?.forEach(wrapper => {
    const id = wrapper.dataset.id;
    const item = work.find(w => w.id === id);
    if (!item) return;

    if (id === activeEditId) {
      wireInlineEditInputs(wrapper, item);
    } else {
      attachSwipeHandlers(wrapper, item);
    }
  });
}

export function renderWork() {
  renderWorkStats();
  renderWorkList();
  renderSettingsTarget();
}

export function initWork({ signal } = {}) {
  // Add FAB
  const fab = $("addWorkItem");
  if (fab) {
    fab.addEventListener("click", () => handleAddNewRow());
  }

  // Work log target setting input
  const targetInp = $("workTargetInput");
  if (targetInp) {
    targetInp.addEventListener("input", e => {
      const active = getActiveTrip();
      if (!active) return;
      const val = parseFloat(e.target.value);
      active.workTarget = Number.isFinite(val) && val >= 0 ? val : 0;
      commit();
      renderWorkStats();
    });
  }

  // Row selection delegation: clicking another row saves the active row and activates edit mode on the clicked row
  const listEl = $("workList");
  if (listEl) {
    listEl.addEventListener("click", e => {
      if (Date.now() - lastSwipedTime < 300) return;

      const trigger = e.target.closest('[data-action="inline-edit"]');
      if (trigger) {
        const id = trigger.dataset.id;
        if (id && id !== activeEditId) {
          activateInlineEdit(id);
        }
      }
    });

    listEl.addEventListener("keydown", async e => {
      const trigger = e.target.closest('[data-action="inline-edit"]');
      if (!trigger) return;
      const id = trigger.dataset.id;
      if (!id) return;
      const item = getWorkItem(id);
      if (!item) return;

      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        activateInlineEdit(id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const wrapper = trigger.closest(".work-row-wrapper");
        await requestDeleteWorkItem(item, wrapper);
      }
    }, signal ? { signal } : undefined);
  }

  // Click outside active editing row commits active edit
  document.addEventListener("pointerdown", e => {
    if (!activeEditId) return;
    if (document.querySelector("dialog[open]")) return;
    const activeWrapper = document.querySelector(`.work-row-wrapper[data-id="${activeEditId}"]`);
    const addFab = $("addWorkItem");
    if (activeWrapper && !activeWrapper.contains(e.target) && (!addFab || !addFab.contains(e.target))) {
      commitActiveEdit();
    }
  }, { signal });

  renderWork();
}
