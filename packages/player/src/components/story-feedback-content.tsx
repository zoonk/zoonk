"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type StoryStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { EFFECT_DELTA_MAP } from "../story";
import { useReplaceName } from "../user-name-context";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";

type MetricDelta = {
  delta: number;
  metric: string;
};

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
    <PlayerFeedbackScene>
      {consequence && (
        <PlayerFeedbackSceneMessage>{replaceName(consequence)}</PlayerFeedbackSceneMessage>
      )}

      {metricDeltas.length > 0 && (
        <div aria-label={t("Metric changes")} className="flex flex-wrap gap-4">
          {metricDeltas.map((entry) => (
            <MetricDeltaBadge delta={entry.delta} key={entry.metric} metric={entry.metric} />
          ))}
        </div>
      )}
    </PlayerFeedbackScene>
  );
}
