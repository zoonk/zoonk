"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { type LearnerViewRead } from "@/lib/learner/learner-view-copies";
import { noteLearnerRevision, withLearnerWrite } from "@/lib/learner/learner-views";
import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback } from "react";
import { acknowledgeTodayPlanChangeAction } from "./today-actions";

type Decision = { changeId: string | null; status: PlanChangeDecisionInput["status"] };

/**
 * Answers Today's plan change. A saved one goes through the plan's own answer. "Got it" on one
 * Today worked out before the day saved it (no id yet) saves and acknowledges it in one go, for the
 * copy that showed it (Today's notice follows its copy until it's answered); the learner's revision
 * then makes Today read itself again, so it leaves. One out of date by then (the goal paused, the
 * day moved on, the change gone) says nothing: Today reads itself again first, and its copy, or the
 * page's other state, replaces it (`stale`; the notice stays busy until then). Resolves to null when
 * it didn't save: Today reads itself again meanwhile, since the learner may have moved on
 * elsewhere, so the next try answers what Today shows then.
 */
export function useDecidePlanChange({
  refreshView,
  today,
}: {
  refreshView: () => Promise<LearnerViewRead>;
  today: TodayView;
}) {
  return useCallback(
    async ({ changeId, status }: Decision): Promise<PlanChangeView | "stale" | null> => {
      if (changeId !== null) {
        return withLearnerWrite(() => answerPlanChangeAction(today.goal.id, { changeId, status }));
      }

      const change = today.planChange;

      if (change?.id !== null || status !== "seen") {
        return null;
      }

      const generation = getLearnerGeneration();

      const result = await acknowledgeTodayPlanChangeAction({
        goalId: today.goal.id,
        kind: "computed",
        revision: today.revision,
        shownDate: toStudyDayDate(today.session.localDate),
        timeZone: getLocalTimeZone(),
      });

      if (result.status === "acknowledged") {
        noteLearnerRevision({ generation, revision: result.revision, userId: result.userId });
        return { ...change, id: result.changeId };
      }

      if (result.status === "retryable") {
        void refreshView();
        return null;
      }

      if (result.status === "unauthorized") {
        return null;
      }

      // Says nothing only once what replaces it is on screen, or on its way: Today's new copy, or
      // the page drawing another state. Settling either way lets that render commit.
      return (await refreshView()) === "failed" ? null : "stale";
    },
    [refreshView, today],
  );
}
