import { type GoalKind } from "@zoonk/db";
import { type TopicLevel, type TopicPart } from "../../library/exams/topic-frequency";
import {
  type CarryOver,
  listCarriedKeys,
  reserveCarriedTime,
  splitCarriedUnits,
} from "./carry-over";
import { countKeptLessons, getKeptMinutes, splitExistingItems, toKeptItem } from "./kept-items";
import { placeLandedThisWeek } from "./landed-lessons";
import { placeItemsInPhaseTime } from "./phase-time";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getEndOfWeek,
  getWeeklyEventWeekday,
} from "./plan-calendar";
import { createExamDays, createLearnDays, withMovedEvents } from "./plan-days";
import { getLastLessonDate, getPlanEvents } from "./plan-events";
import {
  type ExistingPlanItem,
  type PlannedItem,
  fromUnit,
  getItemKey,
  mergePlanItems,
} from "./plan-items";
import { getExamWindows } from "./plan-phases";
import { buildPlanQueue } from "./plan-queue";
import { type PlanGraph, type PlanSettings } from "./plan-state";
import { type PlannerLesson, type QueueUnit } from "./plan-units";
import { withoutRepeatedTitles } from "./repeated-titles";
import { scheduleRest } from "./rest-schedule";
import { type DroppedUnit, listPlanDays, scheduleUnits } from "./schedule-units";
import { type SkillReadiness } from "./skill-order";
import { joinStandIns } from "./stand-in-parts";
import { type PlanOutline, summarizePlan } from "./summarize-plan";
import { getSkillParts, scoreSkillTopics } from "./topic-weights";

/** Ten years is past any real goal at any pace; what doesn't fit by then isn't planned. */
const MAX_PLAN_DAYS = 3650;

/**
 * `forced` re-plans from today: the learner changed something, missed days, or took a test-out.
 * `automatic` keeps this week's items where they are and only moves what comes after, since this
 * week stays stable unless a change clearly helps.
 */
export type PlanningMode = "automatic" | "forced";

export type BuildPlanInput = {
  /**
   * What the questions a class test's own material announces ask ("Dissertativa sobre osmose"): a
   * plan short on time keeps the lessons on them (see `findAnnouncedLessonIds`). Absent for goals
   * without the learner's own material.
   */
  announcements?: readonly string[];
  /**
   * A new day's settling (`forced` only): the work earlier days left comes first, in the order it
   * was planned, and the rest of the plan fills the days after it (see `CarryOver`).
   */
  carryOver?: CarryOver | null;
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly ExistingPlanItem[];
  /**
   * The exam's parts the learner said they already know (onboarding's known subjects, or past the
   * basics): an exam's study cycle opens with the others. Absent when they named none.
   */
  knownAreas?: ReadonlySet<string>;
  lessons: readonly PlannerLesson[];
  /**
   * The skills the learner's last answer in a test (placement, the focus test, a chapter test)
   * missed or didn't know: an exam's study cycle opens with their subjects.
   */
  missedSkillIds?: ReadonlySet<string>;
  /** The length of the exam's mock in real conditions. */
  mockMinutes: number;
  /**
   * The areas that are parts of the exam's notice, whose shares of it weigh the plan: an exam's
   * study cycle opens with them before areas beyond it (exam strategy). Null without a notice.
   */
  noticeAreas?: ReadonlySet<string> | null;
  mode: PlanningMode;
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  /**
   * The areas the learner is doing well in. A plan made harder starts past their foundations;
   * only read then, so plans that aren't can leave it out.
   */
  strongAreas?: ReadonlySet<string>;
  /** The learner-local date. */
  today: Date;
  /**
   * Today's session was built: the learner was shown the day, so an automatic run puts on it no
   * more than the time its stand-ins held (see `placeLandedThisWeek`). Absent when it wasn't.
   */
  todayShown?: boolean;
  /**
   * How often the exam asks its notice's topics (see `listTopicLevels`): a plan short on time keeps
   * the topics asked most. Absent for goals that aren't exams with a notice.
   */
  topicLevels?: readonly TopicLevel[];
  /**
   * The part of its subject each notice topic is listed under (ENEM's Física, Química and
   * Biologia): a plan short on time keeps every part's most asked topic. Absent when the notice
   * doesn't group its topics.
   */
  topicParts?: readonly TopicPart[];
};

/** A skill's lesson minutes: the ones the plan covers (done, kept or scheduled) and all of them. */
type SkillMinutes = { covered: number; skillId: string; total: number };

