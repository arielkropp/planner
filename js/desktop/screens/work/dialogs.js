/* Work & Budget Dialogs: Leave Settings & Currency Rates */

import {
  CURRENCIES,
  DEFAULT_RATES,
  DEFAULT_NOV_BALANCE,
  DEFAULT_ACCRUAL,
  DEFAULT_ACCRUAL_MONTHS,
  DEFAULT_STD_DAY
} from "../../../shared/constants.js";
import { $ } from "../../../shared/utils/dom.js";
import { defaultBalance } from "../../../shared/state/validation.js";
import { getState, save } from "../../../shared/state/store.js";

export function openRatesDialog() {
  const r = getState().rates || DEFAULT_RATES;
  if ($("ratesBase")) $("ratesBase").value = r.base || "USD";
  if ($("rateEUR")) $("rateEUR").value = r.EUR ?? "";
  if ($("rateGBP")) $("rateGBP").value = r.GBP ?? "";
  if ($("rateILS")) $("rateILS").value = r.ILS ?? "";
  $("ratesDialog")?.showModal();
}

export function openLeaveSettings() {
  const b = getState().balance || defaultBalance();
  if ($("leaveStartBal")) $("leaveStartBal").value = b.novBalance ?? DEFAULT_NOV_BALANCE;
  if ($("leaveAccrual")) $("leaveAccrual").value = b.accrual ?? DEFAULT_ACCRUAL;
  if ($("leaveMonths")) $("leaveMonths").value = b.accrualMonths ?? DEFAULT_ACCRUAL_MONTHS;
  if ($("leaveStdDay")) $("leaveStdDay").value = b.stdDay ?? DEFAULT_STD_DAY;
  $("leaveDialog")?.showModal();
}

export function initWorkDialogs({ onRatesSaved, onLeaveSaved }) {
  // Rates Dialog
  $("openRatesUtil")?.addEventListener("click", openRatesDialog);

  $("ratesForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const eur = parseFloat($("rateEUR").value);
    const gbp = parseFloat($("rateGBP").value);
    const ils = parseFloat($("rateILS").value);
    const state = getState();

    state.rates = {
      base: CURRENCIES.includes($("ratesBase").value) ? $("ratesBase").value : "USD",
      EUR: (Number.isFinite(eur) && eur > 0) ? eur : null,
      GBP: (Number.isFinite(gbp) && gbp > 0) ? gbp : null,
      ILS: (Number.isFinite(ils) && ils > 0) ? ils : null
    };

    $("ratesDialog")?.close();
    save();
    if (onRatesSaved) onRatesSaved();
  });

  // Leave Dialog
  $("openLeaveSettings")?.addEventListener("click", openLeaveSettings);

  $("leaveResetDefaults")?.addEventListener("click", () => {
    if ($("leaveStartBal")) $("leaveStartBal").value = DEFAULT_NOV_BALANCE;
    if ($("leaveAccrual")) $("leaveAccrual").value = DEFAULT_ACCRUAL;
    if ($("leaveMonths")) $("leaveMonths").value = DEFAULT_ACCRUAL_MONTHS;
    if ($("leaveStdDay")) $("leaveStdDay").value = DEFAULT_STD_DAY;
  });

  $("leaveForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const novBalance = parseFloat($("leaveStartBal").value);
    const accrual = parseFloat($("leaveAccrual").value);
    const accrualMonths = parseInt($("leaveMonths").value, 10);
    const stdDay = parseFloat($("leaveStdDay").value);
    const state = getState();

    state.balance = {
      ...state.balance,
      novBalance: Number.isFinite(novBalance) ? Math.max(-500, Math.min(1000, novBalance)) : DEFAULT_NOV_BALANCE,
      accrual: Number.isFinite(accrual) ? Math.max(0, Math.min(200, accrual)) : DEFAULT_ACCRUAL,
      accrualMonths: Number.isInteger(accrualMonths) ? Math.max(0, Math.min(24, accrualMonths)) : DEFAULT_ACCRUAL_MONTHS,
      stdDay: Number.isFinite(stdDay) ? Math.max(0, Math.min(24, stdDay)) : DEFAULT_STD_DAY
    };

    $("leaveDialog")?.close();
    save();
    if (onLeaveSaved) onLeaveSaved();
  });
}

