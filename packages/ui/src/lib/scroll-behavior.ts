export function getScrollBehavior(): ScrollBehavior {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
