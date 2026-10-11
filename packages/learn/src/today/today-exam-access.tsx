"use client";

import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { useLearnAnalytics } from "../learn-context";
import { useTodayScreen } from "./today-context";

/**
 * A free exam plan past its first week: the day's new lessons and practice stop, while reviews
 * and fixing mistakes carry on. Today says so once, calmly, instead of lessons quietly
 * disappearing, and offers Plus for the rest of the plan and mock exams.
 */
export function TodayExamAccess() {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const { actions, today } = useTodayScreen();
  const { trialEnded } = today.session.examAccess;

  useEffect(() => {
    if (trialEnded) {
      analytics.track({ name: "Subscription Gate Shown" });
    }
  }, [analytics, trialEnded]);

  if (!trialEnded) {
    return null;
  }

  return (
    <aside aria-label={t("Exam prep on the free plan")}>
      <FreeWeekOverNotice href={actions.plusHref} />
    </aside>
  );
}
