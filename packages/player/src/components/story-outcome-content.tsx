"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";
import { findSelectedChoice, getStoryMetrics } from "../player-selectors";
import { type SerializedStep } from "../prepare-activity-data";
import { StoryMetricPill } from "./story-metric-pill";

type StoryOutcome = {
  minStrongChoices: number;
  narrative: string;
  title: string;
};

/**
 * A ranked outcome includes its position in the sorted list so we can
 * determine the tier color without re-sorting.
 */
type RankedOutcome = {
  index: number;
  outcome: StoryOutcome;
  total: number;
};

/**
 * Checks whether a story step result has a "strong" alignment choice.
 */
function isStrongChoice({
  results,
  step,
}: {
  results: Record<string, { answer?: { kind: string; selectedChoiceId?: string } }>;
  step: SerializedStep;
}): boolean {
  const choice = findSelectedChoice({ results, step });
  return choice?.alignment === "strong";
}

/**
 * Counts how many "strong" alignment choices the player made across all
 * story decision steps.
 */
function countStrongChoices({
  results,
  steps,
}: {
  results: Record<string, { answer?: { kind: string; selectedChoiceId?: string } }>;
  steps: SerializedStep[];
}): number {
  return steps.filter((step) => isStrongChoice({ results, step })).length;
}

/**
 * Sorts outcomes by minStrongChoices descending (best first, worst last)
 * and selects the first one where the player's count meets or exceeds
 * the threshold. Falls back to the last outcome if none match.
 *
 * Returns the matched outcome along with its tier index and total count
 * so the caller can determine the color without re-sorting.
 */
function selectOutcome({
  outcomes,
  strongCount,
}: {
  outcomes: StoryOutcome[];
  strongCount: number;
}): RankedOutcome | null {
  const sorted = [...outcomes].toSorted(
    (left, right) => right.minStrongChoices - left.minStrongChoices,
  );

  const index = sorted.findIndex((entry) => strongCount >= entry.minStrongChoices);
  const resolvedIndex = index === -1 ? sorted.length - 1 : index;
  const outcome = sorted[resolvedIndex];

  if (!outcome) {
    return null;
  }

  return { index: resolvedIndex, outcome, total: sorted.length };
}

/**
 * Returns the color class for the outcome title based on its position
 * in the ranked list.
 *
 * First (best) = green, last (worst) = destructive, middle = warning.
 */
function getOutcomeTierColor({ index, total }: RankedOutcome): string {
  if (index === 0) {
    return "text-success";
  }

  if (index === total - 1) {
    return "text-destructive";
  }

  return "text-warning";
}

/**
 * Outcome screen shown after the final decision step's consequence.
 *
 * Displays the narrative result of the player's decisions with a
 * color-coded title reflecting how well they did.
 */
export function StoryOutcomeContent({ outcomes }: { outcomes: StoryOutcome[] }) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();
  const strongCount = countStrongChoices(state);
  const ranked = selectOutcome({ outcomes, strongCount });
  const storyMetrics = getStoryMetrics(state);

  if (!ranked) {
    return null;
  }

  const titleColor = getOutcomeTierColor(ranked);

  return (
    <div className="flex flex-col gap-6">
      <h2 className={cn("text-2xl font-semibold tracking-tight", titleColor)}>
        {ranked.outcome.title}
      </h2>

      <p className="text-lg leading-relaxed">{ranked.outcome.narrative}</p>

      {storyMetrics.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="bg-border h-px" />

          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {t("Final status")}
          </p>

          <div className="-ml-1 flex flex-wrap gap-2">
            {storyMetrics.map((entry) => (
              <StoryMetricPill key={entry.metric} metric={entry.metric} value={entry.value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
