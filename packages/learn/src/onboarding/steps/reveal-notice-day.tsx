"use client";

import { NoticeDatesCard } from "../../plan/notice-day";
import { usePlanScreen } from "../../plan/plan-context";
import { usePlanChange } from "../../plan/use-plan-change";

/**
 * The notice's exam day when the plan counts down to another (the month the learner said, or a
 * date of their own), with one tap to take it, or, for an exam held several times a year with no
 * sitting in their month, the closest ones. The plan keeps theirs until they pick one.
 */
export function RevealNoticeDay() {
  const { plan } = usePlanScreen();
  const { change } = usePlanChange();
  const { noSitting, noticeDay } = plan.schedule;

  const use = async (date: string) => {
    const outcome = await change([{ kind: "setTargetDate", targetDate: date }]);
    return outcome?.status === "applied";
  };

  return plan.notice === "usual" ? null : (
    <NoticeDatesCard
      document={plan.examDocument}
      noSitting={noSitting}
      noticeDay={noticeDay}
      onUse={use}
    />
  );
}
