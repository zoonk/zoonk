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
  type ScheduledUnit,
  getCumulativeCapacity,
  makeOutcomeRoom,
  scheduleUnits,
} from "./schedule-units";
import { splitStandIns } from "./stand-in-parts";
import { arrangeStudyCycle } from "./study-cycle";
import { type CadencedArea } from "./study-cycle-lanes";
import { splitIntoParts } from "./study-cycle-parts";
import { rotateTopics } from "./topic-rotation";
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
  /** The plan's whole queue, finished lessons included, in teaching order. */
  order: readonly QueueUnit[];
  phaseEnds: ReadonlyMap<number, Date>;
  planStart: Date;
  queue: {
    focused: ReadonlySet<string>;
    mockPriority?: ReadonlyMap<string, number>;
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

function toQueueUnit({
  beside: _beside,
  date: _date,
  studyMinutes: _studyMinutes,
  studyPortions: _studyPortions,
  teachingEnd: _teachingEnd,
  ...unit
}: ScheduledUnit): QueueUnit {
  return unit;
}

function resetPlacement({
  heldOn: _heldOn,
  opensDay: _opensDay,
  rankedOut: _rankedOut,
  startsAt: _startsAt,
  ...unit
}: ScheduledUnit): QueueUnit {
  return toQueueUnit(unit);
}

function arrangeExamUnits({
  cadenced,
  input,
  mockPriority,
  units,
}: {
  cadenced: ReadonlyMap<string, CadencedArea> | null;
  input: RestInput;
  mockPriority?: (a: QueueUnit, b: QueueUnit) => number;
  units: readonly QueueUnit[];
}) {
  const { graph, queue } = input;
  const gapAreas = getAreasOf({ graph, skillIds: input.missedSkillIds });

  return queue.rates
    ? scheduleUnits({
        days: input.days,
        units: arrangeStudyCycle({
          areaPhases: getCyclePhases({ focusAreas: input.settings.focusAreas, gapAreas, graph }),
          cadenced: cadenced ?? undefined,
          days: input.days,
          firstAreas: gapAreas,
          knownAreas: input.opening.knownAreas,
          mockPriority,
          noticeAreas: input.opening.noticeAreas,
          prerequisites: queue.prerequisites,
          rates: queue.rates,
          units,
        }),
      })
    : scheduleKeepingEnds({ days: input.days, ends: input.phaseEnds, units });
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
  const { queue } = input;

  const schedulePending = (units: readonly QueueUnit[]) =>
    arrangeExamUnits({ cadenced, input, units });

  const rotates = input.goal.kind === "language";

  const arrange = (list: readonly QueueUnit[]) =>
    rotates
      ? rotateTopics({ order: input.order, prerequisites: queue.prerequisites, units: list })
      : list;

  const whole = schedulePending(arrange(input.units));

  const keptEnds = input.phaseEnds.size > 0;
  const plain = keptEnds ? scheduleUnits({ days: input.days, units: input.units }) : whole;

  const dropsWork =
    plain.dropped.some((unit) => unit.kind === "lesson") ||
    whole.dropped.some((unit) => unit.kind === "lesson" || (keptEnds && unit.kind === "boss"));

  if (!input.goal.targetDate || !dropsWork) {
    return { ...whole, yielded: [] };
  }

  const missed = new Set([...input.missedSkillIds, ...(input.answeredWrongSkillIds ?? [])]);

  const cut = scheduleCoresFirst({
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

  if (!rotates) {
    return cut;
  }

  // The cut chooses what fits as it always has; only the lessons it keeps take turns.
  const again = schedulePending(arrange(cut.units.map((unit) => toQueueUnit(unit))));
  return { ...cut, ...again, dropped: [...cut.dropped, ...again.dropped] };
}

/** A missed lesson moves up with the earlier lessons of its shared run, so the run keeps its order. */
function liftSharedRuns(
  units: readonly QueueUnit[],
  priorityOf: (unit: QueueUnit) => number,
): Map<string, number> {
  const highest = new Map<string, number>();

  return new Map(
    units.toReversed().map((unit) => {
      const own = priorityOf(unit);

      if (!unit.sharedRun) {
        return [unit.key, own];
      }

      const priority = Math.max(own, highest.get(unit.sharedRun) ?? 0);
      highest.set(unit.sharedRun, priority);
      return [unit.key, priority];
    }),
  );
}

function prioritizeKeptMisses({
  cadenced,
  input,
  schedule,
}: {
  cadenced: ReadonlyMap<string, CadencedArea> | null;
  input: RestInput;
  schedule: ReturnType<typeof scheduleWith>;
}) {
  const priorities = input.queue.mockPriority;

  if (input.goal.kind !== "exam" || !priorities?.size) {
    return schedule;
  }

  const priorityOf = (unit: QueueUnit) => priorities.get(unit.skillId ?? "") ?? 0;

  if (!schedule.units.some((unit) => priorityOf(unit) > 0)) {
    return schedule;
  }

  const teachingPhases = new Map(input.units.map(({ key, phase }) => [key, phase]));

  const kept = schedule.units.map((unit) => ({
    ...resetPlacement(unit),
    phase: teachingPhases.get(unit.key) ?? unit.phase,
  }));

  const lifted = liftSharedRuns(kept, priorityOf);
  const liftedOf = (unit: QueueUnit) => lifted.get(unit.key) ?? priorityOf(unit);
  const compareMisses = (a: QueueUnit, b: QueueUnit) => liftedOf(b) - liftedOf(a);

  const units = splitIntoParts(kept).flatMap((part) =>
    part.toSorted(
      (a, b) =>
        Number(a.kind === "boss") - Number(b.kind === "boss") ||
        Number(Boolean(b.inProgress)) - Number(Boolean(a.inProgress)) ||
        a.phase - b.phase ||
        compareMisses(a, b),
    ),
  );

  const reordered = arrangeExamUnits({ cadenced, input, mockPriority: compareMisses, units });
  return reordered.dropped.length === 0 ? { ...schedule, units: reordered.units } : schedule;
}

function putBeyondNoticeUnitsLast(input: RestInput): readonly QueueUnit[] {
  if (input.goal.kind !== "exam" || input.queue.rates === null) {
    return input.units;
  }

  const beyond = findBeyondNoticeSkillIds({
    graph: input.graph,
    prerequisites: input.queue.prerequisites,
  });

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

  const schedule = cadenced ? scheduleWith({ cadenced, input }) : spread;
  return prioritizeKeptMisses({ cadenced, input, schedule });
}
