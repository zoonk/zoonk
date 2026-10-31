"use client";

import { useEffect, useRef, useState } from "react";
import { type ExplainingStep, getStrugglePauseMs } from "../_utils/lesson-struggle";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "scroll", "touchstart", "wheel"] as const;

export function useStrugglePause(step: ExplainingStep): boolean {
  const [isStuck, setIsStuck] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delay = getStrugglePauseMs(step);

  useEffect(() => {
    if (delay === null || isStuck) {
      return;
    }

    const restart = () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current =
        document.visibilityState === "visible" ? setTimeout(() => setIsStuck(true), delay) : null;
    };

    restart();

    for (const name of ACTIVITY_EVENTS) {
      globalThis.addEventListener(name, restart, { capture: true, passive: true });
    }

    document.addEventListener("visibilitychange", restart);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      for (const name of ACTIVITY_EVENTS) {
        globalThis.removeEventListener(name, restart, { capture: true });
      }

      document.removeEventListener("visibilitychange", restart);
    };
  }, [delay, isStuck]);

  return isStuck;
}
