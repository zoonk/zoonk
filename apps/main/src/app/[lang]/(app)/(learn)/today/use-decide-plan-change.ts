"use client";

import { answerPlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useCallback } from "react";

type Decision = { changeId: string } & PlanChangeDecisionInput;

export function useDecidePlanChange(today: TodayView) {
  return useCallback(
    ({ changeId, ...input }: Decision) =>
      answerPlanChangeAction(today.goal.id, {
        changeId,
        ...input,
        surface: input.surface ?? "today",
      }),
    [today.goal.id],
  );
}
