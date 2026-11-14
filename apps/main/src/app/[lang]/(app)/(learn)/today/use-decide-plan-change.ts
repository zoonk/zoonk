"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { type PlanChangeAnswer } from "@zoonk/core/plans/decision-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useCallback } from "react";

export function useDecidePlanChange(today: TodayView) {
  return useCallback(
    (answer: PlanChangeAnswer) =>
      answerPlanChangeAction(today.goal.id, { ...answer, surface: answer.surface ?? "today" }),
    [today.goal.id],
  );
}
