"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { usePlanScreen } from "./plan-context";

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

  const change = (operations: LearnerPlanOperation[]) => {
    setFailed(false);
    keepFocus();

    startTransition(async () => {
      const ok = await actions.change(operations);
      setFailed(!ok);

      if (ok) {
        analytics.track({
          name: "Plan Edited",
          properties: { change_kind: operations.map((operation) => operation.kind).join(",") },
        });
      }
    });
  };

  return { change, failed, isPending };
}
