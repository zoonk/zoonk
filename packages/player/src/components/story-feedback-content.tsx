"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type StoryStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { ArrowRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";
import { type StepResult } from "../player-reducer";
import { type StoryMetric, getStoryMetrics } from "../player-selectors";
import { EFFECT_DELTA_MAP } from "../story";
import { useReplaceName } from "../user-name-context";
import { ExpandableStepImageStage } from "./expandable-step-image-stage";
import { PlayerFeedbackScene, PlayerFeedbackSceneMessage } from "./player-feedback-scene";
import { PlayerReadSceneDivider, PlayerReadSceneMetaLabel } from "./player-read-scene";
import { getStoryMetricValueClass } from "./story-metric-pill";

type StoryChoice = StoryStepContent["choices"][number];

type MetricDelta = {
  delta: number;
  metric: string;
  value: number;
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
 * Returns the immediate effect one choice had on a metric. Metrics that were
 * not touched by the selected choice still need a row in feedback so learners
 * keep the full story state in view.
 */
function getChoiceMetricDelta({ choice, metric }: { choice: StoryChoice; metric: string }) {
  const effect = choice.metricEffects.find((entry) => entry.metric === metric);
  return effect ? EFFECT_DELTA_MAP[effect.effect] : 0;
}

/**
 * Computes a full metric snapshot for feedback. Every defined story metric is
 * shown, with changed metrics first so the consequence is easy to scan before
 * the unchanged state rows.
 */
function getMetricDeltas({
  choice,
  metrics,
}: {
  choice: StoryChoice;
  metrics: StoryMetric[];
}): MetricDelta[] {
  const metricDeltas = metrics.map((entry) => ({
    delta: getChoiceMetricDelta({ choice, metric: entry.metric }),
    metric: entry.metric,
    value: entry.value,
  }));

  return [
    ...metricDeltas.filter((entry) => entry.delta !== 0),
    ...metricDeltas.filter((entry) => entry.delta === 0),
  ];
}

/**
 * Formats metric deltas once so the visual value and accessible row label stay
 * in sync. Positive effects need the plus sign because story choices can move
 * several metrics in different directions at the same time.
 */
function formatMetricDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * Gives each impact row a compact accessible summary that includes both the
 * immediate change and the resulting value when the final metric is known.
 */
function getMetricDeltaLabel({ delta, metric, value }: MetricDelta) {
  const formattedDelta = formatMetricDelta(delta);
  return `${metric} ${formattedDelta} ${value}`;
}

/**
 * Uses color only for meaningful movement. Neutral rows stay muted so the
 * unchanged metric remains visible without competing with real consequences.
 */
function getMetricDeltaClass(delta: number) {
  if (delta > 0) {
    return "text-success";
  }

  if (delta < 0) {
    return "text-destructive";
  }

  return "text-muted-foreground";
}

/**
 * Renders one consequence impact as a quiet row instead of another gameplay
 * pill. The delta answers "what did my choice do?", and the final value
 * answers "where does that leave the story now?"
 */
function MetricDeltaRow({ delta, metric, value }: MetricDelta) {
  const deltaClass = getMetricDeltaClass(delta);

  return (
    <div
      aria-label={getMetricDeltaLabel({ delta, metric, value })}
      className="flex items-center justify-between gap-4 py-1"
      role="listitem"
    >
      <span className="text-muted-foreground text-sm">{metric}</span>

      <span className="flex items-center gap-2 text-sm font-medium tabular-nums">
        <span className={deltaClass}>{formatMetricDelta(delta)}</span>

        <ArrowRightIcon aria-hidden className="text-muted-foreground size-3.5" />
        <span className={getStoryMetricValueClass(value)}>{value}</span>
      </span>
    </div>
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
  const { state } = usePlayerRuntime();
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

  const metricDeltas = getMetricDeltas({ choice: selectedChoice, metrics: getStoryMetrics(state) });
  const consequence = result.result.feedback;

  return (
    <PlayerFeedbackScene>
      <ExpandableStepImageStage
        className="aspect-square w-full rounded-3xl"
        fit="contain"
        image={selectedChoice.stateImage}
      />

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

            <div aria-label={metricChangesLabel} className="flex flex-col gap-1" role="list">
              {metricDeltas.map((entry) => (
                <MetricDeltaRow
                  delta={entry.delta}
                  key={entry.metric}
                  metric={entry.metric}
                  value={entry.value}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </PlayerFeedbackScene>
  );
}
