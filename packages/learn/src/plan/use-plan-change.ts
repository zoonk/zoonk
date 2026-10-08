"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";

/**
 * Runs one plan change with a pending state and a failure flag, so every control on the plan
 * behaves the same way: disabled while saving (still focusable, with `focusableWhenDisabled`),
 * and a short message when it didn't work.
 */
export function usePlanChange() {
  const { actions, keepFocus } = usePlanScreen();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  /**
   * Resolves once the change is saved, to what it did (a focus that moved nothing says so), or to
   * null when it didn't work, for a sheet that answers or closes on it.
   */
  const change = (operations: LearnerPlanOperation[]): Promise<PlanChangeOutcome | null> => {
    setFailed(false);
    keepFocus();
    const done = Promise.withResolvers<PlanChangeOutcome | null>();

    startTransition(async () => {
      // A request that never reaches the server says "didn't work" like one the server refused.
      const { data: outcome } = await safeAsync(() => actions.change(operations));
      setFailed(!outcome);
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
