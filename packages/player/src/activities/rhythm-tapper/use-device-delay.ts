"use client";

import { useCallback, useSyncExternalStore } from "react";
import { keep, readKept, subscribeToKept } from "../../_utils/kept-on-device";

const STORAGE_KEY = "zoonk:rhythm-device-delay";
const SKIPPED = "skipped";

type DeviceDelay = { delayMs: number; status: "set" } | { status: "skipped" } | { status: "unset" };

function toDeviceDelay(stored: string | null): DeviceDelay {
  if (stored === SKIPPED) {
    return { status: "skipped" };
  }

  const delayMs = stored === null ? Number.NaN : Number(stored);
  return Number.isFinite(delayMs) ? { delayMs, status: "set" } : { status: "unset" };
}

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
