/* Modal Dialog Helpers and Confirmations */

import { $ } from "../utils/dom.js";
import { parseDate } from "../utils/date.js";

export function confirmAsk(title, text, okLabel = "Delete", isDanger = true) {
  const d = $("confirmDialog");
  if (!d) return Promise.resolve(false);
  if (d.open) {
    try { d.close(); } catch {}
  }
  const prevActive = document.activeElement;

  const titleEl = $("confirmTitle");
  const textEl = $("confirmText");
  const okBtn = $("confirmOk");
  const cancelBtn = $("confirmCancel");
  const form = d.querySelector("form");

  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  if (okBtn) {
    okBtn.textContent = okLabel;
    okBtn.className = isDanger ? "btn danger-solid" : "btn primary";
  }

  d.returnValue = "";
  return new Promise(resolve => {
    let isConfirmed = false;
    const onOk = () => { isConfirmed = true; d.returnValue = "ok"; };
    const onCancel = () => { isConfirmed = false; d.returnValue = "cancel"; };
    const onSubmit = e => {
      if (e.submitter?.value === "ok" || e.submitter === okBtn) {
        isConfirmed = true;
      }
    };

    okBtn?.addEventListener("click", onOk);
    cancelBtn?.addEventListener("click", onCancel);
    form?.addEventListener("submit", onSubmit);

    d?.addEventListener?.("close", () => {
      okBtn?.removeEventListener("click", onOk);
      cancelBtn?.removeEventListener("click", onCancel);
      form?.removeEventListener("submit", onSubmit);
      prevActive?.focus?.();
      resolve(isConfirmed || d.returnValue === "ok");
    }, { once: true });
    d.showModal();
    const focusTarget = isDanger ? cancelBtn || okBtn : okBtn;
    focusTarget?.focus();
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
    }, { signal });
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

    const onPointerDown = e => {
      if (e.button !== 0) return;
      if (e.target.closest("button, a, input, select, textarea, label, .chips, .pack-check-circle, .pack-qty-btn")) return;

      const body = e.target.closest(".fs-body");
      if (body && body.scrollTop > 0) return;

      startX = e.clientX;
      startY = e.clientY;
      currentY = startY;
      startTime = Date.now();
      activePointerId = e.pointerId;
      isDragging = false;
    };

    header.addEventListener("pointerdown", onPointerDown, { signal });
    dialog.addEventListener("pointerdown", e => {
      if (e.target.closest(".fs-header")) return;
      onPointerDown(e);
    }, { signal });

    const onPointerMove = e => {
      if (activePointerId !== e.pointerId) return;

      const dy = e.clientY - startY;
      const dx = e.clientX - startX;

      if (!isDragging) {
        if (dy > 6 && dy > Math.abs(dx)) {
          isDragging = true;
          try {
            header.setPointerCapture(e.pointerId);
          } catch {
            try {
              dialog.setPointerCapture(e.pointerId);
            } catch {}
          }
          dialog.classList.add("is-dragging");
          dialog.style.transition = "none";
        } else if (Math.abs(dx) > 12 && Math.abs(dx) > dy) {
          activePointerId = null;
          return;
        } else if (dy < -12) {
          activePointerId = null;
          return;
        }
      }

      if (isDragging) {
        currentY = e.clientY;
        const moveY = dy < 0 ? -Math.min(18, Math.sqrt(Math.abs(dy)) * 2) : dy;
        dialog.style.setProperty("--fs-swipe-y", `${moveY}px`);

        const sheetHeight = dialog.offsetHeight || 500;
        const dragRatio = Math.min(1, Math.max(0, moveY / sheetHeight));
        const backdropOpacity = Math.max(0, 0.55 * (1 - dragRatio));
        dialog.style.setProperty("--fs-backdrop-opacity", backdropOpacity.toFixed(3));
      }
    };

    header.addEventListener("pointermove", onPointerMove, { signal });
    dialog.addEventListener("pointermove", onPointerMove, { signal });

    const finishSwipe = async e => {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;

      try {
        header.releasePointerCapture(e.pointerId);
      } catch {}
      try {
        dialog.releasePointerCapture(e.pointerId);
      } catch {}

      if (!isDragging) return;
      isDragging = false;
      dialog.classList.remove("is-dragging");

      const dy = Math.max(0, currentY - startY);
      const dt = Math.max(1, Date.now() - startTime);
      const velocity = dy / dt;
      const threshold = 75;
      const shouldDismiss = dy >= threshold || (dy >= 30 && velocity >= 0.4);

      if (shouldDismiss) {
        dialog.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease-out";
        dialog.style.setProperty("--fs-swipe-y", "100vh");
        dialog.style.setProperty("--fs-backdrop-opacity", "0");

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
            dialog.style.setProperty("--fs-backdrop-opacity", "0.55");
            setTimeout(() => {
              dialog.style.transition = "";
              dialog.style.removeProperty("--fs-swipe-y");
              dialog.style.removeProperty("--fs-backdrop-opacity");
            }, 250);
          } else {
            dialog.style.transition = "";
            dialog.style.removeProperty("--fs-swipe-y");
            dialog.style.removeProperty("--fs-backdrop-opacity");
          }
        }, 220);
      } else {
        dialog.style.transition = "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)";
        dialog.style.setProperty("--fs-swipe-y", "0px");
        dialog.style.setProperty("--fs-backdrop-opacity", "0.55");
        setTimeout(() => {
          dialog.style.transition = "";
          dialog.style.removeProperty("--fs-swipe-y");
          dialog.style.removeProperty("--fs-backdrop-opacity");
        }, 250);
      }
    };

    header.addEventListener("pointerup", finishSwipe, { signal });
    header.addEventListener("pointercancel", finishSwipe, { signal });
    dialog.addEventListener("pointerup", finishSwipe, { signal });
    dialog.addEventListener("pointercancel", finishSwipe, { signal });

    dialog.addEventListener("close", () => {
      dialog.classList.remove("is-dragging");
      dialog.style.transition = "";
      dialog.style.removeProperty("--fs-swipe-y");
      dialog.style.removeProperty("--fs-backdrop-opacity");
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

