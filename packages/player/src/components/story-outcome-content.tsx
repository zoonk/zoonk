"use client";

import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";
import { getStoryMetrics } from "../player-selectors";
import { type SerializedStep } from "../prepare-activity-data";
import { StoryMetricPill } from "./story-metric-pill";

type StoryOutcome = {
  minStrongChoices: number;
  narrative: string;
  title: string;
};

/**
 * Checks whether a story step result has a "strong" alignment choice.
 */
function isStrongChoice(
  step: SerializedStep,
  results: Record<string, { answer?: { kind: string; selectedChoiceId?: string } }>,
): boolean {
  const result = results[step.id];

  if (!result?.answer || result.answer.kind !== "story" || !result.answer.selectedChoiceId) {
    return false;
  }

  const content = parseStepContent("story", step.content);
  const choice = content.choices.find((option) => option.id === result.answer?.selectedChoiceId);

  return choice?.alignment === "strong";
}

/**
 * Counts how many "strong" alignment choices the player made across all
 * story decision steps.
 */
function countStrongChoices(state: {
  results: Record<string, { answer?: { kind: string; selectedChoiceId?: string } }>;
  steps: SerializedStep[];
}): number {
  return state.steps
    .filter((step) => step.kind === "story")
    .filter((step) => isStrongChoice(step, state.results)).length;
}

/**
 * Selects the best-matching outcome based on the player's strong choice count.
 *
 * Sorts outcomes by minStrongChoices descending and picks the first one
 * where the player's count meets or exceeds the threshold. Falls back to
 * the last outcome (lowest threshold) if none match.
 */
function selectOutcome(outcomes: StoryOutcome[], strongCount: number): StoryOutcome | undefined {
  const sorted = [...outcomes].toSorted(
    (left, right) => right.minStrongChoices - left.minStrongChoices,
  );

  return sorted.find((outcome) => strongCount >= outcome.minStrongChoices) ?? sorted.at(-1);
}

/**
 * Returns the color class for the outcome title based on its tier.
 *
 * The best outcome (highest threshold) is green, the worst (lowest) is
 * destructive, and everything in between is warning.
 */
function getOutcomeTierColor(outcome: StoryOutcome, allOutcomes: StoryOutcome[]): string {
  const sorted = [...allOutcomes].toSorted(
    (left, right) => right.minStrongChoices - left.minStrongChoices,
  );
  const index = sorted.indexOf(outcome);

  if (index === 0) {
    return "text-success";
  }

  if (index === sorted.length - 1) {
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
export function StoryOutcomeContent({ outcomes }: { metrics: string[]; outcomes: StoryOutcome[] }) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();
  const strongCount = countStrongChoices(state);
  const outcome = selectOutcome(outcomes, strongCount);
  const storyMetrics = getStoryMetrics(state);

  if (!outcome) {
    return null;
  }

  const titleColor = getOutcomeTierColor(outcome, outcomes);

  return (
    <div className="flex flex-col gap-6">
      <h2 className={cn("text-2xl font-semibold tracking-tight", titleColor)}>{outcome.title}</h2>

      <p className="text-lg leading-relaxed">{outcome.narrative}</p>

      {storyMetrics.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="bg-border h-px" />

          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              {t("Final status")}
            </p>

            <div className="-ml-1 flex flex-wrap gap-2">
              {storyMetrics.map((entry) => (
                <StoryMetricPill key={entry.metric} metric={entry.metric} value={entry.value} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
