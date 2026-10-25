import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type PlanChange, prisma } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";
import { type PlanState } from "../planner/plan-state";
import { canUndoChange } from "./plan-change-view";
import { type PlanContext } from "./plan-context";
import { loadPlanSnapshot } from "./restore-plan";

/**
 * Mock funding and the checkpoints' overflow come from a planning run, so reversing a choice
 * hasn't restored them yet.
 */
function getChosen(state: PlanState) {
  const {
    checkpointOverflow: _checkpointOverflow,
    mockFunding: _mockFunding,
    ...settings
  } = state.settings;

  return { goal: state.goal, settings };
}

/**
 * The learner's latest change when `state` (the plan's state with their new change) is the state
 * right before it: they set back by hand what it changed, which is its Undo. Ana set her time to 15
 * minutes and back to 45 in the editor, and got a plan made again instead of the one she had: other
 * phase dates, today's lessons and her subjects' shares. Null when the latest change can't be
 * undone anymore, the new change sets anything else, or the latest change set nothing the learner
 * chooses: moving the phase dates changes no setting, and picking the practice mix the plan
 * already had silently put back the dates the learner had just accepted. Base choices are never
 * one: the learner saves them from a preview of what they do (see `previewPlanChange`), which an
 * Undo didn't match (Lucas's base back on its quick lesson put back a plan without the topic the
 * preview said came in).
 */
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
