"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";

type PlanChangeAnswer = (outcome: PlanChangeOutcome | null) => void;

export function usePlanChange() {
  const { actions, keepFocus } = usePlanScreen();
  const editor = useReportEditorChange();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  /** `answer` runs in the change's transition, so what it shows arrives with the re-planned page, never over the old plan. */
  const change = (
    operations: LearnerPlanOperation[],
    answer?: PlanChangeAnswer,
  ): Promise<PlanChangeOutcome | null> => {
    setFailed(false);
    keepFocus();
    const done = Promise.withResolvers<PlanChangeOutcome | null>();

    startTransition(async () => {
      const { data: outcome } = await safeAsync(() => actions.change(operations));

      // Updates after an `await` join the transition only when started in one again.
      startTransition(() => {
        setFailed(!outcome);
        answer?.(outcome ?? null);

        if (outcome?.status === "applied" && outcome.change) {
          editor.report(outcome.change);
        }
      });

      done.resolve(outcome ?? null);

      if (outcome?.status === "applied") {
        analytics.track({
          name: "Plan Edited",
          properties: { change_kind: operations.map((operation) => operation.kind).join(",") },
        });
      }
    });

    return done.promise;
  };

  return { change, failed, isPending };
}
