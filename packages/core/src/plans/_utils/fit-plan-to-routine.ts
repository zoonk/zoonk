import "server-only";
import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/plans/routine-fit";
import { type Goal, prisma } from "@zoonk/db";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../daily-minutes";
import { withPlanRetry } from "../plan-conflict";
import { type PlanState } from "../planner/plan-state";
import { applyChangeNow, isPlanReady } from "./apply-plan-change";
import { type PlanContext, getPlanState } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { type PlanMemorySearch, searchPlanMemory, selectPlanMemory } from "./plan-memory";
import { endPlanSetupTask, endPlanSetupTaskWith } from "./plan-setup-tasks";
import { loadPlanAtToken } from "./plan-token";

const ROUTINE_SOURCE = "memory";

const ROUTINE_NEED = "When the learner can study: days off, busy days and trips";

function fitsRoutine({ goal, state }: { goal: Pick<Goal, "kind">; state: PlanState }): boolean {
  return (
    goal.kind !== "explain" && isPlanReady({ state }) && state.settings.weekdayMinutes === null
  );
}

async function readRoutine({ context, memory }: { context: PlanContext; memory: string[] }) {
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

/** Null when the plan has nothing to fit, which ends the task. */
export async function searchRoutineMemory(goalId: string): Promise<PlanMemorySearch | null> {
  const plan = await prisma.plan.findUnique({ include: { goal: true }, where: { goalId } });

  if (!plan?.setupTasks.includes("routine")) {
    return null;
  }

  const { goal } = plan;

  const search = fitsRoutine({ goal, state: getPlanState({ goal, plan }) })
    ? await searchPlanMemory({ goal, need: ROUTINE_NEED })
    : { memory: [] };

  if ("terms" in search || search.memory.length > 0) {
    return search;
  }

  await endPlanSetupTask({ goalId, task: "routine" });
  return null;
}

export async function selectRoutineMemory({
  goalId,
  terms,
}: {
  goalId: string;
  terms: string[];
}): Promise<string[]> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  return goal ? selectPlanMemory({ goal, need: ROUTINE_NEED, terms }) : [];
}

/**
 * Runs once: the change ends the task in its own transaction. A failed model call throws and leaves
 * the task owed.
 */
export async function fitPlanToRoutineMemory({
  goalId,
  memory,
}: {
  goalId: string;
  memory: string[];
}): Promise<void> {
  const task = { goalId, task: "routine" as const };
  const context = memory.length > 0 ? await loadPlanAtToken(goalId) : null;
  const routine = context && fitsRoutine(context) ? await readRoutine({ context, memory }) : null;

  const applied = routine
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
