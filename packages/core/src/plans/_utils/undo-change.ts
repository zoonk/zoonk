import "server-only";
import { type PlanChange } from "@zoonk/db";
import { forgetAssumedSkills, loadPlanItemSkillIds } from "../../learner/_utils/known-skills";
import { followPlanToday } from "./follow-plan-today";
import { parsePlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { canRestore, loadPlanSnapshot, restorePlan } from "./restore-plan";

/**
 * Puts the plan back as it was right before an edit or a test-out (see `PlanSnapshot`): every item
 * on its day with its status, and the phase ends, state and numbers it had. What the learner
 * finished since stays done. A test-out's skipped lessons are todo again where they were, and the
 * skills it only assumed known are forgotten: put back by planning again, they landed as todo rows
 * on day one beside a plan laid out without them.
 */
export async function undoChange({
  change,
  context,
}: {
  change: PlanChange;
  context: PlanContext;
}) {
  const snapshot = await loadPlanSnapshot(change.id);

  if (!snapshot || !(await canRestore(snapshot))) {
    return { status: "conflict" as const };
  }

  const skipped = new Set(
    change.kind === "testedOut" ? parsePlanChangePayload(change.payload).planItemIds : [],
  );

  const skillIds =
    skipped.size > 0
      ? await loadPlanItemSkillIds({ goalId: context.goal.id, planItemIds: [...skipped] })
      : [];

  const items = snapshot.items.map((item) =>
    skipped.has(item.id) && item.status === "testedOut"
      ? { ...item, completedAt: null, status: "todo" as const }
      : item,
  );

  await restorePlan({
    context,
    extraWrites: async (tx) => {
      await forgetAssumedSkills({ skillIds, tx, userId: context.goal.userId });
      await tx.planChange.update({ data: { status: "undone" }, where: { id: change.id } });
    },
    items,
    snapshot,
  });

  await followPlanToday({ context });

  return null;
}
