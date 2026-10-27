import { isDeepStrictEqual } from "node:util";
import { getEstimateChange } from "../../_utils/estimate-change";
import { isPlanUnchanged } from "../../_utils/plan-unchanged";
import { type ComputedPlan } from "../../_utils/replan";
import { listCarriedItemIds } from "../../planner/carried-items";
import { carriesGiven } from "../../planner/carry-over";
import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { readSimEvidence } from "./sim-claims";
import { commitSimPlan, computeSimPlan } from "./sim-planner";
import {
  LEARN_KINDS,
  type SimChange,
  type SimPlan,
  type SimWorld,
  getSimCarryOver,
  toSimContext,
} from "./sim-world";

/** `refreshGoalPlan`'s copy (see `sim-planner.ts`): what earlier days left, as `findLeftWork`. */
function findLeftWork({ settledToday, world }: { settledToday: boolean; world: SimWorld }) {
  const given = new Set(settledToday ? [] : getSimCarryOver(world).lessonIds);
  const carries = carriesGiven(world.plan.items);
  const { today } = world;

  return world.plan.items.filter(
    (item) =>
      item.status === "todo" &&
      LEARN_KINDS.has(item.kind) &&
      item.scheduledFor !== null &&
      (item.scheduledFor < today ||
        (item.lessonId !== null &&
          given.has(item.lessonId) &&
          item.scheduledFor > today &&
          carries(item))),
  );
}

/** `wasLastDayStudied`'s copy: a lesson or challenge finished on the last day Today was opened. */
function wasLastDayStudied(world: SimWorld): boolean {
  const today = toIsoDate(world.today);

  const lastDay = [...world.sessions.keys()]
    .filter((day) => day < today)
    .toSorted()
    .at(-1);

  return (
    lastDay !== undefined &&
    world.plan.items.some((item) => item.completedAt && toIsoDate(item.completedAt) === lastDay)
  );
}

/** `computeSettledPlan`'s copy: after a missed day, the ends a challenge would pass its lessons on move. */
function computeSettledPlan({
  missed,
  pace,
  world,
}: {
  missed: boolean;
  pace: "sampled" | "saved";
  world: SimWorld;
}): ComputedPlan {
  const settle = (released: ReadonlySet<number>): ComputedPlan => {
    const computed = computeSimPlan({
      keepPhaseDates: true,
      mode: "forced",
      pace,
      releasedPhases: released,
      setAsideLeftWork: true,
      world,
    });

    const more = missed
      ? computed.built.endsBeforeLessons.filter((phase) => !released.has(phase))
      : [];

    return more.length > 0 ? settle(new Set([...released, ...more])) : computed;
  };

  return settle(new Set());
}

/** A refresh's plan and the change it recorded. */
type SimRefresh = { change: SimChange | null; plan: SimPlan };

/** Use the real seen-count threshold for automatic estimate notices. */
function getAutomaticChange({
  computed,
  day,
  world,
}: {
  computed: ComputedPlan;
  day: string;
  world: SimWorld;
}): SimChange | null {
  const change = getEstimateChange({ computed, context: toSimContext(world) });
  return change ? { day, kind: change.kind, operations: [], status: "applied" } : null;
}

/** `computeRefreshedPlan`'s copy: after a session whose new pace lays this week past it, from tomorrow. */
function computeRefreshedSimPlan({
  pace,
  world,
}: {
  pace: "sampled" | "saved";
  world: SimWorld;
}): ComputedPlan | null {
  const automatic = computeSimPlan({ mode: "automatic", pace, skipUnchangedInputs: true, world });

  if (!automatic) {
    return null;
  }

  const newPace = !isDeepStrictEqual(automatic.pace, world.plan.state.settings.pace);

  if (pace === "saved" || !newPace || automatic.built.spill <= 0) {
    return automatic;
  }

  const planned = { ...world, today: addDays(world.today, 1) };
  return computeSimPlan({ keepPhaseDates: true, mode: "forced", pace, world: planned });
}

/** `refreshGoalPlan` on the simulator's world. */
export function refreshSimPlan({
  pace = "saved",
  settleOnly = false,
  world,
}: {
  pace?: "sampled" | "saved";
  /** Building a day: only what earlier days left settles (see `refreshGoalPlan`). */
  settleOnly?: boolean;
  world: SimWorld;
}): SimRefresh {
  const day = toIsoDate(world.today);

  const settledToday = world.changes.some(
    (change) => change.kind === "missedDays" && change.day === day,
  );

  const left = findLeftWork({ settledToday, world });

  if (left.length > 0) {
    const computed = computeSettledPlan({ missed: !wasLastDayStudied(world), pace, world });

    return {
      change: {
        carriedItemIds: listCarriedItemIds({ items: computed.built.items, left }),
        day,
        kind: "missedDays",
        operations: [],
        status: "applied",
      },
      plan: commitSimPlan({ computed, world }),
    };
  }

  const computed = settleOnly ? null : computeRefreshedSimPlan({ pace, world });

  if (!computed || computed.inputsKey === world.plan.inputsKey) {
    return { change: null, plan: world.plan };
  }

  const change = getAutomaticChange({ computed, day, world });

  // An unchanged plan isn't saved, but the run read what the learner knows now, and keeps the key
  // of what it planned from with the lessons it counted for each skill (`savePlanInputsKey`).
  if (!change && isPlanUnchanged({ computed, context: toSimContext(world) })) {
    return {
      change: null,
      plan: {
        ...world.plan,
        inputsKey: computed.inputsKey,
        knownSkillIds: [
          ...readSimEvidence(world, { focus: computed.state.settings }).knownSkillIds,
        ],
        state: { ...world.plan.state, graph: computed.state.graph },
      },
    };
  }

  return { change, plan: commitSimPlan({ computed, world }) };
}