export type BuiltPlan = PlanOutline & {
  /** Skills the plan can't cover whole before its deadline at this pace. */
  droppedSkillIds: string[];
  items: PlannedItem[];
  /** Each planned skill's minutes, covered and in all, for what share of the goal fits. */
  skillMinutes: SkillMinutes[];
  /**
   * Skills whose core doesn't fit before the deadline, so the plan doesn't reach them at all: only
   * when every other skill's core takes the time (see `putCoresFirst`).
   */
  waitingSkillIds: string[];
};

function getPlanStart(input: BuildPlanInput): Date {
  return input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
}

function getCalendar(input: BuildPlanInput): StudyCalendar {
  return {
    dailyMinutes: input.goal.dailyMinutes,
    firstDay: getPlanStart(input),
    lightWeeks: input.settings.lightWeeks,
    weekdayMinutes: input.settings.weekdayMinutes,
  };
}

function getScheduleStart({
  frozen,
  input,
}: {
  frozen: readonly unknown[];
  input: BuildPlanInput;
}) {
  return frozen.length > 0 ? addDays(getEndOfWeek(input.today), 1) : input.today;
}

function createDays({ input, planStart }: { input: BuildPlanInput; planStart: Date }) {
  const calendar = getCalendar(input);
  const eventWeekday = getWeeklyEventWeekday(calendar);
  const { practiceBias } = input.settings;
  const { targetDate } = input.goal;

  if (input.goal.kind === "exam" && targetDate) {
    const windows = getExamWindows({ planStart, targetDate });

    return {
      describeDay: createExamDays({
        calendar,
        eventWeekday,
        mockMinutes: input.mockMinutes,
        practiceBias,
        rules: { planStart, shortMockMinutes: input.settings.shortMockMinutes },
        targetDate,
        windows,
      }),
      windows,
    };
  }

  return {
    describeDay: createLearnDays({
      calendar,
      eventWeekday,
      practiceBias,
      start: planStart,
      targetDate,
    }),
    windows: [],
  };
}

function getHorizonDays({ input, start }: { input: BuildPlanInput; start: Date }): number {
  const { targetDate } = input.goal;
  return targetDate ? Math.min(MAX_PLAN_DAYS, daysBetween(start, targetDate)) : MAX_PLAN_DAYS;
}

/**
 * Each skill's lesson minutes: the kept ones (done, or this week's) and the pending ones, less
 * what of the dropped ones doesn't fit before the deadline.
 */
function getSkillMinutes({
  dropped,
  kept,
  pending,
}: {
  dropped: readonly DroppedUnit[];
  kept: readonly QueueUnit[];
  pending: readonly QueueUnit[];
}): SkillMinutes[] {
  const parts = [
    ...[...kept, ...pending].map((unit) => ({ covered: unit.minutes, total: unit.minutes, unit })),
    ...dropped.map((unit) => ({ covered: unit.fittedMinutes - unit.minutes, total: 0, unit })),
  ].flatMap(({ covered, total, unit }) =>
    unit.kind === "lesson" && unit.skillId ? [{ covered, skillId: unit.skillId, total }] : [],
  );

  return [...Map.groupBy(parts, (part) => part.skillId)].map(([skillId, group]) => ({
    covered: group.reduce((sum, part) => sum + part.covered, 0),
    skillId,
    total: group.reduce((sum, part) => sum + part.total, 0),
  }));
}

/**
 * Plans a goal from its skill graph, the Library's lessons for those skills and the learner's
 * time: the lessons in teaching order (an exam's as a study cycle of a few subjects a day; see
 * `arrangeStudyCycle`), phase checkpoints, weekly checkpoints or mocks, and review days, each with
 * a date. When the time before the deadline doesn't fit every lesson, every skill's core comes
 * first and the rest adds depth (see `putCoresFirst`), so no topic is left out while another gets
 * its depth. Finished work is never undone and an automatic run leaves this week alone. Pure: the
 * same inputs always give the same plan.
 */
