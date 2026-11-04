/* Hash-based Screen Router
   Shared by every platform. The itinerary screen has its own sub-views, so the platform passes in a small adapter:
   { getView(), setView(view), onShow(isFirstShow), scrollToToday() } */

import { SCREENS } from "./constants.js";

const HOME = "itinerary";
const LEGACY_HASHES = { agenda: "schedule", trip: "week" };

// Maps a location hash to a screen. `redirect` means the hash should be rewritten to the screen's canonical hash.
export function resolveHash(hash) {
  const name = hash.replace(/^#/, "");
  if (Object.hasOwn(LEGACY_HASHES, name)) {
    return { screen: HOME, itineraryView: LEGACY_HASHES[name], redirect: true };
  }
  if (Object.hasOwn(SCREENS, name)) return { screen: name, redirect: false };
  return { screen: HOME, itineraryView: "schedule", redirect: true };
}

let current = null;
let isFirstShow = true;
let itinerary = null;
const screenScrollPositions = new Map();
const itineraryScrollPositions = new Map();

export function getCurrentRoute() {
  return current;
}

export function route(focus = true) {
  const target = resolveHash(location.hash);
  const screen = target.screen;
  if (target.redirect) {
    if (target.itineraryView) itinerary.setView(target.itineraryView);
    history.replaceState(null, "", `#${HOME}`);
  }

  const changed = screen !== current;
  const firstShow = isFirstShow;
  isFirstShow = false;

  if (changed && current !== null) {
    screenScrollPositions.set(current, window.scrollY);
    if (current === HOME) {
      itineraryScrollPositions.set(itinerary.getView(), window.scrollY);
    }
  }

  current = screen;

  document.querySelectorAll("[data-screen]").forEach(section => {
    section.hidden = section.dataset.screen !== screen;
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    if (link.getAttribute("href") === `#${screen}`) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  document.title = `${SCREENS[screen]} · Trip Planner`;

  if (screen === HOME) {
    requestAnimationFrame(() => itinerary.onShow(firstShow));
  }

  if (changed) {
    const savedScroll = screen === HOME
      ? (itineraryScrollPositions.get(itinerary.getView()) ?? screenScrollPositions.get(screen))
      : screenScrollPositions.get(screen);

    if (savedScroll !== undefined) {
      window.scrollTo(0, savedScroll);
    } else {
      window.scrollTo(0, 0);
      if (firstShow && screen === HOME && itinerary.getView() === "schedule") {
        itinerary.scrollToToday();
      }
    }

    if (focus) {
      document.querySelector('.nav-link[aria-current="page"]')?.focus({ preventScroll: true });
    }
  }
}

// Call once per mounted platform; `signal` removes the listener when that platform unmounts.
export function initRouter(itineraryAdapter, { signal } = {}) {
  itinerary = itineraryAdapter;
  isFirstShow = true;
  window.addEventListener("hashchange", () => route(true), { signal });
}
