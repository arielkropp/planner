/* Modal Dialog Helpers and Confirmations */

import { $ } from "../utils/dom.js";
import { parseDate } from "../utils/date.js";

export function confirmAsk(title, text, okLabel = "Delete", isDanger = true) {
  const d = $("confirmDialog");
  if (!d) return Promise.resolve(false);

  const titleEl = $("confirmTitle");
  const textEl = $("confirmText");
  const okBtn = $("confirmOk");

  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  if (okBtn) {
    okBtn.textContent = okLabel;
    okBtn.className = isDanger ? "btn danger-solid" : "btn primary";
  }

  d.returnValue = "";
  return new Promise(resolve => {
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
    d.showModal();
  });
}

export function initDialogs(customCloseHandlers = {}) {
  // Close buttons with [data-close]
  document.addEventListener("click", e => {
    const close = e.target.closest("[data-close]");
    if (!close) return;
    const dlg = close.closest("dialog");
    if (!dlg) return;

    if (customCloseHandlers[dlg.id]) {
      customCloseHandlers[dlg.id](dlg);
    } else {
      dlg.close();
    }
  });

  // Backdrop clicks
  document.querySelectorAll("dialog").forEach(d => {
    d.addEventListener("click", e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      const isOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (!isOutside) return;

      if (customCloseHandlers[d.id]) {
        customCloseHandlers[d.id](d);
      } else {
        d.close();
      }
    });
  });

  // Fluent UI date picker icon trigger
  document.addEventListener("click", e => {
    const btn = e.target.closest(".date-picker-btn");
    if (!btn) return;
    const wrap = btn.closest(".fluent-dp");
    if (!wrap) return;
    const picker = wrap.querySelector('input[type="date"]');
    const text = wrap.querySelector('input[type="text"]');
    if (picker) {
      if (text) {
        const iso = parseDate(text.value);
        if (iso) picker.value = iso;
      }
      try {
        picker.showPicker();
      } catch {
        picker.focus();
        picker.click();
      }
    }
  });
}

