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

type StoryOption = StoryStepContent["options"][number];

type MetricDelta = {
  delta: number;
  metric: string;
  value: number;
};

/**
 * Finds the selected option by id because story options are shuffled before
 * they reach the player. The rendered option index is only presentation state.
 */
function getSelectedOption({
  content,
  selectedOptionId,
}: {
  content: StoryStepContent;
  selectedOptionId: string;
}) {
  return content.options.find((option) => option.id === selectedOptionId) ?? null;
}

/**
 * Returns the immediate effect one option had on a metric. Metrics that were
 * not touched by the selected option still need a row in feedback so learners
 * keep the full story state in view.
 */
function getOptionMetricDelta({ metric, option }: { metric: string; option: StoryOption }) {
  const effect = option.metricEffects.find((entry) => entry.metric === metric);
  return effect ? EFFECT_DELTA_MAP[effect.effect] : 0;
}

/**
 * Computes a full metric snapshot for feedback. Every defined story metric is
 * shown, with changed metrics first so the feedback is easy to scan before
 * the unchanged state rows.
 */
function getMetricDeltas({ metrics, option }: { metrics: StoryMetric[]; option: StoryOption }) {
  const metricDeltas = metrics.map((entry) => ({
    delta: getOptionMetricDelta({ metric: entry.metric, option }),
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
 * in sync. Positive effects need the plus sign because story options can move
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
 * Renders one feedback impact as a quiet row instead of another gameplay
 * pill. The delta answers "what did my option do?", and the final value
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
 * Story-specific feedback screen showing the feedback narrative and
 * metric deltas.
 *
 * Intentionally omits correct/incorrect framing — in stories, the
 * feedback IS the result. There are no "Your answer" / "Correct answer"
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
  const selectedOption =
    storyContent && answer
      ? getSelectedOption({ content: storyContent, selectedOptionId: answer.selectedOptionId })
      : null;

  if (!answer || !selectedOption) {
    return null;
  }

  const metricDeltas = getMetricDeltas({ metrics: getStoryMetrics(state), option: selectedOption });
  const feedback = result.result.feedback;

  return (
    <PlayerFeedbackScene>
      <ExpandableStepImageStage
        className="aspect-square w-full rounded-3xl"
        fit="contain"
        image={selectedOption.stateImage}
      />

      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-foreground text-sm font-medium sm:text-base">
            {replaceName(selectedOption.text)}
          </p>
        </div>

        {feedback && (
          <PlayerFeedbackSceneMessage>{replaceName(feedback)}</PlayerFeedbackSceneMessage>
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
