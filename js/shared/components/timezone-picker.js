/* Timezone Search Dialog Component */

import { $ } from "../utils/dom.js";
import { esc } from "../utils/dom.js";
import { TIMEZONES, searchTimezones, highlightMatch } from "../data/timezones.js";

let activeCallback = null;
let activeCurrentTz = "";
let isInitialized = false;

function renderItemHtml(result, isSelected) {
  const { tz, matchedTerm, query } = result;
  const highlightedTerm = highlightMatch(matchedTerm, query);

  return `<button type="button" class="tz-item${isSelected ? " selected active" : ""}" role="option" data-tz-id="${esc(tz.id)}" aria-selected="${isSelected ? "true" : "false"}">
    <div class="tz-item-main">
      <div class="tz-item-header">
        <strong class="tz-item-title">${esc(tz.title)}</strong>
        <span class="tz-item-offset">${esc(tz.offset)}</span>
      </div>
      <div class="tz-item-term">${highlightedTerm}</div>
    </div>
    ${isSelected ? `<svg class="i sm tz-item-check" aria-hidden="true"><use href="#i-check"/></svg>` : ""}
  </button>`;
}

function updateList(query = "") {
  const listEl = $("tzResultsList");
  const emptyEl = $("tzEmptyMsg");
  const clearBtn = $("tzSearchClear");
  if (!listEl) return;

  if (clearBtn) {
    clearBtn.hidden = !query.trim();
  }

  const matches = searchTimezones(query);

  if (matches.length === 0) {
    listEl.innerHTML = "";
    listEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  listEl.hidden = false;

  const html = matches.map(result => {
    const isSelected = Boolean(activeCurrentTz && result.tz.id === activeCurrentTz);
    return renderItemHtml(result, isSelected);
  }).join("");

  listEl.innerHTML = html;

  // Set active class on selected item if present, else on first item
  const selectedEl = listEl.querySelector(".tz-item.selected");
  if (selectedEl) {
    selectedEl.classList.add("active");
  } else {
    const first = listEl.querySelector(".tz-item");
    if (first) first.classList.add("active");
  }
}

function selectTimezone(tzId) {
  const dlg = $("timezoneDialog");
  if (activeCallback && tzId) {
    activeCallback(tzId);
  }
  if (dlg) {
    dlg.close();
  }
}

export function initTimezoneDialog() {
  if (isInitialized) return;
  const dlg = $("timezoneDialog");
  const input = $("tzSearchInput");
  const clearBtn = $("tzSearchClear");
  const listEl = $("tzResultsList");
  if (!dlg) return;

  isInitialized = true;

  input?.addEventListener("input", () => {
    updateList(input.value);
  });

  clearBtn?.addEventListener("click", () => {
    if (input) {
      input.value = "";
      input.focus();
    }
    updateList("");
  });

  listEl?.addEventListener("click", e => {
    const item = e.target.closest(".tz-item");
    if (!item) return;
    const tzId = item.dataset.tzId;
    selectTimezone(tzId);
  });

  dlg.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...(listEl?.querySelectorAll(".tz-item") || [])];
      if (!items.length) return;
      const currentIndex = items.findIndex(el => el.classList.contains("active"));
      let nextIndex = 0;
      if (e.key === "ArrowDown") {
        nextIndex = currentIndex >= 0 && currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      items.forEach((el, idx) => el.classList.toggle("active", idx === nextIndex));
      items[nextIndex]?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const active = listEl?.querySelector(".tz-item.active") || listEl?.querySelector(".tz-item");
      if (active) {
        selectTimezone(active.dataset.tzId);
      }
    }
  });

  dlg.addEventListener("close", () => {
    activeCallback = null;
  });
}

export function openTimezoneDialog({ currentTz = "", onSelect } = {}) {
  const dlg = $("timezoneDialog");
  if (!dlg) return;

  initTimezoneDialog();

  const found = currentTz ? findTimezone(currentTz) : null;
  activeCurrentTz = found ? found.id : (currentTz || "");
  activeCallback = onSelect;

  const input = $("tzSearchInput");
  if (input) {
    input.value = "";
  }

  updateList("");

  try {
    dlg.showModal();
  } catch (err) {
    console.error("Could not open timezone dialog:", err);
    return;
  }

  const listEl = $("tzResultsList");
  const selectedEl = listEl?.querySelector('[aria-selected="true"]');
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: "nearest" });
  }

  if (input) {
    input.focus();
    input.select?.();
  }
}
