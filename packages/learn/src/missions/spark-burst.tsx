"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";

const BURST_MS = 750;

/** A spark's size and where it flies, in px from the burst's point. */
export type Spark = { size: number; x: number; y: number };

/** How much further the sparks drift as they fade. */
const SPARK_DRIFT = 1.25;

/** Plays a one-off animation right after the work that earned it, and never with less motion. */
export function useCelebration(play: () => void, enabled: boolean) {
  const played = useRef(false);

  useLayoutEffect(() => {
    if (!enabled || played.current || getScrollBehavior() === "auto") {
      return;
    }

    played.current = true;
    play();
  }, [enabled, play]);
}

/**
 * Violet sparks flying out of a point once (`className` places it), the moment something is earned:
 * Brain Power's color, since missions and their reward are. Decorative, and absent with less motion.
 */
export function SparkBurst({
  className,
  delay,
  sparks,
}: {
  className: string;
  delay: number;
  sparks: readonly Spark[];
}) {
  const burst = useRef<HTMLSpanElement>(null);

  useCelebration(() => {
    for (const [index, spark] of [...(burst.current?.children ?? [])].entries()) {
      const { x, y } = sparks[index] ?? { x: 0, y: 0 };

      spark.animate(
        [
          { opacity: 1, transform: "translate(0, 0) scale(0.4)" },
          { offset: 0.5, opacity: 1, transform: `translate(${x}px, ${y}px) scale(1)` },
          {
            opacity: 0,
            transform: `translate(${x * SPARK_DRIFT}px, ${y * SPARK_DRIFT}px) scale(0.5)`,
          },
        ],
        { delay, duration: BURST_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }, true);

  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute size-0", className)}
      ref={burst}
    >
      {sparks.map((spark) => (
        <svg
          className="text-brain absolute opacity-0"
          key={`${spark.x},${spark.y}`}
          style={{
            height: spark.size,
            left: -spark.size / 2,
            top: -spark.size / 2,
            width: spark.size,
          }}
          viewBox="0 0 10 10"
        >
          <path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
}
