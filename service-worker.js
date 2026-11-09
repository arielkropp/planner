const CACHE_NAME = "trip-planner-5637474e7c1782de3c2279c8fdd981f15885b628";

// The build replaces this line with the app shell, manifest and assets (see scripts/build.mjs)
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/desktop/dialogs.css",
  "./css/desktop/itinerary.css",
  "./css/desktop/layout.css",
  "./css/desktop/main.css",
  "./css/desktop/packing.css",
  "./css/desktop/work.css",
  "./css/mobile/dialogs.css",
  "./css/mobile/itinerary.css",
  "./css/mobile/layout.css",
  "./css/mobile/main.css",
  "./css/mobile/packing.css",
  "./css/mobile/screens.css",
  "./css/mobile/work.css",
  "./css/shared/base.css",
  "./css/shared/gcal-dialog.css",
  "./css/shared/main.css",
  "./css/shared/motion.css",
  "./css/shared/settings.css",
  "./css/shared/variables.css",
  "./js/boot.js",
  "./js/desktop/app.js",
  "./js/desktop/screens/itinerary/agenda.js",
  "./js/desktop/screens/itinerary/calendar.js",
  "./js/desktop/screens/itinerary/dialog-fullscreen.js",
  "./js/desktop/screens/itinerary/dialog.js",
  "./js/desktop/screens/itinerary/index.js",
  "./js/desktop/screens/itinerary/markup.js",
  "./js/desktop/screens/packing/index.js",
  "./js/desktop/screens/work/index.js",
  "./js/desktop/shell/backup-controls.js",
  "./js/mobile/app.js",
  "./js/mobile/screens/itinerary/agenda.js",
  "./js/mobile/screens/itinerary/calendar.js",
  "./js/mobile/screens/itinerary/dialog-fullscreen.js",
  "./js/mobile/screens/itinerary/dialog.js",
  "./js/mobile/screens/itinerary/index.js",
  "./js/mobile/screens/itinerary/markup.js",
  "./js/mobile/screens/packing/index.js",
  "./js/mobile/screens/work/index.js",
  "./js/mobile/shell/backup-controls.js",
  "./js/mobile/shell/settings-drawer.js",
  "./js/shared/components/dialog.js",
  "./js/shared/components/theme.js",
  "./js/shared/components/timezone-picker.js",
  "./js/shared/components/trips-ui.js",
  "./js/shared/constants.js",
  "./js/shared/data/timezones.js",
  "./js/shared/domain/backup.js",
  "./js/shared/domain/ics.js",
  "./js/shared/domain/itinerary.js",
  "./js/shared/domain/work-calc.js",
  "./js/shared/platform.js",
  "./js/shared/router.js",
  "./js/shared/screens/packing/index.js",
  "./js/shared/screens/packing/storage.js",
  "./js/shared/screens/work/index.js",
  "./js/shared/state/migrations.js",
  "./js/shared/state/store.js",
  "./js/shared/state/validation.js",
  "./js/shared/state/view-state.js",
  "./js/shared/utils/date.js",
  "./js/shared/utils/dom.js",
  "./js/shared/utils/format.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable.png",
  "./icons/icon.svg"
];

const APP_ROOT = new URL("./", self.registration.scope).href;
const APP_PAGE = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        const urls = STATIC_ASSETS.map(asset => new URL(asset, self.registration.scope).href);
        return cache.addAll(urls);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("trip-planner-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Network-first for navigation, falling back to cached index.html
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response.ok) return response;
          return caches.open(CACHE_NAME)
            .then(cache => cache.put(APP_ROOT, response.clone()))
            .then(() => response, error => {
              console.error("Offline page cache could not be updated:", error);
              return response;
            });
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(APP_ROOT)) || (await cache.match(APP_PAGE)) || Response.error();
        })
    );
    return;
  }

  // Cache matching from the active cache version for same-origin static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(request).then(cachedResponse => {
        if (cachedResponse) {
          // Fetch update in background if online
          fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse);
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then(networkResponse => {
          if (!networkResponse || !networkResponse.ok) return networkResponse;
          cache.put(request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});
