/* Boot: mounts the desktop or mobile UI for the current viewport and swaps live when the viewport crosses the breakpoint.
   Each platform's markup sits in an inert <template> in index.html, so the two UIs never share the document. */

import { initStore, paintStorageStatus } from "./shared/state/store.js";
import { currentPlatform, watchPlatform } from "./shared/platform.js";
import "./vendor/material-web.js";

// Prevent browser from restoring scroll on refresh
history.scrollRestoration = "manual";

const loaders = {
  desktop: () => import("./desktop/app.js"),
  mobile: () => import("./mobile/app.js")
};

let active = null;
let queue = Promise.resolve();

// Index.html picks stylesheets with media queries so the first paint is right; from here on the platform decides.
function applyPlatformStyles(platform) {
  document.documentElement.dataset.platform = platform;
  document.querySelectorAll("link[data-platform-styles]").forEach(link => {
    link.media = link.dataset.platformStyles === platform ? "all" : "not all";
  });
}

async function syncPlatform() {
  const platform = currentPlatform();
  if (active?.platform === platform) return;

  // Swapping would discard whatever is typed into an open dialog, so wait until it closes
  if (active && document.querySelector("dialog[open], md-dialog[open]")) return;

  const { mount } = await loaders[platform]();
  const scrollY = window.scrollY;

  active?.controller.abort();
  const controller = new AbortController();
  const template = document.getElementById(`platform-${platform}`);
  document.getElementById("app").replaceChildren(template.content.cloneNode(true));

  applyPlatformStyles(platform);
  mount({ signal: controller.signal });
  paintStorageStatus();
  window.scrollTo(0, scrollY);

  active = { platform, controller };
}

function requestSync() {
  queue = queue.then(syncPlatform).catch(error => console.error("Could not switch layout:", error));
}

function start() {
  initStore();
  requestSync();
  watchPlatform(requestSync);
  // `close` does not bubble, so listen in the capture phase; the timeout lets the dialog's own close handlers run first.
  document.addEventListener("close", () => setTimeout(requestSync), true);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