export function buildPlan(input: BuildPlanInput): BuiltPlan {
  const planStart = getPlanStart(input);

  const {
    finished,
    frozen,
    landed: landedStandIns,
    replaced,
    thisWeek,
  } = splitExistingItems(input);

  const {
    focused,
    prerequisites,
    ranks,
    rates,
    recalled,
    units: queue,
    values,
  } = buildPlanQueue(input);

  const unitsByKey = new Map(queue.map((unit) => [unit.key, unit]));
  const keptKeys = new Set([...finished, ...frozen].map((item) => getItemKey(item)));
  const start = getScheduleStart({ frozen, input });
  const days = createDays({ input, planStart });
  const { windows } = days;

  const describeDay = withMovedEvents({
    describeDay: days.describeDay,
    moves: input.settings.movedEvents,
  });

  const planDays = listPlanDays({
    describeDay,
    horizonDays: getHorizonDays({ input, start }),
    start,
  });

  const unplaced = withoutRepeatedTitles({
    kept: [...finished, ...frozen],
    units: queue.filter((unit) => !keptKeys.has(unit.key)),
  });

  const landed = placeLandedThisWeek({
    describeDay,
    frozen,
    input,
    pending: unplaced,
    standIns: landedStandIns,
    start,
    units: unitsByKey,
  });

  const landedKeys = new Set(landed.map((unit) => unit.key));
  const pending = unplaced.filter((unit) => !landedKeys.has(unit.key));

  // What earlier days left comes first, as it was planned; the rest fills the time after it.
  const { carried, rest } = splitCarriedUnits({
    keys: input.mode === "forced" ? listCarriedKeys(input) : [],
    units: pending,
  });

  const carriedSchedule = scheduleUnits({ days: planDays, units: carried });

  const restDays = reserveCarriedTime({
    days: planDays,
    minutes: carried.reduce((total, unit) => total + unit.minutes, 0),
  });

  const restSchedule = scheduleRest({
    days: restDays,
    goal: input.goal,
    graph: input.graph,
    kept: countKeptLessons({ kept: [...finished, ...frozen], lessons: carried, units: unitsByKey }),
    missedSkillIds: input.missedSkillIds ?? new Set(),
    opening: { knownAreas: input.knownAreas ?? new Set(), noticeAreas: input.noticeAreas ?? null },
    parts: getSkillParts({ graph: input.graph, parts: input.topicParts ?? [] }),
    planStart,
    queue: { focused, prerequisites, ranks, rates, recalled, values },
    settings: input.settings,
    topics: scoreSkillTopics({ graph: input.graph, levels: input.topicLevels ?? [] }),
    units: rest,
  });

  const schedule = {
    dropped: [...carriedSchedule.dropped, ...restSchedule.dropped],
    events: restSchedule.events,
    units: [...landed, ...carriedSchedule.units, ...restSchedule.units],
  };

  const lastLessonDate = getLastLessonDate({ kept: thisWeek, units: schedule.units });

  // A plan with a date keeps its weekly checkpoints until then, and the days after its last lesson
  // are practice days, so lessons that end weeks early never leave empty weeks before the date. A
  // test days away keeps its own short plan.
  const events = getPlanEvents({
    days: planDays,
    events: schedule.events,
    input,
    lastLessonDate,
    lastUnitDate: schedule.units.at(-1)?.date ?? null,
    planStart,
  });

  // This week keeps its order: a stand-in's outlined lessons take its place in it.
  const landedBySkill = Map.groupBy(landed, (unit) => unit.skillId ?? "");

  const kept = [...finished, ...thisWeek].flatMap((item) =>
    landedStandIns.includes(item)
      ? (landedBySkill.get(item.skillId ?? "") ?? []).map((unit) => fromUnit(unit))
      : [toKeptItem({ input, item, minutes: getKeptMinutes({ input, item, units: unitsByKey }) })],
  );

  const merged = mergePlanItems({ events, kept, replaced, units: joinStandIns(schedule.units) });

  // An exam's lessons already belong to the phase of the day they're due; a learn plan's late ones
  // (depth studied once every core is in) join the phase whose time they fall in.
  const items = windows.length > 0 ? merged : placeItemsInPhaseTime(merged);

  return {
    ...summarizePlan({ graph: input.graph, items, scheduleStart: start, windows }),
    droppedSkillIds: [
      ...new Set(schedule.dropped.flatMap((unit) => (unit.skillId ? [unit.skillId] : []))),
    ],
    items,
    skillMinutes: getSkillMinutes({
      dropped: schedule.dropped,
      kept: queue.filter((unit) => keptKeys.has(unit.key)),
      pending: unplaced,
    }),
    waitingSkillIds: [
      ...new Set(
        schedule.dropped.flatMap((unit) => (unit.skillId && !unit.depth ? [unit.skillId] : [])),
      ),
    ],
  };
}
