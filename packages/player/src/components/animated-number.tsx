"use client";

import { useEffect, useRef, useState } from "react";

const EASE_OUT_CUBIC_EXPONENT = 3;
const ANIMATION_DURATION_MS = 300;

export function AnimatedNumber({
  className,
  delay = 0,
  from,
  to,
}: {
  className?: string;
  delay?: number;
  from: number;
  to: number;
}) {
  const [display, setDisplay] = useState(from);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const diff = to - from;

    if (diff === 0) {
      setDisplay(to);
      return;
    }

    timerRef.current = setTimeout(() => {
      const start = performance.now();

      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
        const eased = 1 - (1 - progress) ** EASE_OUT_CUBIC_EXPONENT;

        setDisplay(Math.round(from + diff * eased));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      cancelAnimationFrame(rafRef.current);
    };
  }, [delay, from, to]);

  return <span className={className}>{display}</span>;
}
