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

/** The plan's areas that are part of another for learners (see `findPartAreas`), by its graph. */
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

/**
 * A change that names an area (focus, less time, skip, bring back, where it starts) names the areas
 * that are part of it too (see `findPartAreas`): focusing ENEM's languages area focuses the foreign
 * language the learner takes, which learners only see inside it.
 */
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

/** `withPartAreas` for a change to the plan in `context`, reading the exam's subjects only when it names areas. */
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

/**
 * A change's operations applied to the plan's state in `context`, the one way every change, preview,
 * proposal and accepted proposal applies them: an area they name brings the areas that are part of
 * it (see `withPartAreas`). The operations come back with those parts, to plan the change with; the
 * change keeps the learner's words, which name only the area they see.
 */
export async function applyChangeOperations({
  context,
  noticeGraph = null,
  operations,
}: {
  context: Pick<PlanContext, "goal" | "items" | "plan" | "state" | "today">;
  /** The graph a `followNotice` operation follows (see `applyPlanOperations`). */
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

  // A move to a day that already has the week's event is refused, before it can drop either.
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

/**
 * Whether a change chooses a way to study a base the saved plan's bases list doesn't open for it
 * (see `getOpenChoices`): a quick lesson for a base whose core the learner studied changes nothing.
 * The list is the saved summary's, the one the bases sheet and the API show.
 */
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
