import { isDeepStrictEqual } from "node:util";
import { type PlanOperation } from "../../plan-contract";
import { toIsoDate } from "../../planner/plan-calendar";
import { type ExistingPlanItem } from "../../planner/plan-items";
import { applyPlanOperations } from "../../planner/plan-operations";
import { type PlanState } from "../../planner/plan-state";
import { type RuleEvent } from "../rules/rule-context";
import { type SimStepLabel, toRulePlan } from "./sim-context";
import { type Runner, record } from "./sim-runner";
import { buildSimSession } from "./sim-session";
import { type SimChange, type SimPlan, type SimWorld } from "./sim-world";

/**
 * `decidePlanChange`'s undo (see `sim-planner.ts`): right after an edit, or placement's test-outs,
 * the learner takes it back, and the plan right before it comes back as it was (`restorePlan`),
 * a test-out's skipped lessons todo again. Today's session, when there is one, follows
 * (`followPlanToday`).
 */

/** Rows the restore can't delete (`savePlanItems`) follow the plan's items, by this much. */
const ORPHAN_OFFSET = 1_000_000;

/** The world with the undone change marked so, as its row is: it's no longer one the learner made. */
function markUndone({ change, world }: { change: SimChange; world: SimWorld }): SimWorld {
  return {
    ...world,
    changes: world.changes.map((entry) =>
      entry === change ? { ...entry, status: "undone" as const } : entry,
    ),
  };
}

/** The snapshot's items, a test-out's skipped lessons todo again (`undoChange`). */
function listRestoredItems({ change, snapshot }: { change: SimChange; snapshot: SimPlan }) {
  const ids = new Set(change.kind === "testedOut" ? change.planItemIds : []);

  return snapshot.items.map((item) =>
    ids.has(item.id) && item.status === "testedOut"
      ? { ...item, completedAt: null, status: "todo" as const }
      : item,
  );
}

/**
 * `restorePlan` on the simulator's world: the snapshot's state, phases and items, each on its day
 * with its status, but what the learner finished since, which stays done. A row the change
 * removed comes back (with its old id, which nothing else holds); one it added that
 * `savePlanItems` can't delete follows the plan's items.
 */
function restoreSimPlan({
  current,
  items,
  snapshot,
}: {
  current: SimPlan;
  items: readonly ExistingPlanItem[];
  snapshot: SimPlan;
}): SimPlan {
  const rows = new Map(current.items.map((item) => [item.id, item]));
  const ids = new Set(items.map((item) => item.id));

  const restored = items.map((item, position) => {
    const row = rows.get(item.id);

    if (!row) {
      return { ...item, position };
    }

    // `restoreStatus` gives a todo or set-aside item that status back, but never undoes a finish.
    const restores = row.status !== "done" && (item.status === "todo" || item.status === "skipped");

    return {
      ...item,
      completedAt: restores ? null : row.completedAt,
      lessonId: row.lessonId,
      position,
      status: restores ? item.status : row.status,
    };
  });

  const orphans = current.items
    .filter((item) => !ids.has(item.id) && item.status !== "todo")
    .map((item) => ({ ...item, position: item.position + ORPHAN_OFFSET }));

  return {
    coveredShare: snapshot.coveredShare,
    inputsKey: snapshot.inputsKey,
    items: [...restored, ...orphans],
    // The plan comes back as it was built, with what that run read the learner knew.
    knownSkillIds: snapshot.knownSkillIds,
    phases: snapshot.phases,
    state: snapshot.state,
    version: current.version + 1,
  };
}

/**
 * Puts back the plan right before `change` (`undoChange`), recorded as `label` and `event`, and
 * the change is no longer one the learner made. Today's session, when there is one, follows.
 */
function takeBack(
  runner: Runner,
  {
    change,
    event,
    label,
    step,
  }: { change: SimChange; event: RuleEvent; label: SimStepLabel; step: number },
) {
  const before = runner.world.plan;
  const { snapshot } = change;

  if (!snapshot) {
    return;
  }

  const items = listRestoredItems({ change, snapshot });
  const plan = restoreSimPlan({ current: before, items, snapshot });

  runner.world = markUndone({ change, world: runner.world });

  record(runner, { before, change: null, event, label, plan, step });

  const day = toIsoDate(runner.world.today);

  if (runner.world.sessions.has(day)) {
    runner.world.sessions.set(day, buildSimSession({ start: runner.start, world: runner.world }));
  }
}

/**
 * The learner undoes the change the step before recorded (`change`), which started from the plan
 * `restores`: the checks compare what comes back with it (R38).
 */
export function undoSimChange(
  runner: Runner,
  { change, restores, step }: { change: SimChange; restores: SimPlan; step: number },
) {
  const kind = runner.inputs.goal.kind;

  takeBack(runner, {
    change,
    event: {
      change: change.kind === "testedOut" ? "testedOut" : "edited",
      kind: "undo",
      restores: toRulePlan({ inputs: runner.inputs, kind, plan: restores }),
    },
    label: "undo",
    step,
  });
}

/** What a learner sets in their plan: their time and date, and the plan's settings. */
function getChosen(state: PlanState) {
  return { goal: state.goal, settings: state.settings };
}

/**
 * `findSetBackChange`'s copy: the learner's latest edit, while the plan is still the one it left,
 * when `operations` set back by hand what it changed (the plan's chosen time, date and settings
 * come back to those right before it). Null otherwise, when the edit changed none of them (a
 * phase-dates move), and for base choices, which apply as their preview says.
 */
function findSimSetBack({
  operations,
  world,
}: {
  operations: readonly PlanOperation[];
  world: SimWorld;
}): SimChange | null {
  if (operations.every((operation) => operation.kind === "setBaseChoices")) {
    return null;
  }

  const result = applyPlanOperations({
    goalKind: world.inputs.goal.kind,
    operations,
    state: world.plan.state,
    today: world.today,
  });

  const latest = world.changes.findLast(
    (change) => change.kind === "edited" && change.status === "applied",
  );

  // The commit that saved the change left the plan one version past its snapshot (`versionAfter`).
  if (
    "error" in result ||
    !latest?.snapshot ||
    latest.snapshot.version + 1 !== world.plan.version
  ) {
    return null;
  }

  const before = getChosen(latest.snapshot.state);

  return isDeepStrictEqual(getChosen(result.state), before) &&
    !isDeepStrictEqual(getChosen(world.plan.state), before)
    ? latest
    : null;
}

/**
 * `changeGoalPlan`'s set-back (`undoSetBack`): a change in the editor that sets back by hand what
 * the learner's latest edit changed is that edit's Undo, recorded as the change the learner made.
 * False when it sets back nothing, and the change applies as any other.
 */
export function setBackSimChange(
  runner: Runner,
  { operations, step }: { operations: PlanOperation[]; step: number },
): boolean {
  const change = findSimSetBack({ operations, world: runner.world });

  if (!change) {
    return false;
  }

  takeBack(runner, {
    change,
    event: { kind: "learnerChange", operations, setBack: true },
    label: "change",
    step,
  });

  return true;
}
