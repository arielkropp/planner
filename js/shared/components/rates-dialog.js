/* Budget & Currency Rates Dialog Component */

import { DEFAULT_RATES } from "../constants.js";
import { $ } from "../utils/dom.js";
import { getState, save } from "../state/store.js";

export function openRatesDialog() {
  const triggerEl = document.activeElement;
  const dlg = $("ratesDialog");
  const r = getState().rates || DEFAULT_RATES;
  if ($("ratesBase")) $("ratesBase").value = r.base || "USD";
  if ($("rateEUR")) $("rateEUR").value = r.EUR ?? "";
  if ($("rateGBP")) $("rateGBP").value = r.GBP ?? "";
  if ($("rateILS")) $("rateILS").value = r.ILS ?? "";
  if (dlg) {
    dlg?.addEventListener?.("close", () => { triggerEl?.focus?.(); }, { once: true });
    dlg.showModal();
    $("ratesBase")?.focus();
  }
}

export function initRatesDialog() {
  $("openRatesUtil")?.addEventListener("click", () => openRatesDialog());

  const form = $("ratesForm");
  form?.addEventListener("submit", e => {
    e.preventDefault();
    const base = $("ratesBase")?.value || "USD";
    const eur = parseFloat($("rateEUR")?.value);
    const gbp = parseFloat($("rateGBP")?.value);
    const ils = parseFloat($("rateILS")?.value);

    getState().rates = {
      base,
      EUR: Number.isFinite(eur) && eur > 0 ? eur : null,
      GBP: Number.isFinite(gbp) && gbp > 0 ? gbp : null,
      ILS: Number.isFinite(ils) && ils > 0 ? ils : null
    };

    $("ratesDialog")?.close();
    save();
  });
}
