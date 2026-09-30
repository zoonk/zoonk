"use client";

import { useEffect, useEffectEvent } from "react";

/** Space taps from anywhere on the page while the rhythm plays, not only on the pad. */
export function useSpaceToTap({
  enabled,
  onTap,
}: {
  enabled: boolean;
  onTap: (timeMs: number) => void;
}) {
  const tap = useEffectEvent(onTap);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== " " || event.repeat) {
        return;
      }

      event.preventDefault();
      tap(event.timeStamp);
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
