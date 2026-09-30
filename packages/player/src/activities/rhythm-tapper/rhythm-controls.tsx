"use client";

import { Button } from "@zoonk/ui/components/button";
import { Headphones, RotateCcw, Timer } from "lucide-react";
import { useExtracted } from "next-intl";

/** The tempo and, while tapping, which round is playing. */
export function RhythmStatus({
  round,
  rounds,
  tempo,
}: {
  round: number | null;
  rounds: number;
  tempo: number;
}) {
  const t = useExtracted();

  return (
    <p aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
      {round
        ? t("{tempo} bpm · Round {round} of {rounds}", {
            round: String(round),
            rounds: String(rounds),
            tempo: String(tempo),
          })
        : t("{tempo} bpm · {rounds, plural, one {# round} other {# rounds}}", {
            rounds,
            tempo: String(tempo),
          })}
    </p>
  );
}

/**
 * Listen to the rhythm first, then start (or try again) with a bar counted in. The sound check
 * can be redone anytime, for new headphones.
 */
export function RhythmControls({
  hasTried,
  onCalibrate,
  onListen,
  onStart,
}: {
  hasTried: boolean;
  onCalibrate: () => void;
  onListen: () => void;
  onStart: () => void;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onListen} size="lg" type="button" variant="outline">
          <Headphones aria-hidden="true" data-icon="inline-start" />
          {t("Listen first")}
        </Button>

        <Button onClick={onStart} size="lg" type="button">
          {hasTried && <RotateCcw aria-hidden="true" data-icon="inline-start" />}
          {hasTried ? t("Try again") : t("Start tapping")}
        </Button>
      </div>

      <Button onClick={onCalibrate} size="sm" type="button" variant="ghost">
        <Timer aria-hidden="true" data-icon="inline-start" />
        {t("Check the sound delay again")}
      </Button>
    </div>
  );
}
