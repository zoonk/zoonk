"use client";

import { useSyncExternalStore } from "react";

const SIDE_COLUMN_QUERY = "(min-width: 80rem)";

function subscribe(callback: () => void) {
  const query = globalThis.matchMedia(SIDE_COLUMN_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Whether a detail has room beside its list; false on the server, which draws the list alone. */
export function useSideColumn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      globalThis.matchMedia(SIDE_COLUMN_QUERY).matches &&
      Object.hasOwn(document.documentElement.dataset, "signedIn"),
    () => false,
  );
}
