"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Meter, MeterFill } from "../../_components/meter";
import { formatClock } from "../../_utils/clock";
import { WARNING_SECONDS, getAnnouncedSeconds } from "./countdown-announcement";

const TICK_MS = 250;
const MS_PER_SECOND = 1000;

/** Time left since the question showed. When it reaches zero, `onTimeUp` runs once. */
function useCountdown({ onTimeUp, seconds }: { onTimeUp: () => void; seconds: number }) {
  const [clock, setClock] = useState(() => {
    const shownAt = Date.now();
    return { now: shownAt, shownAt };
  });

  const remaining = Math.max(0, seconds * MS_PER_SECOND - (clock.now - clock.shownAt));
  const timeUp = useEffectEvent(onTimeUp);
  const called = useRef(false);

  useEffect(() => {
    const timer = setInterval(
      () => setClock((current) => ({ ...current, now: Date.now() })),
      TICK_MS,
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !called.current) {
      called.current = true;
      timeUp();
    }
  }, [remaining]);

  return remaining;
}

/** What screen readers hear: the seconds left at a few marks (see `getAnnouncedSeconds`), then "Time's up". */
function useCountdownAnnouncement(secondsLeft: number): string {
  const t = useExtracted();
  const [announced, setAnnounced] = useState<number | null>(null);
  const next = getAnnouncedSeconds({ announced, secondsLeft });

  if (next !== announced) {
    setAnnounced(next);
  }

  if (secondsLeft === 0) {
    return t("Time's up");
  }

  return next === null
    ? ""
    : t("{seconds, plural, one {# second left} other {# seconds left}}", { seconds: next });
}

/**
 * A timed drill's clock for one question: the seconds left and a bar that empties. Key it by the
 * question, so each one gets the whole time. With reduced motion the bar steps instead of sliding.
 */
export function DrillCountdown({ onTimeUp, seconds }: { onTimeUp: () => void; seconds: number }) {
  const t = useExtracted();
  const remaining = useCountdown({ onTimeUp, seconds });
  const secondsLeft = Math.ceil(remaining / MS_PER_SECOND);
  const warning = secondsLeft <= WARNING_SECONDS;
  const announcement = useCountdownAnnouncement(secondsLeft);

  return (
    <div className="flex items-center gap-3">
      <TimerIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0", warning ? "text-warning" : "text-muted-foreground")}
      />

      <Meter className="flex-1">
        <MeterFill
          className={cn(
            "motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-linear",
            warning && "bg-warning",
          )}
          share={remaining / (seconds * MS_PER_SECOND)}
        />
      </Meter>

      <span
        aria-label={t("Time left")}
        className={cn(
          "min-w-10 text-right font-mono text-sm font-medium tabular-nums",
          warning && "text-warning-text",
        )}
        role="timer"
      >
        {formatClock(remaining)}
      </span>

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
