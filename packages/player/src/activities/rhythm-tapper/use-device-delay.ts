"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "zoonk:rhythm-device-delay";
const SKIPPED = "skipped";
const listeners = new Set<() => void>();

/** Where the reading lives when the browser blocks storage: until the page reloads. */
const memory = { value: null as string | null };

/**
 * The device's sound delay: measured once (`set`), skipped by the learner for this device
 * (`skipped`), or not asked yet (`unset`).
 */
type DeviceDelay = { delayMs: number; status: "set" } | { status: "skipped" } | { status: "unset" };

function readStored(): string | null {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory.value;
  }
}

function writeStored(value: string | null): void {
  memory.value = value;

  try {
    if (value === null) {
      globalThis.localStorage.removeItem(STORAGE_KEY);
    } else {
      globalThis.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Blocked storage keeps the reading in memory instead.
  }

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toDeviceDelay(stored: string | null): DeviceDelay {
  if (stored === SKIPPED) {
    return { status: "skipped" };
  }

  const delayMs = stored === null ? Number.NaN : Number(stored);
  return Number.isFinite(delayMs) ? { delayMs, status: "set" } : { status: "unset" };
}

/**
 * The sound delay of this device for rhythm activities, kept on the device: headphones and
 * speakers differ, so each device measures its own once. The learner can skip it or measure
 * again anytime.
 */
export function useDeviceDelay() {
  const stored = useSyncExternalStore(subscribe, readStored, () => null);

  const save = useCallback((delayMs: number) => writeStored(String(delayMs)), []);
  const skip = useCallback(() => writeStored(SKIPPED), []);
  const clear = useCallback(() => writeStored(null), []);

  return { clear, delay: toDeviceDelay(stored), save, skip };
}
