/* Hash-based Client-side Router */

import { PAGES } from "./constants.js";
import {
  itineraryView,
  setItineraryView,
  updateItineraryLens
} from "./features/itinerary/itinerary.js";
import { scrollAgendaToToday } from "./features/itinerary/itinerary-agenda.js";

let current = null;
const pageScrollPositions = new Map();
const itineraryScrollPositions = new Map();

export function getCurrentRoute() {
  return current;
}

export function route(focus = true) {
  let page = location.hash.slice(1);
  if (page === "agenda" || page === "trip") {
    setItineraryView(page === "trip" ? "week" : "schedule", () => "itinerary");
    page = "itinerary";
    history.replaceState(null, "", "#itinerary");
  } else if (!PAGES[page]) {
    page = "itinerary";
    setItineraryView("schedule", () => "itinerary");
    history.replaceState(null, "", "#itinerary");
  }

  const changed = page !== current;
  const firstRoute = current === null;

  if (changed && current !== null) {
    pageScrollPositions.set(current, window.scrollY);
    if (current === "itinerary") {
      itineraryScrollPositions.set(itineraryView, window.scrollY);
    }
  }

  current = page;

  document.querySelectorAll("[data-page]").forEach(sec => {
    sec.hidden = sec.dataset.page !== page;
  });

  document.querySelectorAll(".nav-link").forEach(a => {
    if (a.getAttribute("href") === `#${page}`) {
      a.setAttribute("aria-current", "page");
    } else {
      a.removeAttribute("aria-current");
    }
  });

  document.title = `${PAGES[page]} · Argentina trip`;

  if (page === "itinerary") {
    requestAnimationFrame(() => updateItineraryLens(firstRoute));
  }

  if (changed) {
    const savedScroll = page === "itinerary"
      ? (itineraryScrollPositions.get(itineraryView) ?? pageScrollPositions.get(page))
      : pageScrollPositions.get(page);

    if (savedScroll !== undefined) {
      window.scrollTo(0, savedScroll);
    } else {
      window.scrollTo(0, 0);
      if (firstRoute && page === "itinerary" && itineraryView === "schedule") {
        scrollAgendaToToday();
      }
    }

    if (focus) {
      document.querySelector('.nav-link[aria-current="page"]')?.focus({ preventScroll: true });
    }
  }
}

export function initRouter() {
  window.addEventListener("hashchange", () => route(true));
}

