"use client";

import { type StoryStepContent, parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";

type MetricDelta = {
  delta: number;
  metric: string;
};

const EFFECT_DELTA_MAP = {
  negative: -15,
  neutral: 0,
  positive: 15,
} as const;

/**
 * Finds the selected choice from the story step content and computes
 * metric deltas to display as colored badges on the feedback screen.
 */
function getMetricDeltas(content: StoryStepContent, selectedChoiceId: string): MetricDelta[] {
  const choice = content.choices.find((option) => option.id === selectedChoiceId);

  if (!choice) {
    return [];
  }

  return choice.metricEffects
    .map((effect) => ({
      delta: EFFECT_DELTA_MAP[effect.effect],
      metric: effect.metric,
    }))
    .filter((entry) => entry.delta !== 0);
}

function MetricDeltaBadge({ delta, metric }: MetricDelta) {
  const isPositive = delta > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        isPositive ? "text-success" : "text-destructive",
      )}
    >
      {isPositive ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {metric} {isPositive ? `+${delta}` : delta}
    </span>
  );
}

/**
 * Story-specific feedback screen showing the consequence narrative and
 * metric deltas.
 *
 * Intentionally omits correct/incorrect framing — in stories, the
 * consequence IS the feedback. There are no "Your answer" / "Correct answer"
 * blocks, no green check or red X.
 */
export function StoryFeedbackContent({
  result,
  step,
}: {
  result: StepResult;
  step?: SerializedStep;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();

  const consequence = result.result.feedback;
  const selectedChoiceId = result.answer?.kind === "story" ? result.answer.selectedChoiceId : null;

  const metricDeltas =
    step && selectedChoiceId
      ? getMetricDeltas(parseStepContent("story", step.content), selectedChoiceId)
      : [];

  return (
    <div
      aria-live="polite"
      className="animate-in fade-in slide-in-from-bottom-1 mx-auto my-auto flex w-full max-w-lg flex-col gap-6 duration-200 ease-out motion-reduce:animate-none"
      role="status"
    >
      {consequence && (
        <p className="text-foreground text-lg leading-relaxed">{replaceName(consequence)}</p>
      )}

      {metricDeltas.length > 0 && (
        <div aria-label={t("Metric changes")} className="flex flex-wrap gap-4">
          {metricDeltas.map((entry) => (
            <MetricDeltaBadge delta={entry.delta} key={entry.metric} metric={entry.metric} />
          ))}
        </div>
      )}
    </div>
  );
}
