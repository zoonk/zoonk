"use client";

import { useSyncExternalStore } from "react";

type Stored = ReadonlyMap<string, boolean>;

const NONE: Stored = new Map();

let stored: Stored = NONE;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The server stored `saved` for `key`: every page in this tab shows it from now on. */
export function storeSave(key: string, saved: boolean) {
  stored = new Map(stored).set(key, saved);
  listeners.forEach((notify) => notify());
}

/**
 * What the server stored for each save made in this tab, wherever it was made: newer than a copy
 * of a page the router kept from before it. Signing out reloads the page, which forgets it.
 */
export function useStoredSaves(): Stored {
  return useSyncExternalStore(
    subscribe,
    () => stored,
    () => NONE,
  );
}
