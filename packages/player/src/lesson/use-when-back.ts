"use client";

import { useEffect, useEffectEvent } from "react";

/** When the connection returns or the tab shows again: the moments a failed save may get through. */
export function useWhenBack(onBack: () => void) {
  const back = useEffectEvent(onBack);

  useEffect(() => {
    const backWhenVisible = () => {
      if (document.visibilityState === "visible") {
        back();
      }
    };

    globalThis.addEventListener("online", backWhenVisible);
    document.addEventListener("visibilitychange", backWhenVisible);

    return () => {
      globalThis.removeEventListener("online", backWhenVisible);
      document.removeEventListener("visibilitychange", backWhenVisible);
    };
  }, []);
}
