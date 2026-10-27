"use client";

import { useRouter } from "@/i18n/navigation";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useEffect } from "react";
import { requestTimeZoneFollow } from "./follow-time-zone";

/** The goals and device zones this page load already asked to follow (`goalId:zone`). */
const askedFollows = new Set<string>();

/**
 * Follows the learner to their device's zone when a goal's Today opens: a goal without a zone
 * stores it, and a learner who moved takes it before their day starts. It asks only once the
 * learner summary says this goal's saved zone isn't the device's, so opening Today writes nothing
 * otherwise (nor for a goal the learner just switched away from), and once per goal and zone on a
 * page load. When that moves the day, the page reads itself again, so the screen, its actions and
 * the frame's summary read the same day.
 */
export function useFollowTimeZone(goalId: string) {
  const router = useRouter();
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

    void requestTimeZoneFollow({ goalId, timeZone: deviceZone }).then(
      (result) => {
        if (result.moved) {
          router.refresh();
        }
      },
      () => null,
    );
  }, [goalId, router, summary]);
}
