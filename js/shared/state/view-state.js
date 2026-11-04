/* Screen View State
   Kept outside the platform UIs so the selected itinerary view and calendar position survive a desktop/mobile switch. */

import { defaultDate } from "../utils/date.js";

export const viewState = {
  itineraryView: "schedule",
  calendar: { view: "week", cursor: defaultDate() }
};
