/* Data Backup and Restore (JSON export / import) */

import { todayIso } from "../utils/date.js";
import { getState, setState, showError, setBlocked } from "../state/store.js";
import { fromAnyVersion } from "../state/migrations.js";
import { confirmAsk } from "../components/dialog.js";

export function downloadBackup() {
  const state = getState();
  const cleanPacking = (state.packing || []).filter(p => !p._draft);
  const exportState = { ...state, packing: cleanPacking };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 2, state: exportState }, null, 2)], {
      type: "application/json"
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `trip-planner-backup-${todayIso()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreBackup(file) {
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (![1, 2].includes(backup?.version) || !backup.state) {
      throw new Error("This is not a planner backup.");
    }
    const restored = fromAnyVersion(backup.state);
    const confirmed = await confirmAsk(
      "Replace current planner?",
      "This will overwrite your current trip data with the selected backup. Download a backup first if you want to keep your current changes.",
      "Replace planner",
      true
    );
    if (!confirmed) return;

    setBlocked(false);
    setState(restored, true);
  } catch (error) {
    showError(`Could not restore backup: ${error.message} Your current planner has not been replaced.`);
  }
}

