"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type StoryStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { type StepResult } from "../player-reducer";
import { EFFECT_DELTA_MAP } from "../story";
import { useReplaceName } from "../user-name-context";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";
import { PlayerReadSceneDivider, PlayerReadSceneMetaLabel } from "./player-read-scene";
import { StatusPill, StatusPillLabel, StatusPillValue } from "./status-pill";
import { StepImageView } from "./step-image";

type StoryChoice = StoryStepContent["choices"][number];

type MetricDelta = {
  delta: number;
  metric: string;
};

/**
 * Finds the selected choice by id because story choices are shuffled before
 * they reach the player. The rendered option index is only presentation state.
 */
function getSelectedChoice({
  content,
  selectedChoiceId,
}: {
  content: StoryStepContent;
  selectedChoiceId: string;
}) {
  return content.choices.find((choice) => choice.id === selectedChoiceId) ?? null;
}

/**
 * Computes the visible metric deltas for the selected story consequence.
 */
function getMetricDeltas(choice: StoryChoice): MetricDelta[] {
  return choice.metricEffects
    .map((effect) => ({
      delta: EFFECT_DELTA_MAP[effect.effect],
      metric: effect.metric,
    }))
    .filter((entry) => entry.delta !== 0);
}

/**
 * Renders one metric impact using the shared compact status pill contract.
 */
function MetricDeltaPill({ delta, metric }: MetricDelta) {
  const isPositive = delta > 0;

  return (
    <StatusPill animationKey={`${metric}-${delta}`}>
      <StatusPillLabel>{metric}</StatusPillLabel>
      <StatusPillValue className={isPositive ? "text-success" : "text-destructive"}>
        {isPositive ? `+${delta}` : delta}
      </StatusPillValue>
    </StatusPill>
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
  const metricChangesLabel = t("Metric changes");
  const storyContent = step ? parseStepContent("story", step.content) : null;
  const answer = result.answer?.kind === "story" ? result.answer : null;
  const selectedChoice =
    storyContent && answer
      ? getSelectedChoice({ content: storyContent, selectedChoiceId: answer.selectedChoiceId })
      : null;

  if (!answer || !selectedChoice) {
    return null;
  }

  const metricDeltas = getMetricDeltas(selectedChoice);
  const consequence = result.result.feedback;

  return (
    <PlayerFeedbackScene>
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-3xl">
        <StepImageView image={selectedChoice.stateImage} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-foreground text-sm font-medium sm:text-base">
            {replaceName(answer.selectedText)}
          </p>
        </div>

        {consequence && (
          <PlayerFeedbackSceneMessage>{replaceName(consequence)}</PlayerFeedbackSceneMessage>
        )}
      </div>

      {metricDeltas.length > 0 && (
        <div className="flex flex-col gap-3">
          <PlayerReadSceneDivider />

          <div className="flex flex-col gap-3">
            <PlayerReadSceneMetaLabel>{t("Impact")}</PlayerReadSceneMetaLabel>

            <div aria-label={metricChangesLabel} className="flex flex-wrap gap-2">
              {metricDeltas.map((entry) => (
                <MetricDeltaPill delta={entry.delta} key={entry.metric} metric={entry.metric} />
              ))}
            </div>
          </div>
        </div>
      )}
    </PlayerFeedbackScene>
  );
}
