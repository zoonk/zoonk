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

export function useScrolled() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
