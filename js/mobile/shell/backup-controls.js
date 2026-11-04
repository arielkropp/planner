/* Backup Buttons in the Sidebar Utilities */

import { $ } from "../../shared/utils/dom.js";
import { downloadBackup, restoreBackup } from "../../shared/domain/backup.js";

export function initBackupControls() {
  $("export")?.addEventListener("click", downloadBackup);
  $("restore")?.addEventListener("click", () => $("import")?.click());

  $("import")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (file) await restoreBackup(file);
    e.target.value = "";
  });
}
