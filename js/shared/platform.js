/* Platform Selection
   The planner ships two independent UIs. This breakpoint must match the `media` queries on the stylesheet links in index.html. */

export const MOBILE_MAX_WIDTH = 760;
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export const platformFor = isMobile => (isMobile ? "mobile" : "desktop");

export const currentPlatform = () => platformFor(matchMedia(MOBILE_QUERY).matches);

export function watchPlatform(onChange) {
  matchMedia(MOBILE_QUERY).addEventListener("change", () => onChange(currentPlatform()));
}
