"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

const asks = { count: 0, listeners: new Set<() => void>() };

function changeAsks(change: 1 | -1) {
  asks.count += change;
  asks.listeners.forEach((listener) => listener());
}

function subscribeToAsks(listener: () => void): () => void {
  asks.listeners.add(listener);
  return () => asks.listeners.delete(listener);
}

/**
 * Drawn where a page asks for an account in its own words (a gate, Reminders' email row), so the
 * frame doesn't ask again. The router keeps a visited page mounted but hidden, which runs its
 * effects' cleanups, so only the page on screen counts.
 */
export function AccountAskMark() {
  useLayoutEffect(() => {
    changeAsks(1);
    return () => changeAsks(-1);
  }, []);

  return null;
}

/** Whether the page on screen asks for an account itself; false until it has hydrated. */
export function usePageAsksForAccount(): boolean {
  return useSyncExternalStore(
    subscribeToAsks,
    () => asks.count > 0,
    () => false,
  );
}
