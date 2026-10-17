"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "zoonk:cant-talk-now";
const listeners = new Set<() => void>();

/** Where the choice lives when the browser blocks storage: until the page reloads. */
const memory = { cantTalk: false };

function read(): boolean {
  try {
    return globalThis.sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return memory.cantTalk;
  }
}

function write(value: boolean): void {
  memory.cantTalk = value;

  try {
    if (value) {
      globalThis.sessionStorage.setItem(STORAGE_KEY, "true");
    } else {
      globalThis.sessionStorage.removeItem(STORAGE_KEY);
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
 * "I can't talk now", remembered for the rest of the visit: every speaking screen after it plays
 * as listening until the learner says they can talk again. A new visit starts with speaking.
 */
export function useCantTalkNow() {
  const cantTalk = useSyncExternalStore(subscribe, read, () => false);
  const setCantTalk = useCallback((value: boolean) => write(value), []);

  return [cantTalk, setCantTalk] as const;
}
