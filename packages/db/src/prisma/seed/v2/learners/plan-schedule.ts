import { type PlanItemKind, type PlanItemStatus } from "../../../../generated/prisma/client";
import { type SeedCourse } from "../library/types";
import { type SeedGoal, type SeedPlanItem } from "./types";

/*
 * The planner's rules for plans without exam phases (`packages/core/src/plans/planner`), so a
 * seeded plan is the one the app computes from its skill graph: a lesson of the graph's size is 4
 * minutes of new learning (`DEFAULT_LESSON_MINUTES`), which gets half of each day's time (reviews
 * and practice take the rest); a skill the Library outlined in part keeps the graph's size while a
 * chapter's worth of its lessons (4) is missing, a lesson a chapter shares among several skills
 * counting once, for the skill it's planned under (`assignLessonSkills`); each phase closes with a 10-minute phase
 * checkpoint (`boss`); and every Sunday from the plan's second week holds a 15-minute weekly
 * challenge (`checkpoint`), until the goal's date when it has one, else until the lessons end. With
 * a date, every other day after the last lesson is a practice day (`review`) of the day's whole
 * time.
 */
const LESSON_MINUTES = 4;
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

/** A Library lesson that teaches some of the goal's skills, in its chapter (null for none). */
type CourseLesson = {
  chapter: string | null;
  key: string;
  minutes: number;
  skills: readonly string[];
};

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
function toCourseLesson(
  lesson: { key: string; minutes: number; skills: readonly string[] },
  chapter: string | null,
): CourseLesson {
  return { chapter, key: lesson.key, minutes: lesson.minutes, skills: lesson.skills };
}

function listCourseLessons(course: SeedCourse): CourseLesson[] {
  return [
    ...course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => toCourseLesson(lesson, chapter.key)),
    ),
    ...(course.explanations ?? []).map((lesson) => toCourseLesson(lesson, null)),
  ];
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
 * The planner's `apportion`: shares `total` lessons among skills in proportion to what each still
 * needs (largest remainder, ties to the earlier skill), then gives every skill at least one, from
 * the largest share, when there are enough to go round.
 */
function apportion({ needs, total }: { needs: readonly number[]; total: number }): number[] {
  const sum = needs.reduce((acc, need) => acc + need, 0);
  const exact = needs.map((need) => (sum > 0 ? (total * need) / sum : total / needs.length));
  const whole = exact.map((share) => Math.floor(share));
  const left = total - whole.reduce((acc, count) => acc + count, 0);

  const extra = new Set(
    exact
      .map((share, index) => ({ index, remainder: share - (whole[index] ?? 0) }))
      .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, left)
      .map((entry) => entry.index),
  );

  const counts = whole.map((count, index) => count + (extra.has(index) ? 1 : 0));

  if (total < needs.length) {
    return counts;
  }

  return counts.reduce<number[]>((shares, count, index) => {
    if (count > 0) {
      return shares;
    }

    const largest = shares.indexOf(Math.max(...shares));

    return shares.map((share, at) => {
      if (at === index) {
        return 1;
      }

      return at === largest ? share - 1 : share;
    });
  }, counts);
}

/**
 * The planner's `assignLessonSkills`: the skill each lesson counts for. A lesson of one of the
 * skills is that skill's; the lessons a chapter shares among the same skills split into runs in
 * the graph's order (`order`, each skill's place in it), each sized by what the skill still needs
 * beyond the lessons that are its alone.
 */
function assignLessonSkills({
  lessons,
  order,
  skills,
}: {
  lessons: readonly CourseLesson[];
  order: ReadonlyMap<string, number>;
  skills: readonly GoalSkill[];
}): Map<string, string> {
  const studied = new Set(skills.map((skill) => skill.key));
  const sizes = new Map(skills.map((skill) => [skill.key, skill.lessons]));

  const taughtBy = lessons.map((lesson) => ({
    chapter: lesson.chapter,
    key: lesson.key,
    skills: lesson.skills
      .filter((skill) => studied.has(skill))
      .toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
  }));

  const single = new Map(
    taughtBy.flatMap((lesson) =>
      lesson.skills.length === 1 ? [[lesson.key, lesson.skills[0] ?? ""] as const] : [],
    ),
  );

  const alone = Map.groupBy([...single.values()], (skill) => skill);

  const groups = Map.groupBy(
    taughtBy.filter((lesson) => lesson.skills.length > 1),
    (lesson) => `${lesson.chapter ?? ""}:${lesson.skills.join("+")}`,
  );

  const shared = [...groups.values()].flatMap((group) => {
    const skillKeys = group[0]?.skills ?? [];

    const counts = apportion({
      needs: skillKeys.map((skill) =>
        Math.max(1, (sizes.get(skill) ?? 1) - (alone.get(skill)?.length ?? 0)),
      ),
      total: group.length,
    });

    const runs = skillKeys.flatMap((skill, index) =>
      Array.from({ length: counts[index] ?? 0 }, () => skill),
    );

    return group.map((lesson, position) => [lesson.key, runs[position] ?? ""] as const);
  });

  return new Map([...single, ...shared.filter(([, skill]) => skill)]);
}

/** How many lessons count toward each skill's size: each lesson once, for its assigned skill. */
function countTaughtLessons(input: Parameters<typeof assignLessonSkills>[0]): Map<string, number> {
  return [...assignLessonSkills(input).values()].reduce(
    (counts, skill) => counts.set(skill, (counts.get(skill) ?? 0) + 1),
    new Map<string, number>(),
  );
}

