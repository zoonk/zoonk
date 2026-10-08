import { type GoalKind } from "@zoonk/db";
import { getCadencedAreas } from "./cadenced-areas";
import { putCoresFirst } from "./core-first";
import { getAreasOf, getCyclePhases, getWrittenTestAreas } from "./graph-areas";
import { scheduleCoresFirst } from "./least-worth-cores";
import { type PlanGraph, type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, scheduleUnits } from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";
import { arrangeStudyCycle } from "./study-cycle";
import { type CadencedArea } from "./study-cycle-lanes";
import { type ScoredTopic } from "./topic-weights";

type RestInput = {
  days: readonly PlanDay[];
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  /** Each skill's lessons the plan already holds outside `units` (see `putCoresFirst`). */
  kept: ReadonlyMap<string, number>;
  /** The skills the learner's last test missed: an exam's study cycle opens with their subjects. */
  missedSkillIds: ReadonlySet<string>;
  /** What an exam's study cycle opens with after the gaps (see `arrangeStudyCycle`). */
  opening: { knownAreas: ReadonlySet<string>; noticeAreas: ReadonlySet<string> | null };
  /** The part of its subject each skill is in, where the notice groups its topics. */
  parts: ReadonlyMap<string, string>;
  planStart: Date;
  /** What `buildPlanQueue` says about the planned skills. */
  queue: {
    focused: ReadonlySet<string>;
    prerequisites: ReadonlyMap<string, readonly string[]>;
    ranks: ReadonlyMap<string, number>;
    rates: ReadonlyMap<string, number> | null;
    recalled: ReadonlySet<string>;
    values: ReadonlyMap<string, number>;
  };
  settings: PlanSettings;
  /** The notice topics each skill teaches, with how often the exam asks them. */
  topics: ReadonlyMap<string, readonly ScoredTopic[]>;
  units: readonly QueueUnit[];
};

/**
 * The units laid on the days: an exam's as its study cycle (see `arrangeStudyCycle`), with its
 * written tests on days of their own when `cadenced` says so; other goals' in queue order. Short
 * on time, the plan keeps every skill in with its core and leaves out depth instead; its stand-ins
 * go in parts about a lesson long (as an exam's study cycle takes them), so the part of a skill's
 * core that fits is in the plan, as it will be once its lessons are outlined.
 */
function scheduleWith({
  cadenced,
  input,
}: {
  cadenced: ReadonlyMap<string, CadencedArea> | null;
  input: RestInput;
}) {
  const { graph, queue } = input;
  const gapAreas = getAreasOf({ graph, skillIds: input.missedSkillIds });

  const schedulePending = (list: readonly QueueUnit[]) =>
    scheduleUnits({
      days: input.days,
      units: queue.rates
        ? arrangeStudyCycle({
            areaPhases: getCyclePhases({ focusAreas: input.settings.focusAreas, gapAreas, graph }),
            cadenced: cadenced ?? undefined,
            days: input.days,
            firstAreas: gapAreas,
            knownAreas: input.opening.knownAreas,
            noticeAreas: input.opening.noticeAreas,
            prerequisites: queue.prerequisites,
            rates: queue.rates,
            units: list,
          })
        : list,
    });

  const whole = schedulePending(input.units);

  if (!input.goal.targetDate || !whole.dropped.some((unit) => unit.kind === "lesson")) {
    return whole;
  }

  return scheduleCoresFirst({
    schedulePending,
    units: splitStandIns(
      putCoresFirst(input.units, {
        kept: input.kept,
        ranks: queue.ranks,
        wholeOutcomes: input.goal.kind !== "exam",
      }),
    ),
    worth: queue.rates && {
      focused: queue.focused,
      gaps: input.missedSkillIds,
      known: new Set([...queue.recalled].filter((skillId) => !input.missedSkillIds.has(skillId))),
      parts: input.parts,
      prerequisites: queue.prerequisites,
      topics: input.topics,
      values: queue.values,
    },
  });
}

/**
 * Schedules what the plan has left to place after this week and the work earlier days left (see
 * `scheduleWith`). An exam's written tests come on days of their own where the learner's cadence
 * puts them (every day with lessons, every other week, the final weeks), with the lesson time
 * they get in the study cycle's rotation, so their practice moves without shrinking or growing.
 */
export function scheduleRest(input: RestInput) {
  const spread = scheduleWith({ cadenced: null, input });

  const cadenced =
    input.queue.rates &&
    getCadencedAreas({
      days: input.days,
      schedule: {
        cadence: input.settings.writtenCadence,
        planStart: input.planStart,
        targetDate: input.goal.targetDate,
      },
      scheduled: spread.units,
      written: getWrittenTestAreas(input.graph),
    });

  return cadenced ? scheduleWith({ cadenced, input }) : spread;
}
