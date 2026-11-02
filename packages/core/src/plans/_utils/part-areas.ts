import "server-only";
import { loadPartAreas } from "../../exams/choices/load-exam-choices";
import { type PlanOperation } from "../plan-contract";
import { isAreaOperation } from "../planner/area-operations";
import { getSkillArea } from "../planner/graph-areas";
import { fromIsoDate } from "../planner/plan-calendar";
import { type PlanOperationError, applyPlanOperations } from "../planner/plan-operations";
import { type PlanGraph, type PlanState } from "../planner/plan-state";
import { isWeeklyMoveDateAllowed } from "../planner/weekly-move-date";
import { hasWeeklyEventCollision } from "./missing-weekly-move";
import { type PlanContext } from "./plan-context";
import { readPlanSummary } from "./plan-summary";

export function loadGraphPartAreas({
  examBlueprintId,
  graph,
}: {
  examBlueprintId: string | null;
  graph: PlanGraph;
}): Promise<Map<string, string>> {
  const areas = [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
  return loadPartAreas({ areas, examBlueprintId });
}

function withPartAreas({
  operations,
  partAreas,
}: {
  operations: readonly PlanOperation[];
  partAreas: ReadonlyMap<string, string>;
}): PlanOperation[] {
  return operations.map((operation) => {
    if (!isAreaOperation(operation)) {
      return operation;
    }

    const parts = [...partAreas].flatMap(([part, whole]) =>
      operation.areas.includes(whole) && !operation.areas.includes(part) ? [part] : [],
    );

    return parts.length > 0 ? { ...operation, areas: [...operation.areas, ...parts] } : operation;
  });
}

async function loadOperationsWithParts({
  context,
  operations,
}: {
  context: Pick<PlanContext, "goal" | "state">;
  operations: readonly PlanOperation[];
}): Promise<PlanOperation[]> {
  if (!operations.some((operation) => isAreaOperation(operation))) {
    return [...operations];
  }

  const partAreas = await loadGraphPartAreas({
    examBlueprintId: context.goal.examBlueprintId,
    graph: context.state.graph,
  });

  return withPartAreas({ operations, partAreas });
}

export async function applyChangeOperations({
  context,
  noticeGraph = null,
  operations,
}: {
  context: Pick<PlanContext, "goal" | "items" | "plan" | "state" | "today">;
  noticeGraph?: PlanGraph | null;
  operations: readonly PlanOperation[];
}): Promise<{ error: PlanOperationError } | { operations: PlanOperation[]; state: PlanState }> {
  const withParts = await loadOperationsWithParts({ context, operations });

  if (
    operations.some(
      (operation) =>
        operation.kind === "moveWeeklyEvent" &&
        !isWeeklyMoveDateAllowed({ to: fromIsoDate(operation.to), today: context.today }),
    )
  ) {
    return { error: "moveBeforeNextMonday" };
  }

  if (
    hasWeeklyEventCollision({
      items: context.items,
      moves: context.state.settings.movedEvents,
      operations,
    })
  ) {
    return { error: "mockCollision" };
  }

  if (hasClosedBaseChoice({ context, operations })) {
    return { error: "baseChoiceClosed" };
  }

  const result = applyPlanOperations({
    goalKind: context.goal.kind,
    noticeGraph,
    operations: withParts,
    state: context.state,
    today: context.today,
  });

  return "error" in result ? result : { operations: withParts, state: result.state };
}

function hasClosedBaseChoice({
  context,
  operations,
}: {
  context: Pick<PlanContext, "goal" | "plan">;
  operations: readonly PlanOperation[];
}): boolean {
  const summary = readPlanSummary({
    plan: { ...context.plan, userId: context.goal.userId },
    value: context.plan.summary,
  });

  const open = new Map(
    (summary?.selected.bases?.bases ?? []).map((base) => [base.skillId, base.choices]),
  );

  return operations.some(
    (operation) =>
      operation.kind === "setBaseChoices" &&
      operation.choices.some(
        (entry) => open.has(entry.skillId) && !open.get(entry.skillId)?.includes(entry.choice),
      ),
  );
}
