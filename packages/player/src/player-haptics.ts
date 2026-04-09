import { type StoryStaticVariant, parseStepContent } from "@zoonk/core/steps/contract/content";
import { type HapticInput } from "web-haptics";
import { getInvestigationCallVerdict } from "./investigation-call-verdict";
import { type PlayerMilestone } from "./player-context";
import { type PlayerPhase, type StepResult } from "./player-reducer";
import { type StoryMetric } from "./player-selectors";
import { describePlayerStep } from "./player-step";
import { type SerializedStep } from "./prepare-activity-data";
import { METRIC_CRITICAL_THRESHOLD, METRIC_DANGER_THRESHOLD } from "./story";

type ConsequenceHaptic = "error" | "nudge" | "success";
type ThresholdHaptic = "error" | [number, number, number];

export type PlayerHapticSnapshot = {
  metrics: StoryMetric[];
  phase: PlayerPhase;
  result?: StepResult;
  step?: SerializedStep | null;
  storyStaticVariant: StoryStaticVariant | null;
};

const CRITICAL_VIBRATE_LONG = 100;
const CRITICAL_VIBRATE_SHORT = 50;

const CRITICAL_PATTERN: [number, number, number] = [
  CRITICAL_VIBRATE_SHORT,
  CRITICAL_VIBRATE_SHORT,
  CRITICAL_VIBRATE_LONG,
];

const MILESTONE_COMPLETE_PATTERN: HapticInput = [
  { duration: 30, intensity: 0.6 },
  { delay: 45, duration: 45, intensity: 0.9 },
  { delay: 70, duration: 80, intensity: 1 },
];

/** Builds a metric-name lookup so threshold checks stay linear and readable. */
function toMetricMap(metrics: StoryMetric[]): Map<string, number> {
  return new Map(metrics.map((entry) => [entry.metric, entry.value]));
}

/**
 * Maps story metric deltas to a tactile consequence signal.
 *
 * Story choices can improve, worsen, or mix outcomes across metrics. The
 * haptic should mirror that overall feeling rather than replay every metric.
 */
function getStoryConsequenceHaptic({
  currentMetrics,
  previousMetrics,
}: {
  currentMetrics: StoryMetric[];
  previousMetrics: StoryMetric[];
}): ConsequenceHaptic | null {
  if (previousMetrics.length === 0 || currentMetrics.length === 0) {
    return null;
  }

  const previousValues = toMetricMap(previousMetrics);

  const hasPositive = currentMetrics.some((current) => {
    const previousValue = previousValues.get(current.metric);
    return previousValue !== undefined && current.value > previousValue;
  });

  const hasNegative = currentMetrics.some((current) => {
    const previousValue = previousValues.get(current.metric);
    return previousValue !== undefined && current.value < previousValue;
  });

  if (!hasPositive && !hasNegative) {
    return null;
  }

  if (hasPositive && hasNegative) {
    return "nudge";
  }

  return hasPositive ? "success" : "error";
}

/**
 * Warns when a story metric crosses into a danger or critical band.
 *
 * Threshold haptics are distinct from consequence haptics: they communicate
 * state urgency, not the immediate quality of a single choice.
 */
function getStoryThresholdHaptic({
  currentMetrics,
  previousMetrics,
}: {
  currentMetrics: StoryMetric[];
  previousMetrics: StoryMetric[];
}): ThresholdHaptic | null {
  const previousValues = toMetricMap(previousMetrics);

  const crossedCritical = currentMetrics.some((current) => {
    const previousValue = previousValues.get(current.metric);
    return (
      previousValue !== undefined &&
      current.value < METRIC_CRITICAL_THRESHOLD &&
      previousValue >= METRIC_CRITICAL_THRESHOLD
    );
  });

  if (crossedCritical) {
    return CRITICAL_PATTERN;
  }

  const crossedDanger = currentMetrics.some((current) => {
    const previousValue = previousValues.get(current.metric);
    return (
      previousValue !== undefined &&
      current.value < METRIC_DANGER_THRESHOLD &&
      previousValue >= METRIC_DANGER_THRESHOLD
    );
  });

  if (crossedDanger) {
    return "error";
  }

  return null;
}

/**
 * Returns the milestone completion haptic.
 *
 * Finishing an activity should feel affirmative, while finishing a lesson,
 * chapter, or course deserves a stronger celebratory pattern.
 */
function getCompletionHaptic({
  milestoneKind,
}: {
  milestoneKind: PlayerMilestone["kind"];
}): HapticInput {
  if (milestoneKind === "activity") {
    return "success";
  }

  return MILESTONE_COMPLETE_PATTERN;
}

