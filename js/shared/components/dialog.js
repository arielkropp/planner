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

// `signal` removes the document-level listeners when the platform that registered them unmounts.
export function initDialogs(customCloseHandlers = {}, { signal } = {}) {
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
  }, { signal });

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

  // Swipe drag bar down to dismiss fullscreen dialogs
  initFullscreenSwipe(customCloseHandlers, { signal });
}

function initFullscreenSwipe(customCloseHandlers, { signal } = {}) {
  document.querySelectorAll("dialog.fs-item-dialog").forEach(dialog => {
    const header = dialog.querySelector(".fs-header");
    if (!header) return;

    let startX = 0;
    let startY = 0;
    let currentY = 0;
    let startTime = 0;
    let activePointerId = null;
    let isDragging = false;

    header.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      if (e.target.closest("button, a, input, select, textarea, label")) return;

      startX = e.clientX;
      startY = e.clientY;
      currentY = startY;
      startTime = Date.now();
      activePointerId = e.pointerId;
      isDragging = false;
    }, { signal });

    header.addEventListener("pointermove", e => {
      if (activePointerId !== e.pointerId) return;

      const dy = e.clientY - startY;
      const dx = e.clientX - startX;

      if (!isDragging) {
        if (dy > 6 && dy > Math.abs(dx)) {
          isDragging = true;
          try {
            header.setPointerCapture(e.pointerId);
          } catch {}
          dialog.style.transition = "none";
        } else if (Math.abs(dx) > 8 || dy < -8) {
          activePointerId = null;
          return;
        }
      }

      if (isDragging) {
        currentY = e.clientY;
        const moveY = Math.max(0, dy);
        dialog.style.setProperty("--fs-swipe-y", `${moveY}px`);
      }
    }, { signal });

    const finishSwipe = async e => {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;

      try {
        header.releasePointerCapture(e.pointerId);
      } catch {}

      if (!isDragging) return;
      isDragging = false;

      const dy = Math.max(0, currentY - startY);
      const dt = Math.max(1, Date.now() - startTime);
      const velocity = dy / dt;
      const threshold = 75;
      const shouldDismiss = dy >= threshold || (dy >= 30 && velocity >= 0.4);

      if (shouldDismiss) {
        dialog.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1)";
        dialog.style.setProperty("--fs-swipe-y", "100vh");

        setTimeout(async () => {
          let closed = true;
          if (customCloseHandlers[dialog.id]) {
            const res = await customCloseHandlers[dialog.id](dialog, true);
            if (res === false) closed = false;
          } else {
            dialog.close();
          }

          if (!closed && dialog.open) {
            dialog.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
            dialog.style.setProperty("--fs-swipe-y", "0px");
            setTimeout(() => {
              dialog.style.transition = "";
              dialog.style.removeProperty("--fs-swipe-y");
            }, 250);
          } else {
            dialog.style.transition = "";
            dialog.style.removeProperty("--fs-swipe-y");
          }
        }, 220);
      } else {
        dialog.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
        dialog.style.setProperty("--fs-swipe-y", "0px");
        setTimeout(() => {
          dialog.style.transition = "";
          dialog.style.removeProperty("--fs-swipe-y");
        }, 200);
      }
    };

    header.addEventListener("pointerup", finishSwipe, { signal });
    header.addEventListener("pointercancel", finishSwipe, { signal });

    dialog.addEventListener("close", () => {
      dialog.style.transition = "";
      dialog.style.removeProperty("--fs-swipe-y");
    }, { signal });
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
  }, { signal });
}

