import { type PlanItemKind, type PlanItemStatus } from "../../../../generated/prisma/client";
import { type SeedCourse } from "../library/types";
import { type SeedGoal, type SeedPlanItem } from "./types";

/*
 * The planner's rules for plans without exam phases (`packages/core/src/plans/planner`), so a
 * seeded plan is the one the app computes from its skill graph: a lesson of the graph's size is 3
 * minutes of new learning, which gets half of each day's time (reviews and practice take the
 * rest); a skill the Library outlined in part keeps the graph's size while a chapter's worth of its
 * lessons (4) is missing; each phase closes with a 10-minute phase checkpoint (`boss`); and every
 * Sunday from the plan's second week holds a 15-minute weekly challenge (`checkpoint`).
 */
const LESSON_MINUTES = 3;
const LEARNING_SHARE = 0.5;
const BOSS_MINUTES = 10;
const WEEKLY_CHECKPOINT_MINUTES = 15;
const MIN_STAND_IN_LESSONS = 4;
const DAYS_PER_WEEK = 7;
const SUNDAY = 0;
const MAX_PLAN_DAYS = 3650;

/** Floating-point sums of lesson minutes must not push a lesson to the next day. */
const EPSILON = 1e-6;

/**
 * A skill of the goal's graph, by key, with its phase, the graph's size in lessons and the first
 * plan lesson that teaches it.
 */
type GoalSkill = { key: string; lesson: string; lessons: number; phase: number };

/** A Library lesson that teaches some of the goal's skills. */
type CourseLesson = { key: string; minutes: number; skills: readonly string[] };

/** One thing to do in order, as the planner queues it: a lesson, a skill's stand-in or a boss. */
type Unit = {
  key: string;
  kind: "boss" | "lesson";
  lesson?: string;
  minutes: number;
  phase: number;
  skill?: string;
};

/**
 * A plan item as the seed writes it. `source` is the persona's item it comes from, so ids and
 * references (a session's lesson, a boss's badge) stay the same; items the schedule planned have
 * none. `minutes` is its study time, reviews and practice around a lesson included.
 */
export type ScheduledItem = {
  chapter?: string;
  day: number;
  key: string;
  kind: PlanItemKind;
  lesson?: string;
  minutes: number;
  phase: number;
  skill?: string;
  source?: number;
  status: PlanItemStatus;
  title?: string;
};

export type ScheduledPhase = {
  endDay: number | null;
  milestone: string | null;
  minutes: number;
  name: string;
  startDay: number | null;
};

export type PlanSchedule = {
  items: ScheduledItem[];
  phases: ScheduledPhase[];
  totalMinutes: number;
};

/** The course's lessons in course order: chapters as listed, then lessons without a chapter. */
function listCourseLessons(course: SeedCourse): CourseLesson[] {
  return [
    ...course.chapters.flatMap((chapter) => chapter.lessons),
    ...(course.explanations ?? []),
  ].map((lesson) => ({ key: lesson.key, minutes: lesson.minutes, skills: lesson.skills }));
}

function itemLessonKeys(course: SeedCourse, item: SeedPlanItem): string[] {
  if (item.lesson) {
    return [item.lesson];
  }

  const chapter = item.chapter ? course.chapters.find((entry) => entry.key === item.chapter) : null;
  return chapter ? chapter.lessons.map((lesson) => lesson.key) : [];
}

function taughtLessons(lessons: readonly CourseLesson[], skill: string) {
  return lessons.filter((lesson) => lesson.skills.includes(skill));
}

/**
 * The lessons a skill's stand-in plans: all of them when the Library has none, the rest when a
 * chapter's worth or more is missing, otherwise none.
 */
function countStandInLessons({ lessons, taught }: { lessons: number; taught: number }) {
  if (taught === 0) {
    return lessons;
  }

  const missing = lessons - taught;
  return missing >= MIN_STAND_IN_LESSONS ? missing : 0;
}

/**
 * The goal's skill graph in plan order: every skill the persona's plan items teach (a chapter
 * teaches all of its lessons' skills), once each, with the size the persona gives it or, when it
 * gives none, the lessons the Library has for it.
 */
