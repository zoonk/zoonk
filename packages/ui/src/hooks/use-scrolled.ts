import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  globalThis.addEventListener("scroll", callback, { passive: true });
  return () => globalThis.removeEventListener("scroll", callback);
}

function getSnapshot() {
  return globalThis.scrollY > 0;
}

function getServerSnapshot() {
  return false;
}

/** Whether the page has scrolled at all, which draws a sticky bar's bottom edge. */
export function useScrolled() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
