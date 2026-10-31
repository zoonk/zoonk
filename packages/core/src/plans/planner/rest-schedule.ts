import { type GoalKind } from "@zoonk/db";
import { findAnnouncedSkillIds } from "./announced-lessons";
import {
  findBeyondNoticeBases,
  findBeyondNoticeSkillIds,
  putBeyondNoticeLast,
} from "./beyond-notice-skills";
import { getCadencedAreas } from "./cadenced-areas";
import { putCoresFirst } from "./core-first";
import { getAreasOf, getCyclePhases, getWrittenTestAreas } from "./graph-areas";
import { keepPhaseEnds } from "./kept-phase-ends";
import { scheduleCoresFirst } from "./least-worth-cores";
import { type PlanGraph, type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import {
  type PlanDay,
  getCumulativeCapacity,
  makeOutcomeRoom,
  scheduleUnits,
} from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";
import { arrangeStudyCycle } from "./study-cycle";
import { type CadencedArea } from "./study-cycle-lanes";
import { type ScoredTopic, getAskedScore } from "./topic-weights";

type RestInput = {
  announcements?: readonly string[];
  answeredWrongSkillIds?: ReadonlySet<string>;
  carried?: readonly QueueUnit[];
  days: readonly PlanDay[];
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  kept: ReadonlyMap<string, number>;
  knownSkillIds?: ReadonlySet<string>;
  missedSkillIds: ReadonlySet<string>;
  opening: { knownAreas: ReadonlySet<string>; noticeAreas: ReadonlySet<string> | null };
  phaseEnds: ReadonlyMap<number, Date>;
  planStart: Date;
  queue: {
    focused: ReadonlySet<string>;
    prerequisites: ReadonlyMap<string, readonly string[]>;
    ranks: ReadonlyMap<string, number>;
    rates: ReadonlyMap<string, number> | null;
    values: ReadonlyMap<string, number>;
  };
  settings: PlanSettings;
  topics: ReadonlyMap<string, readonly ScoredTopic[]>;
  units: readonly QueueUnit[];
};

function dropsOutcome(schedule: { dropped: readonly QueueUnit[] }): boolean {
  return schedule.dropped.some((unit) => unit.outcome && !unit.depth);
}

function scheduleKeepingEnds({
  days,
  ends,
  units,
}: {
  days: readonly PlanDay[];
  ends: ReadonlyMap<number, Date>;
  units: readonly QueueUnit[];
}) {
  const kept = scheduleUnits({ days, units: keepPhaseEnds({ days, ends, units }) });

  if (ends.size === 0 || !dropsOutcome(kept)) {
    return kept;
  }

  const room = makeOutcomeRoom({ cumulative: getCumulativeCapacity(days), units });
  const roomy = scheduleUnits({ days, units: keepPhaseEnds({ days, ends, units: room.kept }) });

  if (dropsOutcome(roomy)) {
    return kept;
  }

  return {
    ...roomy,
    dropped: [...room.leftOut.map((unit) => ({ ...unit, fittedMinutes: 0 })), ...roomy.dropped],
  };
}

function listAnnouncedTopics({
  announcements = [],
  graph,
  topics,
}: Pick<RestInput, "announcements" | "graph" | "topics">): Set<string> {
  const skillIds = findAnnouncedSkillIds({ announcements, skills: graph.skills });

  return new Set(
    [...skillIds].flatMap((skillId) => (topics.get(skillId) ?? []).map((topic) => topic.key)),
  );
}

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
    queue.rates
      ? scheduleUnits({
          days: input.days,
          units: arrangeStudyCycle({
            areaPhases: getCyclePhases({ focusAreas: input.settings.focusAreas, gapAreas, graph }),
            cadenced: cadenced ?? undefined,
            days: input.days,
            firstAreas: gapAreas,
            knownAreas: input.opening.knownAreas,
            noticeAreas: input.opening.noticeAreas,
            prerequisites: queue.prerequisites,
            rates: queue.rates,
            units: list,
          }),
        })
      : scheduleKeepingEnds({ days: input.days, ends: input.phaseEnds, units: list });

  const whole = schedulePending(input.units);

  const keptEnds = input.phaseEnds.size > 0;
  const plain = keptEnds ? scheduleUnits({ days: input.days, units: input.units }) : whole;

  const dropsWork =
    plain.dropped.some((unit) => unit.kind === "lesson") ||
    whole.dropped.some((unit) => unit.kind === "lesson" || (keptEnds && unit.kind === "boss"));

  if (!input.goal.targetDate || !dropsWork) {
    return { ...whole, yielded: [] };
  }

  const missed = new Set([...input.missedSkillIds, ...(input.answeredWrongSkillIds ?? [])]);

  return scheduleCoresFirst({
    carried: input.carried,
    schedulePending,
    units: splitStandIns(
      putCoresFirst(input.units, {
        askedOf: getAskedScore(input.topics),
        kept: input.kept,
        ranks: queue.ranks,
        wholeOutcomes: input.goal.kind !== "exam",
      }),
    ),
    worth: queue.rates && {
      announcedTopics: listAnnouncedTopics(input),
      focused: queue.focused,
      gaps: missed,
      known: new Set([...(input.knownSkillIds ?? [])].filter((skillId) => !missed.has(skillId))),
      prerequisites: queue.prerequisites,
      topics: input.topics,
      values: queue.values,
    },
  });
}

function putBeyondNoticeUnitsLast(input: RestInput): readonly QueueUnit[] {
  if (input.goal.kind !== "exam" || input.queue.rates === null) {
    return input.units;
  }

  const beyond = findBeyondNoticeSkillIds(input.graph);
  const planned = new Set(input.units.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])));

  return putBeyondNoticeLast(input.units, {
    bases: findBeyondNoticeBases({ beyond, planned, prerequisites: input.queue.prerequisites }),
    beyond,
  });
}

export function scheduleRest(rest: RestInput) {
  const input = { ...rest, units: putBeyondNoticeUnitsLast(rest) };
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
