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
  /** What a class test's material announces (see `BuildPlanInput.announcements`). */
  announcements?: readonly string[];
  /** The skills any of the learner's answers missed (see `BuildPlanInput.answeredWrongSkillIds`). */
  answeredWrongSkillIds?: ReadonlySet<string>;
  /**
   * The work earlier days left, laid out before `units` (see `placeCarriedWork`): short on time,
   * what of it the cut ranks out gives way (see `scheduleCoresFirst`).
   */
  carried?: readonly QueueUnit[];
  days: readonly PlanDay[];
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  /** Each skill's lessons the plan already holds outside `units` (see `putCoresFirst`). */
  kept: ReadonlyMap<string, number>;
  /** The skills the learner showed they know (see `BuildPlanInput.knownSkillIds`). */
  knownSkillIds?: ReadonlySet<string>;
  /** The skills the learner's last test missed: an exam's study cycle opens with their subjects. */
  missedSkillIds: ReadonlySet<string>;
  /** What an exam's study cycle opens with after the gaps (see `arrangeStudyCycle`). */
  opening: { knownAreas: ReadonlySet<string>; noticeAreas: ReadonlySet<string> | null };
  /** The learn phases' end dates a system refresh keeps (see `keepPhaseEnds`); empty otherwise. */
  phaseEnds: ReadonlyMap<number, Date>;
  planStart: Date;
  /** What `buildPlanQueue` says about the planned skills. */
  queue: {
    focused: ReadonlySet<string>;
    prerequisites: ReadonlyMap<string, readonly string[]>;
    ranks: ReadonlyMap<string, number>;
    rates: ReadonlyMap<string, number> | null;
    values: ReadonlyMap<string, number>;
  };
  settings: PlanSettings;
  /** The notice topics each skill teaches, with how often the exam asks them. */
  topics: ReadonlyMap<string, readonly ScoredTopic[]>;
  units: readonly QueueUnit[];
};

/** Whether a schedule leaves out an outcome lesson the plan keeps (a career's job search). */
function dropsOutcome(schedule: { dropped: readonly QueueUnit[] }): boolean {
  return schedule.dropped.some((unit) => unit.outcome && !unit.depth);
}

/**
 * A plan's units laid out with the phase ends a system run keeps (see `keepPhaseEnds`). A plan
 * short on time leaves lessons out to make room for its outcome work (see `makeRoomForOutcomes`),
 * which kept ends can't do once they hold the phases' challenges on their days: the ends are kept
 * on what that room leaves. A career cut to 15 minutes a day kept its job search, and the next
 * morning's settle left networking and interviews out to keep the phase ends the learner saw;
 * moving them instead moved every end a studied day had shown. When the outcome work still doesn't
 * fit, the ends stay all the same: a shown end never moves without the learner, and Today offers
 * to move the dates, which fits it again (see `updatePhaseDatesProposal`).
 */
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

/** The topics of the skills a class test's announced questions ask about (see `Worth`). */
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

/**
 * The units laid on the days: an exam's as its study cycle (see `arrangeStudyCycle`), with its
 * written tests on days of their own when `cadenced` says so; other goals' in queue order, with
 * the phase ends a system refresh keeps (see `keepPhaseEnds`). Short
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

  // Kept phase ends can fit every lesson of a plan short on time by leaving its last challenge out,
  // which the run that made the plan never did: that isn't whole either (see `keepPhaseEnds`). Nor
  // can they make it fit: they hold each challenge on its day whatever the day's time, so a plan
  // whose lessons don't fit without them read as fitting, skipped the cut its ends were made with,
  // and a career plan's first landing after a new date gained lessons and moved 209 items.
  const keptEnds = input.phaseEnds.size > 0;
  const plain = keptEnds ? scheduleUnits({ days: input.days, units: input.units }) : whole;

  const dropsWork =
    plain.dropped.some((unit) => unit.kind === "lesson") ||
    whole.dropped.some((unit) => unit.kind === "lesson" || (keptEnds && unit.kind === "boss"));

  if (!input.goal.targetDate || !dropsWork) {
    return { ...whole, yielded: [] };
  }

  // A miss anywhere, even one a later right answer claimed again, is missed (R11).
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

/**
 * An exam's units with the skills beyond its notice that nothing planned builds on after
 * everything it asks (see `putBeyondNoticeLast`).
 */
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

/**
 * Schedules what the plan has left to place after this week and the work earlier days left (see
 * `scheduleWith`), an exam's skills beyond its notice after everything it asks (see
 * `putBeyondNoticeUnitsLast`). An exam's written tests come on days of their own where the
 * learner's cadence puts them (every day with lessons, every other week, the final weeks), with the
 * lesson time they get in the study cycle's rotation, so their practice moves without shrinking or
 * growing.
 */
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