export function listGoalSkills(goal: SeedGoal): GoalSkill[] {
  const lessons = listCourseLessons(goal.course);
  const sizes = goal.plan.skillLessons ?? {};

  const skills = goal.plan.items.flatMap((item) =>
    itemLessonKeys(goal.course, item).flatMap((lessonKey) => {
      const skillKeys = lessons.find((lesson) => lesson.key === lessonKey)?.skills ?? [];

      return skillKeys.map((key) => ({
        key,
        lesson: lessonKey,
        lessons: sizes[key] ?? taughtLessons(lessons, key).length,
        phase: item.phase,
      }));
    }),
  );

  return skills.filter(
    (skill, index) => skills.findIndex((other) => other.key === skill.key) === index,
  );
}

/** The weekday of a day relative to today, Sunday first. */
function weekdayOf(todayWeekday: number, day: number): number {
  return (((todayWeekday + day) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** Weeks run Monday to Sunday: the days until this week's Sunday. */
function endOfWeek(todayWeekday: number): number {
  return todayWeekday === SUNDAY ? 0 : DAYS_PER_WEEK - todayWeekday;
}

/** A plan item the persona wrote as already on the plan: finished, or due this week. */
function isOnPlan(item: SeedPlanItem, weekEnd: number): boolean {
  if (item.status !== "todo") {
    return true;
  }

  if (item.day !== undefined && item.day < 0) {
    throw new Error("A seeded plan item still to do can't be due before today");
  }

  return item.day !== undefined && item.day <= weekEnd;
}

type PlanContext = {
  goal: SeedGoal;
  lessons: CourseLesson[];
  skills: GoalSkill[];
  todayWeekday: number;
};

/** The stand-ins of the skills a test-out covered: it settles each skill whole. */
function listSettledStandIns({
  context,
  item,
  lessonKeys,
}: {
  context: PlanContext;
  item: SeedPlanItem;
  lessonKeys: readonly string[];
}): ScheduledItem[] {
  const covered = new Set(
    context.lessons
      .filter((lesson) => lessonKeys.includes(lesson.key))
      .flatMap((lesson) => lesson.skills),
  );

  return context.skills
    .filter(
      (skill) =>
        covered.has(skill.key) &&
        countStandInLessons({
          lessons: skill.lessons,
          taught: taughtLessons(context.lessons, skill.key).length,
        }) > 0,
    )
    .map((skill) => ({
      day: item.day ?? 0,
      key: `skill:${skill.key}`,
      kind: "lesson" as const,
      minutes: 0,
      phase: item.phase,
      skill: skill.key,
      status: item.status,
    }));
}

/**
 * The persona's items already on the plan, as the planner stores them: a chapter as its lessons,
 * and a test-out with the stand-ins of the skills it settled.
 */
function listKeptItems(context: PlanContext): ScheduledItem[] {
  const { goal, todayWeekday } = context;
  const weekEnd = endOfWeek(todayWeekday);

  return goal.plan.items.flatMap((item, source): ScheduledItem[] => {
    if (!isOnPlan(item, weekEnd)) {
      return [];
    }

    const base = { day: item.day ?? 0, phase: item.phase, status: item.status };

    if (!item.lesson && !item.chapter) {
      // The planner knows a boss by its phase and other fixed events by their day.
      const key = item.kind === "boss" ? `boss:${item.phase}` : `${item.kind}:${base.day}`;
      return [{ ...base, key, kind: item.kind, minutes: 0, source, title: item.title }];
    }

    const lessonKeys = itemLessonKeys(goal.course, item);

    const lessonItems = lessonKeys.map((lesson) => ({
      ...base,
      chapter: item.chapter,
      key: `lesson:${lesson}`,
      kind: "lesson" as const,
      lesson,
      minutes: 0,
      source: item.chapter ? undefined : source,
    }));

    return item.status === "testedOut"
      ? [...lessonItems, ...listSettledStandIns({ context, item, lessonKeys })]
      : lessonItems;
  });
}

/** Skills a test-out settled whole: the plan leaves all of their lessons out. */
function listSettledSkills(kept: readonly ScheduledItem[]): Set<string> {
  return new Set(
    kept.flatMap((item) => (item.skill && item.status !== "todo" ? [item.skill] : [])),
  );
}

/**
 * The plan's lessons in order, phase by phase: each skill's Library lessons (a lesson shared by
 * several skills only under the first), then a stand-in for the part not outlined yet, and a boss
 * closing each phase. Skills a test-out settled stay out. An explanation has no phase to close.
 */
function buildQueue({
  context,
  settled,
}: {
  context: PlanContext;
  settled: ReadonlySet<string>;
}): Unit[] {
  const { goal, lessons } = context;

  const skills = context.skills
    .filter((skill) => !settled.has(skill.key))
    .toSorted((a, b) => a.phase - b.phase);

  const firstSkill = new Map<string, string>();

  lessons.forEach((lesson) => {
    const skill = skills.find((entry) => lesson.skills.includes(entry.key));

    if (skill && !firstSkill.has(lesson.key)) {
      firstSkill.set(lesson.key, skill.key);
    }
  });

  const units = skills.flatMap((skill): Unit[] => {
    const taught = taughtLessons(lessons, skill.key);
    const missing = countStandInLessons({ lessons: skill.lessons, taught: taught.length });

    const own = taught
      .filter((lesson) => firstSkill.get(lesson.key) === skill.key)
      .map((lesson) => ({
        key: `lesson:${lesson.key}`,
        kind: "lesson" as const,
        lesson: lesson.key,
        minutes: lesson.minutes,
        phase: skill.phase,
      }));

    const standIn = {
      key: `skill:${skill.key}`,
      kind: "lesson" as const,
      minutes: missing * LESSON_MINUTES,
      phase: skill.phase,
      skill: skill.key,
    };

    return missing > 0 ? [...own, standIn] : own;
  });

  if (goal.kind === "explain") {
    return units;
  }

  return units.flatMap((unit, index) =>
    units[index + 1]?.phase === unit.phase
      ? [unit]
      : [
          unit,
          {
            key: `boss:${unit.phase}`,
            kind: "boss" as const,
            minutes: BOSS_MINUTES * LEARNING_SHARE,
            phase: unit.phase,
          },
        ],
  );
}

type Calendar = {
  daily: number;
  firstCheckpoint: number;
  targetDay: number | null;
  todayWeekday: number;
};

function isCheckpointDay(calendar: Calendar, day: number): boolean {
  const open = calendar.targetDay === null || day < calendar.targetDay;

  return (
    open && day >= calendar.firstCheckpoint && weekdayOf(calendar.todayWeekday, day) === SUNDAY
  );
}

/** The minutes a day gives new lessons: its time, less a weekly challenge, times the share. */
function lessonCapacity(calendar: Calendar, day: number): number {
  if (calendar.targetDay !== null && day >= calendar.targetDay) {
    return 0;
  }

  const events = isCheckpointDay(calendar, day) ? WEEKLY_CHECKPOINT_MINUTES : 0;
  return Math.max(0, calendar.daily - events) * LEARNING_SHARE;
}

/**
 * The day each unit is due, from `start`: the first whose cumulative time covers it. A boss closes
 * its day. Units that don't fit before the horizon aren't planned.
 */
function placeUnits({
  calendar,
  start,
  units,
}: {
  calendar: Calendar;
  start: number;
  units: readonly Unit[];
}): { day: number; unit: Unit }[] {
  const horizon =
    calendar.targetDay === null
      ? MAX_PLAN_DAYS
      : Math.min(MAX_PLAN_DAYS, calendar.targetDay - start);

  const placed: { day: number; unit: Unit }[] = [];
  let day = start - 1;
  let covered = 0;
  let used = 0;

  for (const unit of units) {
    const needed = used + unit.minutes;

    while (covered + EPSILON < needed && day < start + horizon - 1) {
      day += 1;
      covered += lessonCapacity(calendar, day);
    }

    if (covered + EPSILON < needed) {
      break;
    }

    placed.push({ day, unit });
    used = unit.kind === "boss" ? Math.max(needed, covered) : needed;
  }

  return placed;
}

/**
 * Places what's left the way the plan screen re-plans it: this week's items stay where they are
 * and the rest goes from next Monday. When nothing is due this week yet, this week's part is
 * planned from today first, so planning again gives the same plan.
 */
function placeAfterThisWeek({
  calendar,
  frozen,
  units,
  weekEnd,
}: {
  calendar: Calendar;
  frozen: boolean;
  units: readonly Unit[];
  weekEnd: number;
}) {
  const nextMonday = weekEnd + 1;

  if (frozen) {
    return {
      placed: placeUnits({ calendar, start: nextMonday, units }),
      scheduleStart: nextMonday,
    };
  }

  const fromToday = placeUnits({ calendar, start: 0, units });
  const thisWeek = fromToday.filter(({ day }) => day <= weekEnd);

  if (thisWeek.length === 0) {
    return { placed: fromToday, scheduleStart: 0 };
  }

  const rest = units.filter((unit) => !thisWeek.some((entry) => entry.unit === unit));

  return {
    placed: [...thisWeek, ...placeUnits({ calendar, start: nextMonday, units: rest })],
    scheduleStart: nextMonday,
  };
}

/**
 * Study minutes of an item already on the plan: a lesson's from its unit (a lesson the plan no
 * longer queues counts as one of the graph's size), a boss's or weekly challenge's own. Mocks and
 * reviews belong to exam plans, which this schedule doesn't plan.
 */
function getKeptMinutes(item: ScheduledItem, units: ReadonlyMap<string, Unit>): number {
  const byKind: Record<PlanItemKind, number> = {
    boss: BOSS_MINUTES,
    chapter: 0,
    checkpoint: WEEKLY_CHECKPOINT_MINUTES,
    lesson: (units.get(item.key)?.minutes ?? LESSON_MINUTES) / LEARNING_SHARE,
    mock: 0,
    review: 0,
  };

  return byKind[item.kind];
}

const RANK = { event: 2, kept: 0, unit: 1 } as const;

/** By day; on one day, what's already on the plan first, then lessons in order, events last. */
function mergeItems(ranked: readonly { item: ScheduledItem; rank: number }[]): ScheduledItem[] {
  const sorted = ranked
    .toSorted((a, b) => a.item.day - b.item.day || a.rank - b.rank)
    .map(({ item }) => item);

  // Weekly challenges belong to the phase of the lessons before them.
  const firstPhase = sorted.find((item) => item.phase >= 0)?.phase ?? 0;

  return sorted.reduce<ScheduledItem[]>((merged, item) => {
    const previous = merged.at(-1)?.phase ?? firstPhase;
    merged.push(item.phase < 0 ? { ...item, phase: previous } : item);
    return merged;
  }, []);
}

/**
 * Where a phase with work left starts: the day after the one before it ends, or, for the plan's
 * first phase, the day its first item was due or this run's schedule starts, whichever is earlier.
 */
function getPhaseStart({
  inPhase,
  scheduleStart,
  summarized,
}: {
  inPhase: readonly ScheduledItem[];
  scheduleStart: number;
  summarized: readonly ScheduledPhase[];
}): number | undefined {
  if (summarized.length === 0) {
    return Math.min(scheduleStart, ...inPhase.map((item) => item.day));
  }

  const previousEnd = summarized.findLast((entry) => entry.endDay !== null)?.endDay;
  return previousEnd === undefined || previousEnd === null ? undefined : previousEnd + 1;
}

/**
 * Phases run one after another: a phase with work left starts the day after the one before it
 * ends (the first phase when the plan does) and ends when its last item is due; a finished phase
 * keeps the days of its items.
 */
function summarizePhases({
  goal,
  items,
  scheduleStart,
}: {
  goal: SeedGoal;
  items: readonly ScheduledItem[];
  scheduleStart: number;
}): ScheduledPhase[] {
  return goal.plan.phases.reduce<ScheduledPhase[]>((summarized, phase, index) => {
    const inPhase = items.filter((item) => item.phase === index);
    const todo = inPhase.filter((item) => item.status === "todo");

    const days = (todo.length > 0 ? todo : inPhase)
      .map((item) => item.day)
      .toSorted((a, b) => a - b);

    const phaseStart = getPhaseStart({ inPhase, scheduleStart, summarized });
    const start = todo.length > 0 && phaseStart !== undefined ? phaseStart : days[0];
    const last = days.at(-1);

    summarized.push({
      endDay: start !== undefined && last !== undefined && last < start ? start : (last ?? null),
      milestone: phase.milestone ?? null,
      minutes: Math.round(inPhase.reduce((total, item) => total + item.minutes, 0)),
      name: phase.name,
      startDay: start ?? null,
    });

    return summarized;
  }, []);
}

/**
 * Plans a goal without exam phases the way the app does from its skill graph, on a day with the
 * given weekday: what the persona already did and this week's items stay as written; the rest of
 * the graph's lessons, stand-ins for what the Library hasn't outlined, bosses and weekly
 * challenges are laid at the goal's daily minutes the way the plan screen re-plans them, so the
 * seeded plan is the one it shows. Returns the items with their days, the phases with their dates
 * and sizes, and the plan's total study time.
 */
export function schedulePlan({
  goal,
  targetDay,
  todayWeekday,
}: {
  goal: SeedGoal;
  /** The goal's target date as a day from today, when it has one. */
  targetDay: number | null;
  todayWeekday: number;
}): PlanSchedule {
  const context = {
    goal,
    lessons: listCourseLessons(goal.course),
    skills: listGoalSkills(goal),
    todayWeekday,
  };

  const kept = listKeptItems(context);
  const queue = buildQueue({ context, settled: listSettledSkills(kept) });
  const units = new Map(queue.map((unit) => [unit.key, unit]));
  const keptKeys = new Set(kept.map((item) => item.key));
  const weekEnd = endOfWeek(todayWeekday);

  const calendar = {
    daily: goal.dailyMinutes,
    firstCheckpoint: goal.createdDay + DAYS_PER_WEEK,
    targetDay,
    todayWeekday,
  };

  const { placed, scheduleStart } = placeAfterThisWeek({
    calendar,
    frozen: kept.some((item) => item.status === "todo"),
    units: queue.filter((unit) => !keptKeys.has(unit.key)),
    weekEnd,
  });

  const lastDay = placed.at(-1)?.day ?? null;

  // This week's challenge was planned with this week's items; later ones come with the lessons.
  const eventDays =
    lastDay === null
      ? []
      : Array.from({ length: lastDay + 1 }, (_, day) => day).filter(
          (day) => (day === weekEnd || day >= scheduleStart) && isCheckpointDay(calendar, day),
        );

  const ranked = [
    ...kept.map((item) => ({
      item: { ...item, minutes: getKeptMinutes(item, units) },
      rank: RANK.kept,
    })),
    ...placed.map(({ day, unit }) => ({
      item: {
        day,
        key: unit.key,
        kind: unit.kind,
        lesson: unit.lesson,
        minutes: unit.minutes / LEARNING_SHARE,
        phase: unit.phase,
        skill: unit.skill,
        status: "todo" as const,
        title: unit.kind === "boss" ? goal.plan.phases[unit.phase]?.name : undefined,
      },
      rank: RANK.unit,
    })),
    ...eventDays.map((day) => ({
      item: {
        day,
        key: `checkpoint:${day}`,
        kind: "checkpoint" as const,
        minutes: WEEKLY_CHECKPOINT_MINUTES,
        phase: -1,
        status: "todo" as const,
        title: "",
      },
      rank: RANK.event,
    })),
  ];

  const items = mergeItems(ranked);

  return {
    items,
    phases: summarizePhases({ goal, items, scheduleStart }),
    totalMinutes: Math.round(items.reduce((total, item) => total + item.minutes, 0)),
  };
}
