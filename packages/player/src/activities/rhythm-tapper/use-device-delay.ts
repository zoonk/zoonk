"use client";

import { useCallback, useSyncExternalStore } from "react";
import { keep, readKept, subscribeToKept } from "../../_utils/kept-on-device";

const STORAGE_KEY = "zoonk:rhythm-device-delay";
const SKIPPED = "skipped";

/**
 * The device's sound delay: measured once (`set`), skipped by the learner for this device
 * (`skipped`), or not asked yet (`unset`).
 */
type DeviceDelay = { delayMs: number; status: "set" } | { status: "skipped" } | { status: "unset" };

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
  const stored = useSyncExternalStore(
    subscribeToKept,
    () => readKept(STORAGE_KEY),
    () => null,
  );

  const save = useCallback((delayMs: number) => keep(STORAGE_KEY, String(delayMs)), []);
  const skip = useCallback(() => keep(STORAGE_KEY, SKIPPED), []);
  const clear = useCallback(() => keep(STORAGE_KEY, null), []);

  return { clear, delay: toDeviceDelay(stored), save, skip };
}
