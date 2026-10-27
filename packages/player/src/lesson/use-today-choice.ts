"use client";

import { useCallback, useSyncExternalStore } from "react";
import { keep, readKept, subscribeToKept } from "../_utils/kept-on-device";

/** "I can't talk now": speaking screens play as listening, or as typing without a listening one. */
export const CANT_TALK_TODAY = "zoonk:cant-talk-on";

/** "Can't write now": lessons leave their writing out. */
export const CANT_WRITE_TODAY = "zoonk:cant-write-on";

/** The learner's day on this device, which a choice lasts: it's gone tomorrow. */
function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** Whether the learner made this choice today, on this device. */
export function isChosenToday(key: string): boolean {
  return readKept(key) === getToday();
}

/** Makes or takes back a choice for the rest of today. */
export function setChosenToday(key: string, chosen: boolean): void {
  keep(key, chosen ? getToday() : null);
}

/**
 * A "can't do it now" choice ("I can't talk now", "Can't write now"), remembered for the rest of
 * the learner's day on this device, across lessons and visits, until they take it back. The next
 * day starts without it.
 */
export function useTodayChoice(key: string) {
  const chosen = useSyncExternalStore(
    subscribeToKept,
    () => isChosenToday(key),
    () => false,
  );

  const setChosen = useCallback((value: boolean) => setChosenToday(key, value), [key]);

  return [chosen, setChosen] as const;
}
