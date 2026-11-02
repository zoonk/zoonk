"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { Meter, MeterFill } from "../../_components/meter";
import { formatClock } from "../../_utils/clock";
import { useTimeLeft } from "../../_utils/use-time-left";
import { WARNING_SECONDS, getAnnouncedSeconds } from "./countdown-announcement";

const TICK_MS = 250;
const MS_PER_SECOND = 1000;

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

/** Key it by the question, so each one gets the whole time. */
export function DrillCountdown({ onTimeUp, seconds }: { onTimeUp: () => void; seconds: number }) {
  const t = useExtracted();
  const deadline = useMountTime().getTime() + seconds * MS_PER_SECOND;
  const remaining = useTimeLeft({ deadline, onTimeUp, tickMs: TICK_MS });
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
