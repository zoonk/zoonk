import "server-only";
import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/v2/plans/routine-fit";
import { prisma } from "@zoonk/db";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../daily-minutes";
import { withPlanRetry } from "../plan-conflict";
import { applyChangeNow, isPlanReady } from "./apply-plan-change";
import { type PlanContext } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { loadPlanMemory } from "./plan-memory";
import { endPlanSetupTask, endPlanSetupTaskWith } from "./plan-setup-tasks";
import { loadPlanAtToken } from "./plan-token";

const ROUTINE_SOURCE = "memory";

async function readRoutine(context: PlanContext) {
  const memory = await loadPlanMemory({
    goal: context.goal,
    need: "When the learner can study: days off, busy days and trips",
  });

  if (memory.length === 0) {
    return null;
  }

  const { analytics, dailyMinutes, language, today, weekdayMinutes } = toPlanEditInput(context);

  const { data, provenance } = await fitPlanToRoutineFacts({
    analytics,
    dailyMinutes,
    dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
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
 * Runs once: the change ends the task in its own transaction. A failed model call throws and leaves
 * the task owed.
 */
export async function fitPlanToRoutine(goalId: string): Promise<void> {
  const task = { goalId, task: "routine" as const };
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  const context = goal && goal.kind !== "explain" ? await loadPlanAtToken(goal.id) : null;

  const routine =
    context && isPlanReady(context) && context.state.settings.weekdayMinutes === null
      ? await readRoutine(context)
      : null;

  const applied =
    context && routine
      ? await withPlanRetry(async () => {
          const fresh = await loadPlanAtToken(goalId);

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

  if (applied?.status !== "applied") {
    await endPlanSetupTask(task);
  }
}
