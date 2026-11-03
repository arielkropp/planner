const CACHE_NAME = "trip-planner-c7899b6b81f4eafc0072e68713467c6e038491a5";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./css/main.css",
  "./css/variables.css",
  "./css/base.css",
  "./css/glass.css",
  "./css/dialogs.css",
  "./css/itinerary.css",
  "./css/packing.css",
  "./css/work.css",
  "./css/responsive.css",
  "./js/app.js",
  "./js/constants.js",
  "./js/router.js",
  "./js/utils/dom.js",
  "./js/utils/date.js",
  "./js/utils/format.js",
  "./js/state/store.js",
  "./js/state/validation.js",
  "./js/state/migrations.js",
  "./js/components/dialog.js",
  "./js/components/theme.js",
  "./js/features/itinerary/itinerary-utils.js",
  "./js/features/itinerary/itinerary-agenda.js",
  "./js/features/itinerary/itinerary-calendar.js",
  "./js/features/itinerary/itinerary-dialog.js",
  "./js/features/itinerary/itinerary-ics.js",
  "./js/features/itinerary/itinerary.js",
  "./js/features/packing/packing-templates.js",
  "./js/features/packing/packing-table.js",
  "./js/features/packing/packing.js",
  "./js/features/work/work-calc.js",
  "./js/features/work/work-coverage.js",
  "./js/features/work/work-dialogs.js",
  "./js/features/work/work-table.js",
  "./js/features/work/work.js",
  "./js/features/settings/backup.js",
  "./js/features/settings/settings-drawer.js"
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

  // Cache-first for same-origin static assets, updating cache in background
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch update in background if online
        fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then(networkResponse => {
        if (!networkResponse || !networkResponse.ok) return networkResponse;
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});
