"use client";

import { useEffect, useRef, useState } from "react";

const EASE_OUT_CUBIC_EXPONENT = 3;
const ANIMATION_DURATION_MS = 300;

export function AnimatedNumber({
  className,
  from,
  to,
}: {
  className?: string;
  from: number;
  to: number;
}) {
  const [display, setDisplay] = useState(from);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = ANIMATION_DURATION_MS;
    const diff = to - from;

    if (diff === 0) {
      setDisplay(to);
      return;
    }

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** EASE_OUT_CUBIC_EXPONENT;

      setDisplay(Math.round(from + diff * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [from, to]);

  return <span className={className}>{display}</span>;
}
