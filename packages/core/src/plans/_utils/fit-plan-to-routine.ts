import "server-only";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { prisma } from "@zoonk/db";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { type PlanOperation } from "../plan-contract";
import { applyChangeNow, isPlanReady } from "./apply-plan-change";
import { loadPlanContext } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { loadPlanMemory } from "./plan-memory";
import { withPlanRetry } from "./replan";

/** Memory proposed it; the change shows the model's sentence saying what changed and why. */
const ROUTINE_SOURCE = "memory";

/**
 * Fits a new plan's week to what the learner told the app about their routine ("Sundays are for
 * family"): only days off, lighter days and dated light weeks, applied with the sentence saying
 * why and an undo. Nothing happens without such facts, for explanations, or once the learner
 * shaped their week themselves.
 */
export async function fitPlanToRoutine(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  const context = goal && goal.kind !== "explain" ? await loadPlanContext({ goal }) : null;

  if (!context || !isPlanReady(context) || context.state.settings.weekdayMinutes !== null) {
    return;
  }

  const memory = await loadPlanMemory({
    goal: context.goal,
    need: "When the learner can study: days off, busy days and trips",
  });

  if (memory.length === 0) {
    return;
  }

  const { data, provenance } = await interpretPlanEdit({
    ...toPlanEditInput(context),
    memory,
    purpose: "routine",
    request: "",
  });

  // Days off, lighter days and dated light weeks: all a routine may change on a new plan.
  const operations = data.operations.filter(
    (
      operation,
    ): operation is Extract<PlanOperation, { kind: "addLightWeek" | "setWeekdayMinutes" }> =>
      operation.kind === "addLightWeek" || operation.kind === "setWeekdayMinutes",
  );

  if (!data.understood || operations.length === 0) {
    return;
  }

  await withPlanRetry(async () => {
    const fresh = await loadPlanContext({ goal: context.goal });

    if (!fresh) {
      return;
    }

    await applyChangeNow({
      context: fresh,
      operations,
      provenance: toProvenanceData(provenance),
      reason: data.summary,
      source: ROUTINE_SOURCE,
    });
  });
}
