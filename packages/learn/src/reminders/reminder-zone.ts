"use client";

import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useSyncExternalStore } from "react";
import { useTimeZoneName } from "../_utils/locale";

// oxlint-disable-next-line no-empty-function -- useSyncExternalStore requires a subscribe that returns an unsubscribe
const subscribe = () => () => {};

/** Named only when it isn't the device's zone: only then does the reminder's time read on another clock. */
export function useOtherZoneName(timeZone: string): string | null {
  const name = useTimeZoneName(timeZone);
  const deviceZone = useSyncExternalStore(subscribe, getLocalTimeZone, () => timeZone);

  return deviceZone === timeZone ? null : name;
}
