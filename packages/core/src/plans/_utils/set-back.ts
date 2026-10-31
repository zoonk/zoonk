import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type PlanChange, prisma } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";
import { type PlanState } from "../planner/plan-state";
import { canUndoChange } from "./plan-change-view";
import { type PlanContext } from "./plan-context";
import { loadPlanSnapshot } from "./restore-plan";

function getChosen(state: PlanState) {
  const {
    checkpointOverflow: _checkpointOverflow,
    mockFunding: _mockFunding,
    ...settings
  } = state.settings;

  return { goal: state.goal, settings };
}

export async function findSetBackChange({
  context,
  operations,
  state,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
  state: PlanState;
}): Promise<PlanChange | null> {
  if (operations.every((operation) => operation.kind === "setBaseChoices")) {
    return null;
  }

  const latest = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { kind: "edited", planId: context.plan.id, status: "applied" },
  });

  if (!latest || !canUndoChange({ change: latest, planVersion: context.plan.version })) {
    return null;
  }

  const snapshot = await loadPlanSnapshot(latest.id);
  const before = snapshot && getChosen(snapshot.state);

  return before &&
    isDeepStrictEqual(getChosen(state), before) &&
    !isDeepStrictEqual(getChosen(context.state), before)
    ? latest
    : null;
}
