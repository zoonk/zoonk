"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { Button } from "@zoonk/ui/components/button";
import { hashSeed } from "@zoonk/utils/seeded-random";
import { RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { useReducedMotion } from "../_utils/use-reduced-motion";
import { useRevealCount } from "../_utils/use-reveal-count";
import { type ActivityRendererProps } from "../activity-renderer";
import { isHit, runSimulation } from "./simulation";
import { OutcomeHistogram, RunningShareChart } from "./simulation-charts";

type PredictSimulateProps = ActivityRendererProps<"predictSimulate">;

const PERCENT = 100;
const SMALL_PERCENT = 10;

function guessValue(
  content: PredictSimulateProps["content"],
  answer: PredictSimulateProps["answer"],
): number | null {
  const { check } = content;

  if (check.kind !== "choice" || answer?.kind !== "choice") {
    return null;
  }

  return check.options.find((option) => option.id === answer.optionId)?.value ?? null;
}

function usePercent() {
  const format = useFormatNumber();

  return (share: number) =>
    format(share * PERCENT, {
      maximumFractionDigits: share * PERCENT < SMALL_PERCENT ? 1 : 0,
      unit: "%",
    });
}

/**
 * Guess how often something random happens, then watch hundreds of runs play out next to the
 * guess. The options come first (predict, then see); the runs start once the guess is checked.
 * The first run is seeded by the lesson, so everyone sees the same one; "Run again" draws anew.
 */
export function PredictSimulateActivity({ answer, content, labelId, phase }: PredictSimulateProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const percent = usePercent();
  const reducedMotion = useReducedMotion();
  const { fields } = content;
  const [runIndex, setRunIndex] = useState(0);
  const isChecked = phase === "checked";
  const seed = hashSeed(JSON.stringify(fields)) + runIndex;

  const outcomes = useMemo(
    () => (isChecked ? runSimulation({ model: fields.model, runs: fields.runs, seed }) : []),
    [fields.model, fields.runs, isChecked, seed],
  );

  const revealed = useRevealCount({ instant: reducedMotion, runKey: seed, total: outcomes.length });
  const shown = outcomes.slice(0, revealed);
  const hits = shown.map((outcome) => isHit(fields.model, outcome));
  const share = hits.length === 0 ? 0 : hits.filter(Boolean).length / hits.length;
  const isDone = isChecked && shown.length === outcomes.length;
  const exact = computeActivityValue(content);
  const guess = guessValue(content, answer);

  const runsLabel = t("{runs} runs of {trial}", {
    runs: format(fields.runs),
    trial: fields.trialLabel,
  });

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <ActivityCanvasLabel className="text-sm">{runsLabel}</ActivityCanvasLabel>
          <ActivityCanvasLabel>{fields.hitLabel}</ActivityCanvasLabel>

          {isChecked && guess !== null && (
            <ActivityCanvasLabel className="text-foreground font-medium">
              {t("Your guess: {value}", { value: percent(guess) })}
            </ActivityCanvasLabel>
          )}
        </div>

        {isChecked && (
          <ActivityReadout aria-hidden="true" className="text-viz-accent">
            {percent(share)}
          </ActivityReadout>
        )}
      </div>

      {isChecked && fields.model.kind === "sharedBirthday" && (
        <RunningShareChart
          guess={guess}
          guessLabel={guess === null ? "" : t("Your guess: {value}", { value: percent(guess) })}
          hits={hits}
          runs={fields.runs}
        />
      )}

      {isChecked && fields.model.kind !== "sharedBirthday" && (
        <OutcomeHistogram
          allOutcomes={outcomes}
          isHit={(outcome) => isHit(fields.model, outcome)}
          shownOutcomes={shown}
        />
      )}

      {!isChecked && (
        <p className="text-muted-foreground flex min-h-32 items-center justify-center text-center text-sm">
          {t("Pick your guess, then check it to run the simulation.")}
        </p>
      )}

      {isDone && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm tabular-nums">
            {exact === null
              ? t("{hit} in {share} of the runs.", { hit: fields.hitLabel, share: percent(share) })
              : t("{hit} in {share} of the runs. The exact chance is {exact}.", {
                  exact: percent(exact),
                  hit: fields.hitLabel,
                  share: percent(share),
                })}
          </p>

          <Button onClick={() => setRunIndex(runIndex + 1)} size="lg" variant="outline">
            <RotateCcw aria-hidden="true" />
            {t("Run again")}
          </Button>
        </div>
      )}

      <ActivityTextAlternative>
        {isChecked
          ? t("{runs}: {hit} came up in {share} of them.", {
              hit: fields.hitLabel,
              runs: runsLabel,
              share: percent(share),
            })
          : runsLabel}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
