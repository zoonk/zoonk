"use client";

import { useCallback, useSyncExternalStore } from "react";

/** "I can't talk now": speaking screens play as listening, or as typing without a listening one. */
export const CANT_TALK_TODAY = "zoonk:cant-talk-on";

/** "Can't write now": lessons leave their writing out. */
export const CANT_WRITE_TODAY = "zoonk:cant-write-on";

const listeners = new Set<() => void>();

/** Where choices live when the browser blocks storage: until the page reloads. */
const memory = new Map<string, string>();

/** The learner's day on this device, which a choice lasts: it's gone tomorrow. */
function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function readDay(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

/** Whether the learner made this choice today, on this device. */
export function isChosenToday(key: string): boolean {
  return readDay(key) === getToday();
}

/** Makes or takes back a choice for the rest of today. */
export function setChosenToday(key: string, chosen: boolean): void {
  const today = getToday();

  if (chosen) {
    memory.set(key, today);
  } else {
    memory.delete(key);
  }

  try {
    if (chosen) {
      globalThis.localStorage.setItem(key, today);
    } else {
      globalThis.localStorage.removeItem(key);
    }
  } catch {
    // Blocked storage keeps the choice in memory instead.
  }

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A "can't do it now" choice ("I can't talk now", "Can't write now"), remembered for the rest of
 * the learner's day on this device, across lessons and visits, until they take it back. The next
 * day starts without it.
 */
export function useTodayChoice(key: string) {
  const chosen = useSyncExternalStore(
    subscribe,
    () => isChosenToday(key),
    () => false,
  );

  const setChosen = useCallback((value: boolean) => setChosenToday(key, value), [key]);

  return [chosen, setChosen] as const;
}
