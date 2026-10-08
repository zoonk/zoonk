import { cn } from "@zoonk/ui/lib/utils";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A share drawn as a ring: the visual anchor beside a big number (a goal's preparation). It sits
 * next to that number, so it's hidden from screen readers; put an icon or a short value inside it
 * as `children`. The fill grows in once, and stays still with reduced motion.
 */
export function ProgressRing({
  children,
  className,
  share,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Between 0 and 1. */
  share: number;
}) {
  const offset = (1 - Math.min(1, Math.max(0, share))) * CIRCUMFERENCE;

  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex size-20 shrink-0 items-center justify-center", className)}
      data-slot="progress-ring"
    >
      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
        <circle
          className="stroke-foreground/10"
          cx="50"
          cy="50"
          fill="none"
          r={RADIUS}
          strokeWidth="9"
        />
        <circle
          className="stroke-success motion-safe:animate-ring-fill [--ring-length:264]"
          cx="50"
          cy="50"
          fill="none"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="9"
        />
      </svg>
      {children}
    </span>
  );
}
