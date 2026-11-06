/* Backup and Settings Controls */

import { $ } from "../../shared/utils/dom.js";
import { downloadBackup, restoreBackup } from "../../shared/domain/backup.js";
import { exportIcsCalendar } from "../../shared/domain/ics.js";

export function initBackupControls() {
  $("exportIcs")?.addEventListener("click", exportIcsCalendar);
  $("export")?.addEventListener("click", downloadBackup);
  $("restore")?.addEventListener("click", () => $("import")?.click());

  $("import")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (file) await restoreBackup(file);
    e.target.value = "";
  });
}
