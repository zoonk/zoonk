import "server-only";
import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/v2/plans/routine-fit";
import { prisma } from "@zoonk/db";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { applyChangeNow, isPlanReady } from "./apply-plan-change";
import { type PlanContext, loadPlanContext } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { loadPlanMemory } from "./plan-memory";
import { endPlanSetupTask, endPlanSetupTaskWith } from "./plan-setup-tasks";
import { withPlanRetry } from "./replan";

/** Memory proposed it; the change shows the model's sentence saying what changed and why. */
const ROUTINE_SOURCE = "memory";

/** The routine's operations, or none when the model found nothing in memory to fit. */
async function readRoutine(context: PlanContext) {
  const memory = await loadPlanMemory({
    goal: context.goal,
    need: "When the learner can study: days off, busy days and trips",
  });

  if (memory.length === 0) {
    return null;
  }

  const { analytics, dailyMinutes, language, today, weekdayMinutes } = toPlanEditInput(context);

  // Days off, lighter days and dated light weeks: all a routine may change on a new plan.
  const { data, provenance } = await fitPlanToRoutineFacts({
    analytics,
    dailyMinutes,
    language,
    memory,
    today,
    weekdayMinutes,
  });

  return data.operations.length > 0
    ? { operations: data.operations, provenance, reason: data.reason }
    : null;
}

/**
 * Fits a new plan's week to what the learner told the app about their routine ("Sundays are for
 * family"): only days off, lighter days and dated light weeks, applied with the sentence saying
 * why and an undo. Nothing happens without such facts, for explanations, or once the learner
 * shaped their week themselves. It's the plan's `routine` setup task (see `runPlanSetupTask`):
 * the change ends the task in its own transaction, so a retry after the fit (a light week leaves
 * the week's minutes as they were) never fits the plan twice. A failed model call throws and
 * leaves the task owed.
 */
export async function fitPlanToRoutine(goalId: string): Promise<void> {
  const task = { goalId, task: "routine" as const };
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  const context = goal && goal.kind !== "explain" ? await loadPlanContext({ goal }) : null;

  const routine =
    context && isPlanReady(context) && context.state.settings.weekdayMinutes === null
      ? await readRoutine(context)
      : null;

  const applied =
    context && routine
      ? await withPlanRetry(async () => {
          const fresh = await loadPlanContext({ goal: context.goal });

          return fresh
            ? applyChangeNow({
                context: fresh,
                extraWrites: endPlanSetupTaskWith(task),
                operations: routine.operations,
                provenance: toProvenanceData(routine.provenance),
                reason: routine.reason,
                source: ROUTINE_SOURCE,
              })
            : null;
        })
      : null;

  // Nothing to fit, or nothing the fit committed: the task ends on its own.
  if (applied?.status !== "applied") {
    await endPlanSetupTask(task);
  }
}
