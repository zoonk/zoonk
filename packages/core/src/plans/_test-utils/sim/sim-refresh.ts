import { isDeepStrictEqual } from "node:util";
import { getEstimateChange } from "../../_utils/estimate-change";
import { getFallingBehind } from "../../_utils/falling-behind";
import { parsePlanChangePayload } from "../../_utils/plan-change-payload";
import { isPlanUnchanged } from "../../_utils/plan-unchanged";
import { type ComputedPlan } from "../../_utils/replan";
import { withSeenTopics } from "../../_utils/seen-effect";
import { listCarriedItemIds } from "../../planner/carried-items";
import { carriesGiven } from "../../planner/carry-over";
import { listPhaseEndMoves } from "../../planner/phase-dates-move";
import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { readSimEvidence } from "./sim-claims";
import { updateSimPhaseDates, withdrawUnneededSimProposal } from "./sim-phase-dates";
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

/** A refresh's plan and change, and what it wrote about the phase dates (see `sim-phase-dates.ts`). */
export type SimRefresh = { change: SimChange | null; plan: SimPlan; proposals: SimChange[] };

function systemChange({
  computed,
  day,
  kind,
}: {
  computed: Pick<ComputedPlan, "effect">;
  day: string;
  kind: SimChange["kind"];
}): SimChange {
  return {
    day,
    effect: computed.effect,
    kind,
    operations: [],
    source: "system",
    status: "applied",
  };
}

/** Use the real seen-count threshold and payload for automatic estimate notices. */
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

  return change
    ? {
        day,
        effect: parsePlanChangePayload(change.payload).effect,
        kind: change.kind,
        operations: [],
        source: "system",
        status: "applied",
      }
    : null;
}

/** `computeRefreshedPlan`'s copy: after a session whose new pace lays this week past it, from tomorrow. */
function computeRefreshedSimPlan({ pace, world }: { pace: "sampled" | "saved"; world: SimWorld }) {
  const automatic = computeSimPlan({ mode: "automatic", pace, world });
  const newPace = !isDeepStrictEqual(automatic.pace, world.plan.state.settings.pace);

  if (pace === "saved" || !newPace || automatic.built.spill <= 0) {
    return { computed: automatic, mode: "automatic" as const, planned: world };
  }

  const planned = { ...world, today: addDays(world.today, 1) };
  const computed = computeSimPlan({ keepPhaseDates: true, mode: "forced", pace, world: planned });

  return { computed, mode: "forced" as const, planned };
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
  const context = toSimContext(world);

  const settledToday = world.changes.some(
    (change) => change.kind === "missedDays" && change.day === day,
  );

  const left = findLeftWork({ settledToday, world });

  if (left.length > 0) {
    const computed = computeSettledPlan({ missed: !wasLastDayStudied(world), pace, world });
    const phaseEnds = listPhaseEndMoves({ after: computed.built.phases, shown: world.plan.phases });

    return {
      change: {
        ...systemChange({ computed, day, kind: "missedDays" }),
        behind: getFallingBehind({ computed, context }),
        carriedItemIds: listCarriedItemIds({ items: computed.built.items, left }),
        effect: {
          ...withSeenTopics({ computed, shown: world.plan.items }),
          ...(phaseEnds.length > 0 && { phaseEnds }),
        },
      },
      plan: commitSimPlan({ computed, world }),
      proposals: updateSimPhaseDates({ computed, mode: "forced", pace, world }),
    };
  }

  if (settleOnly) {
    return { change: null, plan: world.plan, proposals: [] };
  }

  const { computed, mode, planned } = computeRefreshedSimPlan({ pace, world });

  if (computed.inputsKey === world.plan.inputsKey) {
    return {
      change: null,
      plan: world.plan,
      proposals: withdrawUnneededSimProposal({ computed, world }),
    };
  }

  const change = getAutomaticChange({ computed, day, world });
  const proposals = updateSimPhaseDates({ computed, mode, pace, planned, world });

  // An unchanged plan isn't saved, but the run read what the learner knows now, and keeps the key
  // of what it planned from with the lessons it counted for each skill (`savePlanInputsKey`).
  if (!change && isPlanUnchanged({ computed, context })) {
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
      proposals,
    };
  }

  return { change, plan: commitSimPlan({ computed, world }), proposals };
}