/** Each skill's place in the goal's graph, which a shared chapter teaches its skills in. */
function getGraphOrder(skills: readonly GoalSkill[]): Map<string, number> {
  return new Map(skills.map((skill, index) => [skill.key, index]));
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

  const taught = countTaughtLessons({
    lessons: context.lessons,
    order: getGraphOrder(context.skills),
    skills: context.skills,
  });

  return context.skills
    .filter(
      (skill) =>
        covered.has(skill.key) &&
        countStandInLessons({ lessons: skill.lessons, taught: taught.get(skill.key) ?? 0 }) > 0,
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

  const counts = countTaughtLessons({ lessons, order: getGraphOrder(context.skills), skills });

  const firstSkill = new Map<string, string>();

  lessons.forEach((lesson) => {
    const skill = skills.find((entry) => lesson.skills.includes(entry.key));

    if (skill && !firstSkill.has(lesson.key)) {
      firstSkill.set(lesson.key, skill.key);
    }
  });

  const units = skills.flatMap((skill): Unit[] => {
    const taught = taughtLessons(lessons, skill.key);

    const missing = countStandInLessons({
      lessons: skill.lessons,
      taught: counts.get(skill.key) ?? 0,
    });

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
 * longer queues counts as one of the graph's size), a boss's or weekly challenge's own. Mocks belong
 * to exam plans, which this schedule doesn't plan; a kept practice day holds no new learning.
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

/**
 * The planner's `placeItemsInPhaseTime`: a phase's time ends with its boss, so what's still to do
 * after that day (a weekly challenge the day after it) belongs to the first later phase whose boss
 * hasn't come yet, or the last phase. Bosses and finished items keep their phase.
 */
function placeInPhaseTime(items: readonly ScheduledItem[]): ScheduledItem[] {
  const lastPhase = Math.max(0, ...items.map((item) => item.phase));

  const ends = new Map(
    items
      .filter((item) => item.kind === "boss" && item.phase < lastPhase)
      .map((item) => [item.phase, item.day] as const),
  );

  return items.map((item) => {
    const end = ends.get(item.phase);

    if (item.kind === "boss" || item.status !== "todo" || end === undefined || item.day <= end) {
      return item;
    }

    const later = Array.from(
      { length: Math.max(0, lastPhase - item.phase) },
      (_, index) => item.phase + 1 + index,
    );

    return {
      ...item,
      phase: later.find((next) => (ends.get(next) ?? Infinity) >= item.day) ?? lastPhase,
    };
  });
}

/** By day; on one day, what's already on the plan first, then lessons in order, events last. */
function mergeItems(ranked: readonly { item: ScheduledItem; rank: number }[]): ScheduledItem[] {
  const sorted = ranked
    .toSorted((a, b) => a.item.day - b.item.day || a.rank - b.rank)
    .map(({ item }) => item);

  // Weekly challenges belong to the phase of the lessons before them.
  const firstPhase = sorted.find((item) => item.phase >= 0)?.phase ?? 0;

  return placeInPhaseTime(
    sorted.reduce<ScheduledItem[]>((merged, item) => {
      const previous = merged.at(-1)?.phase ?? firstPhase;
      merged.push(item.phase < 0 ? { ...item, phase: previous } : item);
      return merged;
    }, []),
  );
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
/**
 * The practice days of a plan with a date: from where this run plans, every day after its last
 * lesson and before the date that holds no weekly challenge.
 */
function listPracticeDays({
  calendar,
  eventDays,
  kept,
  placed,
  start,
}: {
  calendar: Calendar;
  eventDays: readonly number[];
  kept: readonly ScheduledItem[];
  placed: readonly { day: number; unit: Unit }[];
  start: number;
}): number[] {
  if (calendar.targetDay === null || calendar.daily <= 0) {
    return [];
  }

  const lessonDays = [
    ...placed.filter(({ unit }) => unit.kind === "lesson").map(({ day }) => day),
    ...kept
      .filter((item) => item.kind === "lesson" && item.status === "todo")
      .map((item) => item.day),
  ];

  const lastLesson = lessonDays.length > 0 ? Math.max(...lessonDays) : -1;
  const from = Math.max(start, lastLesson + 1);

  return Array.from(
    { length: Math.max(0, calendar.targetDay - from) },
    (_, index) => from + index,
  ).filter((day) => !eventDays.includes(day));
}

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

  // A plan with a date keeps its weekly challenges until then; one without, until its lessons end.
  const lastDay = targetDay === null ? (placed.at(-1)?.day ?? null) : targetDay - 1;

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

  const practiceDays = listPracticeDays({
    calendar,
    eventDays,
    kept,
    placed,
    start: kept.some((item) => item.status === "todo") ? weekEnd + 1 : 0,
  });

  const items = mergeItems([
    ...ranked,
    ...practiceDays.map((day) => ({
      item: {
        day,
        key: `review:${day}`,
        kind: "review" as const,
        minutes: calendar.daily,
        phase: -1,
        status: "todo" as const,
        title: "",
      },
      rank: RANK.event,
    })),
  ]);

  return {
    items,
    phases: summarizePhases({ goal, items, scheduleStart }),
    totalMinutes: Math.round(items.reduce((total, item) => total + item.minutes, 0)),
  };
}
