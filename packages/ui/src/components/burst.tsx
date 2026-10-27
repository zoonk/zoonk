"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";

/** A spark's size and where it flies, in px from the burst's point. */
export type Spark = { size: number; x: number; y: number };

/** Eight sparks around the point, near and far in turn, a little lopsided as a real burst is. */
const SPARKS: readonly Spark[] = [
  { size: 9, x: -38, y: -14 },
  { size: 7, x: -18, y: -32 },
  { size: 10, x: 8, y: -36 },
  { size: 7, x: 32, y: -24 },
  { size: 9, x: 44, y: 2 },
  { size: 6, x: 30, y: 24 },
  { size: 8, x: -6, y: 30 },
  { size: 6, x: -34, y: 18 },
];

/**
 * The rarest moments' burst: a few sparks fly out of one point once and fade (`animate-spark`, in
 * the burst's time), in the text color, which is the moment's own (`text-brain` for Brain Power).
 * `className` places the point inside a positioned parent; `delay` puts it on the moment's last
 * beat. Decorative: only when the celebration plays (`useCelebration`), and gone with reduced
 * motion.
 *
 * ```tsx
 * <Burst className="text-brain top-4 left-8" delay={600} />
 * ```
 */
export function Burst({
  className,
  delay = 0,
  sparks = SPARKS,
}: {
  className?: string;
  /** Milliseconds before the sparks fly. */
  delay?: number;
  sparks?: readonly Spark[];
}) {
  const plays = useCelebration();

  if (!plays) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute size-0", className)}
      data-slot="burst"
    >
      {sparks.map((spark) => {
        const style: CSSPropertiesWithVariables = {
          "--spark-x": `${spark.x}px`,
          "--spark-y": `${spark.y}px`,
          animationDelay: `${delay}ms`,
          height: spark.size,
          left: -spark.size / 2,
          top: -spark.size / 2,
          width: spark.size,
        };

        return (
          <svg
            className="animate-spark absolute opacity-0"
            key={`${spark.x},${spark.y}`}
            style={style}
            viewBox="0 0 10 10"
          >
            <path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z" fill="currentColor" />
          </svg>
        );
      })}
    </span>
  );
}
