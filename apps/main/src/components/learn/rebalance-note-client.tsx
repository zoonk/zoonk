"use client";

import { decidePlanChangeAction } from "@/app/[lang]/(learn)/plan/plan-actions";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { RebalanceNote } from "@zoonk/learn/rebalance";

/** Undo (or OK) goes through the plan's own decision, like every other plan change. */
export function RebalanceNoteClient({
  change,
  goalId,
  buddy,
}: {
  change: PlanChangeView;
  goalId: string;
  buddy: LearnBuddy | null;
}) {
  return (
    <RebalanceNote
      change={change}
      className="mb-6"
      onDecide={(status) => decidePlanChangeAction(goalId, { changeId: change.id, status })}
      buddy={buddy}
    />
  );
}
