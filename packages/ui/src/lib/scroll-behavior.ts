/** Smooth scrolling, or an instant jump to the same place when the device asks for less motion. */
export function getScrollBehavior(): ScrollBehavior {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