/**
 * Distinguishes which investigation clues deserve tactile emphasis.
 *
 * Strong evidence should feel rewarding, weak evidence should feel cautionary,
 * and middling clues should stay quiet so the loop does not become noisy.
 */
function getInvestigationActionFeedbackHaptic({
  result,
  step,
}: {
  result: StepResult;
  step: SerializedStep;
}): HapticInput | null {
  const answer = result.answer;

  if (answer?.kind !== "investigation" || answer.variant !== "action") {
    return null;
  }

  const content = parseStepContent("investigation", step.content);

  if (content.variant !== "action") {
    return null;
  }

  const action = content.actions.find((item) => item.id === answer.selectedActionId);

  if (!action) {
    return null;
  }

  if (action.quality === "critical") {
    return "success";
  }

  if (action.quality === "weak") {
    return "warning";
  }

  return null;
}

/**
 * Maps non-story feedback reveals to a generic tactile signal.
 *
 * Most activities only need to communicate whether the revealed result felt
 * good, bad, or partially right. Story keeps its richer custom handling.
 */
function getFeedbackRevealHaptic({
  result,
  step,
}: {
  result?: StepResult;
  step?: SerializedStep | null;
}): HapticInput | null {
  if (!result || !step || result.answer?.kind === "story") {
    return null;
  }

  if (result.answer?.kind === "investigation" && result.answer.variant === "action") {
    return getInvestigationActionFeedbackHaptic({ result, step });
  }

  if (result.answer?.kind === "investigation" && result.answer.variant === "call") {
    const verdict = getInvestigationCallVerdict({ result, step });

    if (verdict === "best") {
      return "success";
    }

    if (verdict === "partial") {
      return "nudge";
    }

    return "error";
  }

  return result.result.isCorrect ? "success" : "error";
}

/**
 * Highlights the two non-result milestones inside investigation flows.
 *
 * Starting the investigation and reaching the final call are both meaningful
 * mode switches. They deserve haptics even though neither is a correctness
 * reveal on its own.
 */
function getInvestigationMilestoneHaptic({
  current,
  previous,
}: {
  current: PlayerHapticSnapshot;
  previous: PlayerHapticSnapshot;
}): HapticInput | null {
  const previousDescriptor = describePlayerStep(previous.step);
  const currentDescriptor = describePlayerStep(current.step);

  if (
    previousDescriptor?.kind === "investigationProblem" &&
    currentDescriptor?.kind === "investigationAction"
  ) {
    return "medium";
  }

  if (
    previous.phase === "feedback" &&
    current.phase === "playing" &&
    previousDescriptor?.kind === "investigationAction" &&
    currentDescriptor?.kind === "investigationCall"
  ) {
    return "nudge";
  }

  return null;
}

/**
 * Computes the ordered haptic sequence for one player state transition.
 *
 * The player has a few different tactile layers: story semantics, generic
 * feedback reveals, investigation milestones, and completion. Keeping them in
 * one decision function makes the UX additive instead of a collection of
 * component-specific guesses.
 */
export function getPlayerHapticSequence({
  current,
  milestoneKind,
  previous,
}: {
  current: PlayerHapticSnapshot;
  milestoneKind: PlayerMilestone["kind"];
  previous: PlayerHapticSnapshot;
}): HapticInput[] {
  if (previous.phase !== "completed" && current.phase === "completed") {
    return [getCompletionHaptic({ milestoneKind })];
  }

  const sequence: HapticInput[] = [];
  const currentDescriptor = describePlayerStep(current.step);

  if (previous.phase === "playing" && current.phase === "feedback") {
    if (currentDescriptor?.kind === "storyDecision") {
      const consequenceHaptic = getStoryConsequenceHaptic({
        currentMetrics: current.metrics,
        previousMetrics: previous.metrics,
      });

      if (consequenceHaptic) {
        sequence.push(consequenceHaptic);
      }
    } else {
      const feedbackHaptic = getFeedbackRevealHaptic({
        result: current.result,
        step: current.step,
      });

      if (feedbackHaptic) {
        sequence.push(feedbackHaptic);
      }
    }
  }

  if (
    previous.phase === "feedback" &&
    current.phase === "playing" &&
    current.storyStaticVariant === "storyOutcome"
  ) {
    sequence.push("nudge");
  }

  const investigationMilestoneHaptic = getInvestigationMilestoneHaptic({ current, previous });

  if (investigationMilestoneHaptic) {
    sequence.push(investigationMilestoneHaptic);
  }

  const thresholdHaptic = getStoryThresholdHaptic({
    currentMetrics: current.metrics,
    previousMetrics: previous.metrics,
  });

  if (thresholdHaptic) {
    sequence.push(thresholdHaptic);
  }

  return sequence;
}
