"use client";

import { useRouter } from "@/i18n/navigation";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useEffect } from "react";
import { followTimeZoneAction } from "./time-zone-actions";

/**
 * Follows the learner to their device's zone when a goal's Today opens: a goal without a zone
 * stores it, and a learner who moved takes it before their day starts. It asks only once the
 * learner summary says this goal's saved zone isn't the device's, so opening Today writes nothing
 * otherwise (nor for a goal the learner just switched away from). When that moves the day, the
 * screen reads itself again, so it and its actions read the same day.
 */
export function useFollowTimeZone(goalId: string) {
  const router = useRouter();
  const learner = useLearnerSummary();
  const isActive = learner.status === "ready" && learner.summary.activeGoalId === goalId;
  const savedZone = isActive ? learner.summary.timeZone : null;

  useEffect(() => {
    const timeZone = getLocalTimeZone();

    if (!isActive || savedZone === timeZone) {
      return;
    }

    async function follow() {
      if (await followTimeZoneAction({ goalId, timeZone })) {
        router.refresh();
      }
    }

    void follow();
  }, [goalId, isActive, router, savedZone]);
}
