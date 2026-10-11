"use client";

import { useRouter } from "@/i18n/navigation";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useEffect } from "react";
import { followTimeZoneAction } from "./time-zone-actions";

/**
 * Follows the learner to their device's zone when a goal's Today opens: a goal without a zone
 * stores it, and a learner who moved takes it before their day starts. When that moves the day,
 * the screen reads itself again, so it and its actions read the same day.
 */
export function useFollowTimeZone(goalId: string) {
  const router = useRouter();

  useEffect(() => {
    async function follow() {
      if (await followTimeZoneAction({ goalId, timeZone: getLocalTimeZone() })) {
        router.refresh();
      }
    }

    void follow();
  }, [goalId, router]);
}
