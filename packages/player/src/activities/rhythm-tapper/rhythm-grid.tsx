"use client";

import { rhythmHitSteps } from "@zoonk/core/library/activities/music";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type HitResult } from "./rhythm-results";
import { type RunPosition } from "./use-rhythm-run";

const DOT_CLASSES: Record<HitResult["status"], string> = {
  early: "bg-warning",
  late: "bg-warning",
  missed: "border-destructive border-2 bg-transparent",
  onTime: "bg-success",
};

function steps(pattern: string): { index: number; isHit: boolean }[] {
  return Array.from(pattern, (symbol, index) => ({ index, isHit: symbol === "x" }));
}

/** One round of the rhythm: a cell per step, beats spaced apart, dots for how each tap went. */
function RoundRow({
  pattern,
  playingStep,
  results,
  stepsPerBeat,
}: {
  pattern: string;
  playingStep: number | null;
  results: readonly HitResult[] | null;
  stepsPerBeat: number;
}) {
  const hitIndexes = steps(pattern)
    .filter((step) => step.isHit)
    .map((step) => step.index);

  return (
    <div className="flex items-end gap-0.5">
      {steps(pattern).map((step) => {
        const result = step.isHit ? results?.[hitIndexes.indexOf(step.index)] : undefined;

        return (
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1",
              step.index > 0 && step.index % stepsPerBeat === 0 && "ml-1.5",
            )}
            key={step.index}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                result ? DOT_CLASSES[result.status] : "bg-transparent",
              )}
            />
            <span
              className={cn(
                "h-8 w-full rounded-md motion-safe:transition-shadow",
                step.isHit ? "bg-viz-highlight" : "bg-background",
                playingStep === step.index && "ring-foreground ring-2",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The rhythm on its beat grid, one row per round: hits in color, rests blank, the playhead
 * outlined, and after tapping a dot over each hit (on time, early or late, or missed).
 */
export function RhythmGrid({
  pattern,
  position,
  results,
  rounds,
  stepsPerBeat,
}: {
  pattern: string;
  position: RunPosition | null;
  results: readonly HitResult[] | null;
  rounds: number;
  stepsPerBeat: number;
}) {
  const t = useExtracted();
  const hitsPerRound = rhythmHitSteps(pattern).length;
  const beats = pattern.length / stepsPerBeat;

  return (
    <div aria-hidden="true" className="flex flex-col gap-2" data-slot="rhythm-grid">
      {Array.from({ length: rounds }, (_, round) => (
        <RoundRow
          key={round}
          pattern={pattern}
          playingStep={position?.round === round ? position.step : null}
          results={results?.slice(round * hitsPerRound, (round + 1) * hitsPerRound) ?? null}
          stepsPerBeat={stepsPerBeat}
        />
      ))}

      <div className="flex gap-0.5">
        {Array.from({ length: beats }, (_, beat) => (
          <span
            className={cn(
              "text-muted-foreground flex-1 text-xs tabular-nums",
              beat > 0 && "ml-1.5",
            )}
            key={beat}
          >
            {beat + 1}
          </span>
        ))}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-viz-highlight size-2.5 rounded-full" />
          {t("Rhythm hits")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-success size-2.5 rounded-full" />
          {t("On time")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-warning size-2.5 rounded-full" />
          {t("Early or late")}
        </span>
      </div>
    </div>
  );
}
