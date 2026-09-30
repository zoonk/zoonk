import { type GoalKind } from "@zoonk/db";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getEndOfWeek,
  getWeeklyEventWeekday,
} from "./plan-calendar";
import {
  DAY_BEFORE_EXAM_MINUTES,
  WEEKLY_CHECKPOINT_MINUTES,
  createExamDays,
  createLearnDays,
  withMovedEvents,
} from "./plan-days";
import { type ExistingPlanItem, type PlannedItem, getItemKey, mergePlanItems } from "./plan-items";
import { getExamWindows, getLearningShare } from "./plan-phases";
import { buildPlanQueue } from "./plan-queue";
import { type PlanGraph, type PlanSettings } from "./plan-state";
import {
  BOSS_MINUTES,
  DEFAULT_LESSON_MINUTES,
  type PlannerLesson,
  type QueueUnit,
} from "./plan-units";
import { scheduleUnits } from "./schedule-units";
import { type SkillReadiness } from "./skill-order";
import { type PlanOutline, summarizePlan } from "./summarize-plan";

/** Ten years is past any real goal at any pace; what doesn't fit by then isn't planned. */
const MAX_PLAN_DAYS = 3650;

/**
 * `forced` re-plans from today: the learner changed something, missed days, or took a test-out.
 * `automatic` keeps this week's items where they are and only moves what comes after, since this
 * week stays stable unless a change clearly helps.
 */
export type PlanningMode = "automatic" | "forced";

export type BuildPlanInput = {
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly ExistingPlanItem[];
  lessons: readonly PlannerLesson[];
  /** The length of the exam's mock in real conditions. */
  mockMinutes: number;
  mode: PlanningMode;
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  /** The learner-local date. */
  today: Date;
};

export type BuiltPlan = PlanOutline & {
  /** Skills the plan can't cover before its deadline at this pace. */
  droppedSkillIds: string[];
  items: PlannedItem[];
};

function getCalendar(input: BuildPlanInput): StudyCalendar {
  return {
    dailyMinutes: input.goal.dailyMinutes,
    lightWeeks: input.settings.lightWeeks,
    weekdayMinutes: input.settings.weekdayMinutes,
  };
}

function getPlanStart(input: BuildPlanInput): Date {
  return input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
}

function isInWeek({ date, today }: { date: Date | null; today: Date }): boolean {
  return date !== null && date >= today && date <= getEndOfWeek(today);
}

/** Finished items always stay; an automatic run also keeps this week's items as they are. */
function splitExistingItems(input: BuildPlanInput) {
  const finished = input.items.filter((item) => item.status !== "todo");

  const frozen =
    input.mode === "automatic"
      ? input.items.filter(
          (item) =>
            item.status === "todo" && isInWeek({ date: item.scheduledFor, today: input.today }),
        )
      : [];

  const keptIds = new Set([...finished, ...frozen].map((item) => item.id));
  const replaced = input.items.filter((item) => !keptIds.has(item.id));

  return { finished, frozen, replaced };
}

/** A finished item done ahead of its date counts as done today once the plan restarts from today. */
function toKeptItem({
  item,
  input,
  minutes,
}: {
  item: ExistingPlanItem;
  input: BuildPlanInput;
  minutes: number;
}): PlannedItem {
  const isFuture = item.scheduledFor !== null && item.scheduledFor > input.today;
  const moveToToday = input.mode === "forced" && item.status !== "todo" && isFuture;

  return {
    ...item,
    key: getItemKey(item),
    minutes,
    scheduledFor: moveToToday ? input.today : item.scheduledFor,
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

/** Study minutes of an item the queue no longer schedules, from its unit when there is one. */
function getKeptMinutes({
  input,
  item,
  units,
}: {
  input: BuildPlanInput;
  item: ExistingPlanItem;
  units: ReadonlyMap<string, QueueUnit>;
}): number {
  const unit = units.get(getItemKey(item));
  const share = getLearningShare({ phaseKind: "learn", practiceBias: input.settings.practiceBias });

  const byKind: Record<ExistingPlanItem["kind"], number> = {
    boss: BOSS_MINUTES,
    chapter: 0,
    checkpoint: WEEKLY_CHECKPOINT_MINUTES,
    lesson: (unit?.minutes ?? DEFAULT_LESSON_MINUTES * input.paceFactor) / share,
    mock: input.mockMinutes,
    review: DAY_BEFORE_EXAM_MINUTES,
  };

  return byKind[item.kind];
}

/**
 * Plans a goal from its skill graph, the Library's lessons for those skills and the learner's
 * time: the lessons in teaching order (exam plans by priority), phase checkpoints, weekly
 * checkpoints or mocks, and review days, each with a date. Finished work is never undone and an
 * automatic run leaves this week alone. Pure: the same inputs always give the same plan.
 */
export function buildPlan(input: BuildPlanInput): BuiltPlan {
  const planStart = getPlanStart(input);
  const { finished, frozen, replaced } = splitExistingItems(input);
  const queue = buildPlanQueue(input);
  const unitsByKey = new Map(queue.map((unit) => [unit.key, unit]));
  const keptKeys = new Set([...finished, ...frozen].map((item) => getItemKey(item)));
  const start = getScheduleStart({ frozen, input });
  const days = createDays({ input, planStart });
  const { windows } = days;

  const describeDay = withMovedEvents({
    describeDay: days.describeDay,
    moves: input.settings.movedEvents,
  });

  const schedule = scheduleUnits({
    describeDay,
    horizonDays: getHorizonDays({ input, start }),
    start,
    units: queue.filter((unit) => !keptKeys.has(unit.key)),
  });

  const lastLessonDate = schedule.units.at(-1)?.date ?? null;

  const events =
    windows.length > 0
      ? schedule.events
      : schedule.events.filter((event) => lastLessonDate && event.date <= lastLessonDate);

  const kept = [...finished, ...frozen].map((item) =>
    toKeptItem({ input, item, minutes: getKeptMinutes({ input, item, units: unitsByKey }) }),
  );

  const items = mergePlanItems({ events, kept, replaced, units: schedule.units });

  return {
    ...summarizePlan({ graph: input.graph, items, scheduleStart: start, windows }),
    droppedSkillIds: [
      ...new Set(schedule.dropped.flatMap((unit) => (unit.skillId ? [unit.skillId] : []))),
    ],
    items,
  };
}
