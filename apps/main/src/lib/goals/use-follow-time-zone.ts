"use client";

import { useRouter } from "@/i18n/navigation";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useEffect } from "react";
import {
  type SentTimeZoneFollow,
  createTimeZoneFollows,
  requestTimeZoneFollow,
} from "./follow-time-zone";

/** This page's follows: one ask per goal and device zone until the summary catches up. */
const timeZoneFollows = createTimeZoneFollows();

/**
 * Follows the learner to their device's zone when a goal's Today opens: a goal without a zone
 * stores it, and a learner who moved takes it before their day starts. It asks only once the
 * learner summary says this goal's saved zone isn't the device's, so opening Today writes nothing
 * otherwise (nor for a goal the learner just switched away from), and once per move. When that
 * moves the day, the screen reads itself again, once, so it and its actions read the same day.
 */
export function useFollowTimeZone(goalId: string) {
  const router = useRouter();
  const learner = useLearnerSummary();

  const summary =
    learner.status === "ready" && learner.summary.activeGoalId === goalId ? learner.summary : null;

  useEffect(() => {
    const request = summary
      ? timeZoneFollows.begin({ deviceZone: getLocalTimeZone(), goalId, summary })
      : undefined;

    if (!request) {
      return;
    }

    async function follow(sent: SentTimeZoneFollow) {
      const result = await requestTimeZoneFollow({ goalId, timeZone: sent.timeZone }).catch(
        () => null,
      );

      timeZoneFollows.settle({ goalId, request: sent, result });

      if (result?.moved) {
        router.refresh();
      }
    }

    void follow(request);
  }, [goalId, router, summary]);
}
