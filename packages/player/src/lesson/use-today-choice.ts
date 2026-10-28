"use client";

import { useCallback, useSyncExternalStore } from "react";
import { keep, readKept, subscribeToKept } from "../_utils/kept-on-device";

export const CANT_TALK_TODAY = "zoonk:cant-talk-on";

export const CANT_WRITE_TODAY = "zoonk:cant-write-on";

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function isChosenToday(key: string): boolean {
  return readKept(key) === getToday();
}

export function setChosenToday(key: string, chosen: boolean): void {
  keep(key, chosen ? getToday() : null);
}

export function useTodayChoice(key: string) {
  const chosen = useSyncExternalStore(
    subscribeToKept,
    () => isChosenToday(key),
    () => false,
  );

  const setChosen = useCallback((value: boolean) => setChosenToday(key, value), [key]);

  return [chosen, setChosen] as const;
}
