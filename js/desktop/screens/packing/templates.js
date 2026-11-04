/* Packing Templates Modal and Application */

import { PACK_TEMPLATES } from "../../../shared/constants.js";
import { $, esc } from "../../../shared/utils/dom.js";
import { uid } from "../../../shared/utils/format.js";
import { getState, save } from "../../../shared/state/store.js";

export function renderTemplatesDialog() {
  const body = $("templatesBody");
  if (!body) return;

  const packing = getState().packing || [];
  const existingTitles = new Set(packing.map(p => (p.title || "").trim().toLowerCase()));

  body.innerHTML = PACK_TEMPLATES.map((tpl, idx) => {
    const newCount = tpl.items.filter(([t]) => !existingTitles.has(t.toLowerCase())).length;
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg)">
      <div style="min-width:0">
        <div style="font-weight:650;font-size:13.5px">${esc(tpl.name)}</div>
        <div class="muted" style="font-size:12px">${esc(tpl.desc)} (${tpl.items.length} items)</div>
      </div>
      <button type="button" class="btn sm ${newCount > 0 ? "primary" : ""}" data-apply-tpl="${idx}" ${newCount === 0 ? "disabled" : ""} style="white-space:nowrap;flex-shrink:0;min-width:76px">${newCount === 0 ? "Added" : `+ Add ${newCount}`}</button>
    </div>`;
  }).join("");
}

export function initPackingTemplates(onTemplateApplied) {
  $("openTemplates")?.addEventListener("click", () => {
    renderTemplatesDialog();
    $("templatesDialog")?.showModal();
  });

  $("templatesBody")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-apply-tpl]");
    if (!btn) return;
    const tpl = PACK_TEMPLATES[Number(btn.dataset.applyTpl)];
    if (!tpl) return;

    const state = getState();
    const existingTitles = new Set(state.packing.map(p => (p.title || "").trim().toLowerCase()));
    let added = 0;

    for (const [title, category, qty] of tpl.items) {
      if (!existingTitles.has(title.toLowerCase())) {
        state.packing.push({ id: uid(), title, category, qty, done: false });
        existingTitles.add(title.toLowerCase());
        added++;
      }
    }

    if (added > 0) {
      save();
      renderTemplatesDialog();
      if (onTemplateApplied) onTemplateApplied();
    }
  });
}

