"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 600;
const EASE_EXPONENT = 3;

function easeOut(progress: number): number {
  return 1 - (1 - progress) ** EASE_EXPONENT;
}

export function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    let frameId: number;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      setDisplay(Math.round(easeOut(progress) * value));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [value]);

  return <span>{display}</span>;
}
