"use client";

import { useEffect, useRef } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type PlayerPhase } from "./player-reducer";
import { type StoryMetric } from "./player-selectors";

type HapticState = {
  metrics: StoryMetric[];
  phase: PlayerPhase;
};

/**
 * Determines the haptic pattern for consequence feedback based on metric deltas.
 *
 * Compares previous and current metric values to categorize the consequence:
 * - All positive or unchanged → "success" (short double-tap)
 * - All negative or all decreased → "error" (three sharp taps)
 * - Mixed changes → "nudge" (light tap)
 */
function getConsequenceHaptic(
  prevMetrics: StoryMetric[],
  currentMetrics: StoryMetric[],
): string | null {
  if (prevMetrics.length === 0 || currentMetrics.length === 0) {
    return null;
  }

  const hasPositive = currentMetrics.some((current) => {
    const previous = prevMetrics.find((entry) => entry.metric === current.metric);
    return previous && current.value > previous.value;
  });

  const hasNegative = currentMetrics.some((current) => {
    const previous = prevMetrics.find((entry) => entry.metric === current.metric);
    return previous && current.value < previous.value;
  });

  if (hasNegative && !hasPositive) {
    return "error";
  }

  if (hasPositive && !hasNegative) {
    return "success";
  }

  if (hasPositive && hasNegative) {
    return "nudge";
  }

  return null;
}

const DANGER_THRESHOLD = 25;
const CRITICAL_THRESHOLD = 15;
const CRITICAL_VIBRATE_SHORT = 50;
const CRITICAL_VIBRATE_LONG = 100;
const CRITICAL_PATTERN = [CRITICAL_VIBRATE_SHORT, CRITICAL_VIBRATE_SHORT, CRITICAL_VIBRATE_LONG];

/**
 * Checks if any metric just crossed into a danger or critical zone and
 * fires the appropriate haptic feedback.
 */
function checkMetricThresholds(
  currentMetrics: StoryMetric[],
  previousMetrics: StoryMetric[],
  trigger: (input: number | number[] | string) => void,
): void {
  const crossedCritical = currentMetrics.some((current) => {
    const previous = previousMetrics.find((entry) => entry.metric === current.metric);
    return previous && current.value < CRITICAL_THRESHOLD && previous.value >= CRITICAL_THRESHOLD;
  });

  if (crossedCritical) {
    trigger(CRITICAL_PATTERN);
    return;
  }

  const crossedDanger = currentMetrics.some((current) => {
    const previous = previousMetrics.find((entry) => entry.metric === current.metric);
    return previous && current.value < DANGER_THRESHOLD && previous.value >= DANGER_THRESHOLD;
  });

  if (crossedDanger) {
    trigger("error");
  }
}

/**
 * Centralized haptic feedback hook for story activities.
 *
 * Watches player state transitions and fires haptic patterns at key moments:
 * - Consequence reveal (playing→feedback): pattern based on metric changes
 * - Metric entering danger zone (<25): warning tap
 * - Metric entering critical zone (<15): double-tap pattern
 * - Outcome screen reveal: medium nudge
 * - Debrief concept reveals: soft tap
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

    // Consequence reveal: playing → feedback
    if (previous.phase === "playing" && phase === "feedback") {
      const haptic = getConsequenceHaptic(previous.metrics, metrics);

      if (haptic) {
        void trigger(haptic);
      }
    }

    // Outcome screen reveal
    if (
      phase === "playing" &&
      storyStaticVariant === "storyOutcome" &&
      previous.phase === "feedback"
    ) {
      void trigger("nudge");
    }

    // Check for metrics entering danger/critical zones
    checkMetricThresholds(metrics, previous.metrics, (input) => {
      void trigger(input);
    });
  }, [isStoryActivity, metrics, phase, storyStaticVariant, trigger]);
}
