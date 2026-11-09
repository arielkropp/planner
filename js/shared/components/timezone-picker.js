/* Timezone Search Dialog Component */

import { $ } from "../utils/dom.js";
import { esc } from "../utils/dom.js";
import { TIMEZONES, searchTimezones, highlightMatch, findTimezone } from "../data/timezones.js";

let activeCallback = null;
let activeCurrentTz = "";

function renderItemHtml(result, isSelected, index) {
  const { tz, matchedTerm, query } = result;
  const highlightedTerm = highlightMatch(matchedTerm, query);
  const optId = `tzOpt_${index}`;

  return `<button type="button" id="${optId}" class="tz-item${isSelected ? " selected active" : ""}" role="option" data-tz-id="${esc(tz.id)}" aria-selected="${isSelected ? "true" : "false"}" tabindex="-1">
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
  const input = $("tzSearchInput");
  if (!listEl) return;

  if (clearBtn) {
    clearBtn.hidden = !query.trim();
  }

  const matches = searchTimezones(query);

  if (matches.length === 0) {
    listEl.innerHTML = "";
    listEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    if (input) {
      input?.setAttribute?.("aria-expanded", "false");
      input?.removeAttribute?.("aria-activedescendant");
    }
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  listEl.hidden = false;

  const html = matches.map((result, idx) => {
    const isSelected = Boolean(activeCurrentTz && result.tz.id === activeCurrentTz);
    return renderItemHtml(result, isSelected, idx);
  }).join("");

  listEl.innerHTML = html;

  // Set active class on selected item if present, else on first item
  const selectedEl = listEl.querySelector(".tz-item.selected");
  let activeEl = selectedEl;
  if (selectedEl) {
    selectedEl.classList.add("active");
  } else {
    const first = listEl.querySelector(".tz-item");
    if (first) {
      first.classList.add("active");
      activeEl = first;
    }
  }

  if (input) {
    input?.setAttribute?.("aria-expanded", "true");
    if (activeEl?.id) {
      input?.setAttribute?.("aria-activedescendant", activeEl.id);
    }
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
  const dlg = $("timezoneDialog");
  if (!dlg || dlg.dataset.tzInit) return;
  dlg.dataset.tzInit = "true";

  const input = $("tzSearchInput");
  const clearBtn = $("tzSearchClear");
  const listEl = $("tzResultsList");

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
    const input = $("tzSearchInput");
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
      const activeItem = items[nextIndex];
      activeItem?.scrollIntoView({ block: "nearest" });
      if (input && activeItem?.id) {
        input?.setAttribute?.("aria-activedescendant", activeItem.id);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const active = listEl?.querySelector(".tz-item.active") || listEl?.querySelector(".tz-item");
      if (active) {
        selectTimezone(active.dataset.tzId);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      selectTimezone(null);
      return;
    }
  });

  dlg.addEventListener("close", () => {
    activeCallback = null;
  });
}

export function openTimezoneDialog({ currentTz = "", onSelect } = {}) {
  const triggerEl = document.activeElement;
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
    dlg?.addEventListener?.("close", () => {
      triggerEl?.focus?.();
      activeCallback = null;
    }, { once: true });
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
