import { cn } from "@zoonk/ui/lib/utils";

/** How a day's track reads: today darker, a study day missed dashed, a rest day faint. */
export type GoalRingTrack = "default" | "missed" | "rest" | "today";

const TRACK_CLASS: Readonly<Record<GoalRingTrack, string>> = {
  default: "stroke-foreground/10",
  missed: "stroke-foreground/25 [stroke-dasharray:3_3.3]",
  rest: "stroke-foreground/6",
  today: "stroke-foreground/25",
};

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A day's goal as a small activity ring, like the rings learners know from their phones: its arc
 * fills blue with how much of the day's goal was done, and a mark sits inside it (`children`: a
 * check once reached, the exam's cap, a challenge's icon). Today's week and the logbook's draw
 * their days with it (Today's at 30px, `className="size-7.5"`). Decorative: the day's words say
 * how it went.
 */
export function GoalRing({
  children,
  className,
  share,
  track = "default",
}: {
  children?: React.ReactNode;
  className?: string;
  /** Between 0 and 1. */
  share: number;
  track?: GoalRingTrack;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-9 items-center justify-center [&>svg:not(:first-child)]:size-3.5",
        className,
      )}
      data-slot="goal-ring"
    >
      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36">
        <circle
          className={TRACK_CLASS[track]}
          cx="18"
          cy="18"
          fill="none"
          r={RADIUS}
          strokeWidth="3"
        />
        {share > 0 && (
          <circle
            className="stroke-success"
            cx="18"
            cy="18"
            fill="none"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={(1 - Math.min(1, share)) * CIRCUMFERENCE}
            strokeLinecap="round"
            strokeWidth="3"
          />
        )}
      </svg>
      {children}
    </span>
  );
}
