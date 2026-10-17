"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useEffect, useEffectEvent } from "react";

/**
 * Reads once when the screen opens, so a step comes back to where the learner was after a
 * refresh. Only reads: nothing starts on its own. `onRead` gets null when the read failed.
 */
export function useReadOnOpen<T>({
  onRead,
  read,
}: {
  onRead: (data: T | null) => void;
  read: () => Promise<T>;
}) {
  const readOnce = useEffectEvent(async () => {
    const { data } = await safeAsync(read);
    onRead(data);
  });

  useEffect(() => {
    void readOnce();
  }, []);
}
