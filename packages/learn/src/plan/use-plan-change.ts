"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";

/** What a control shows once its change answers: what it did, or null when it didn't work. */
type PlanChangeAnswer = (outcome: PlanChangeOutcome | null) => void;

/**
 * Runs one plan change with a pending state and a failure flag, so every control on the plan
 * behaves the same way: disabled while saving (still focusable, with `focusableWhenDisabled`),
 * and a short message when it didn't work.
 */
export function usePlanChange() {
  const { actions, keepFocus } = usePlanScreen();
  const editor = useReportEditorChange();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  /**
   * Saves the change. `answer` gets what it did (a focus that moved nothing says so), or null when
   * it didn't work, for a sheet that answers or closes on it. The re-planned page the server sends
   * back can arrive a moment after the action answers, so `answer` runs in the change's own
   * transition and what it shows arrives with that page, never over the old plan, where a date the
   * learner types next would be reset when the new plan arrives. The promise resolves to the same
   * outcome once the action answers, for a button that only waits for the save. Inside the plan
   * editor, the change it made becomes the editor's latest (see `PlanEditorChange`).
   */
  const change = (
    operations: LearnerPlanOperation[],
    answer?: PlanChangeAnswer,
  ): Promise<PlanChangeOutcome | null> => {
    setFailed(false);
    keepFocus();
    const done = Promise.withResolvers<PlanChangeOutcome | null>();

    startTransition(async () => {
      // A request that never reaches the server says "didn't work" like one the server refused.
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
