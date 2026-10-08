"use client";

import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { PlusNotice } from "../_components/plus-lock";
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
      <PlusNotice href={actions.plusHref} title={t("Your free week of exam prep is over")}>
        {t(
          "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
        )}
      </PlusNotice>
    </aside>
  );
}
