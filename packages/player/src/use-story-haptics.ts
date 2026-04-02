"use client";

import { useEffect, useRef } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type PlayerPhase } from "./player-reducer";
import { type StoryMetric } from "./player-selectors";
import { METRIC_CRITICAL_THRESHOLD, METRIC_DANGER_THRESHOLD } from "./story";

type HapticState = {
  metrics: StoryMetric[];
  phase: PlayerPhase;
};

type ConsequenceHaptic = "error" | "nudge" | "success";

/** Builds a metric-name to value lookup from a metrics array. */
function toMetricMap(metrics: StoryMetric[]): Map<string, number> {
  return new Map(metrics.map((entry) => [entry.metric, entry.value]));
}

/**
 * Determines the haptic pattern for consequence feedback based on metric deltas.
 *
 * Compares previous and current metric values to categorize the consequence:
 * - All positive or unchanged -> "success" (short double-tap)
 * - All negative or all decreased -> "error" (three sharp taps)
 * - Mixed changes -> "nudge" (light tap)
 */
function getConsequenceHaptic({
  previousMetrics,
  currentMetrics,
}: {
  previousMetrics: StoryMetric[];
  currentMetrics: StoryMetric[];
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

const CRITICAL_VIBRATE_SHORT = 50;
const CRITICAL_VIBRATE_LONG = 100;
const CRITICAL_PATTERN = [CRITICAL_VIBRATE_SHORT, CRITICAL_VIBRATE_SHORT, CRITICAL_VIBRATE_LONG];

type ThresholdHaptic = typeof CRITICAL_PATTERN | "error";

/**
 * Returns a haptic pattern if any metric just crossed into a danger or
 * critical zone, or null if no threshold was crossed.
 *
 * Critical takes priority over danger because it represents a more
 * urgent state that requires stronger tactile feedback.
 */
function getThresholdHaptic({
  previousMetrics,
  currentMetrics,
}: {
  previousMetrics: StoryMetric[];
  currentMetrics: StoryMetric[];
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
 * Centralized haptic feedback hook for story activities.
 *
 * Watches player state transitions and fires haptic patterns at key moments:
 * - Consequence reveal (playing->feedback): pattern based on metric changes
 * - Metric entering danger zone: warning tap
 * - Metric entering critical zone: double-tap pattern
 * - Outcome screen reveal: medium nudge
 *
 * No-ops when the activity is not a story or on devices that don't support
 * the Vibration API.
 */
export function useStoryHaptics({
  isStoryActivity,
  metrics,
  phase,
  storyStaticVariant,
}: {
  isStoryActivity: boolean;
  metrics: StoryMetric[];
  phase: PlayerPhase;
  storyStaticVariant: string | null;
}) {
  const { trigger } = useWebHaptics();
  const prevRef = useRef<HapticState>({ metrics, phase });

  useEffect(() => {
    if (!isStoryActivity) {
      return;
    }

    const previous = prevRef.current;
    prevRef.current = { metrics, phase };

    // Consequence reveal: playing -> feedback
    if (previous.phase === "playing" && phase === "feedback") {
      const haptic = getConsequenceHaptic({
        currentMetrics: metrics,
        previousMetrics: previous.metrics,
      });

      if (haptic) {
        void trigger(haptic);
      }
    }

    // Outcome screen reveal: storyStaticVariant reflects the current step
    // after CONTINUE advances the index, so we check the previous phase.
    if (
      previous.phase === "feedback" &&
      phase === "playing" &&
      storyStaticVariant === "storyOutcome"
    ) {
      void trigger("nudge");
    }

    // Metric entering danger or critical zone
    const thresholdHaptic = getThresholdHaptic({
      currentMetrics: metrics,
      previousMetrics: previous.metrics,
    });

    if (thresholdHaptic) {
      void trigger(thresholdHaptic);
    }
  }, [isStoryActivity, metrics, phase, storyStaticVariant, trigger]);
}
