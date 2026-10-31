"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useEffect } from "react";
import { followTimeZoneAction } from "./follow-time-zone";

const askedFollows = new Set<string>();

export function useFollowTimeZone(goalId: string) {
  const learner = useLearnerSummary();

  const summary =
    learner.status === "ready" && learner.summary.activeGoalId === goalId ? learner.summary : null;

  // Each summary read checks the device's zone again: the learner may have moved with Today open.
  useEffect(() => {
    const deviceZone = getLocalTimeZone();
    const key = `${goalId}:${deviceZone}`;

    if (!summary || summary.timeZone === deviceZone || askedFollows.has(key)) {
      return;
    }

    askedFollows.add(key);

    followTimeZoneAction({ goalId, timeZone: deviceZone }).catch(() => null);
  }, [goalId, summary]);
}
