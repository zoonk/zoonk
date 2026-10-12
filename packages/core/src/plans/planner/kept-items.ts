import { type BuildPlanInput } from "./build-plan";
import { getEndOfWeek } from "./plan-calendar";
import { DAY_BEFORE_EXAM_MINUTES, WEEKLY_CHECKPOINT_MINUTES } from "./plan-days";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { type ExamWindow, findExamWindow, getLearningShare } from "./plan-phases";
import { BOSS_MINUTES, DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledEvent,
  type ScheduledUnit,
} from "./schedule-units";

/** Due by the end of this week, days already past included. */
function isByEndOfWeek({ date, today }: { date: Date | null; today: Date }): boolean {
  return date !== null && date <= getEndOfWeek(today);
}

/** A stand-in: a skill the Library hadn't outlined when the plan was saved, as one item. */
export function isStandInItem(item: ExistingPlanItem): boolean {
  return (
    item.kind === "lesson" &&
    item.lessonId === null &&
    item.chapterId === null &&
    item.skillId !== null
  );
}

/**
 * A stand-in whose skill the Library has outlined lessons for since the plan was saved (lessons it
 * doesn't hold yet): they take its place. `written` says which lessons count for each skill. A
 * skill the plan holds lessons of keeps its stand-in for what isn't written yet this week: lessons
 * written for it since come after this week, which stays as the learner saw it. When they're the
 * run's only news, its next chapter, they land in the stand-in's place (see `heldSkillsLand`).
 */
function isLandedStandIn({
  item,
  planned,
  written,
}: {
  item: ExistingPlanItem;
  planned: ReadonlySet<string>;
  written: (skillId: string) => readonly string[];
}) {
  const lessons = written(item.skillId ?? "");

  return (
    isStandInItem(item) &&
    lessons.some((lessonId) => !planned.has(lessonId)) &&
    !lessons.some((lessonId) => planned.has(lessonId))
  );
}

/** Each of the Library's lessons for every skill it teaches. */
function listWrittenLessons(input: BuildPlanInput) {
  return (skillId: string) =>
    input.lessons.flatMap((lesson) => (lesson.skillIds.includes(skillId) ? [lesson.lessonId] : []));
}

/**
 * Finished items always stay; an automatic run also keeps this week's items as they are, and
 * what earlier days left where it is: only the new day's settling moves it (see `carryOver`). A
 * stand-in whose lessons were outlined since isn't kept: its lessons are planned in its place,
 * those of a landing's skills (`landedSkillIds`, see `findLanding`) too. A lesson counts for the
 * skill the queue plans it under (see `getPlannedSkillId`): a lesson an ENEM skill shares with
 * another, counted for that one, read as written since on every automatic run, which then moved
 * the stand-in past this week. On a learner's change, work set aside for time
 * (`setAsideBefore`) competes for the plan's time again, kept as it is where the run doesn't place it
 * (see `BuildPlanInput.bringBackSetAside`).
 */
export function splitExistingItems({
  input,
  keepsRest = false,
  landedSkillIds,
  queue,
}: {
  input: BuildPlanInput;
  /**
   * A landing-only run's: every item still to do stays as it is, not only this week's, but the
   * stand-ins of its landing's skills (`landedSkillIds`).
   */
  keepsRest?: boolean;
  landedSkillIds?: Pick<ReadonlySet<string>, "has">;
  /** The plan's units (see `buildPlanQueue`). */
  queue: readonly QueueUnit[];
}) {
  const setAsideBefore = input.bringBackSetAside
    ? input.items.filter((item) => item.status === "skipped")
    : [];

  const finished = input.items.filter(
    (item) => item.status !== "todo" && !setAsideBefore.includes(item),
  );

  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  const bySkill = Map.groupBy(
    queue.filter((unit) => unit.lessonId !== null),
    (unit) => unit.skillId ?? "",
  );

  const written = (skillId: string) =>
    (bySkill.get(skillId) ?? []).flatMap((unit) => (unit.lessonId ? [unit.lessonId] : []));

  const thisWeek =
    input.mode === "automatic"
      ? input.items.filter(
          (item) =>
            item.status === "todo" &&
            (keepsRest || isByEndOfWeek({ date: item.scheduledFor, today: input.today })),
        )
      : [];

  // A landing-only run replaces only its landing's stand-ins (see `findLanding`).
  const landed = thisWeek.filter(
    (item) =>
      (!keepsRest && isLandedStandIn({ item, planned, written })) ||
      (isStandInItem(item) && landedSkillIds?.has(item.skillId ?? "") === true),
  );

  const frozen = thisWeek.filter((item) => !landed.includes(item));
  const keptIds = new Set([...finished, ...frozen].map((item) => item.id));
  const replaced = input.items.filter((item) => !keptIds.has(item.id));

  return { finished, frozen, landed, replaced, setAsideBefore, thisWeek };
}

/**
 * An item the plan keeps as it is (see `getKeptMinutes`). A finished item done ahead of its date
 * counts as done today once the plan restarts from today.
 */
export function toKeptItem({
  item,
  input,
  units,
  windows,
}: {
  item: ExistingPlanItem;
  input: BuildPlanInput;
  units: ReadonlyMap<string, QueueUnit>;
  windows: readonly ExamWindow[];
}): PlannedItem {
  const isFuture = item.scheduledFor !== null && item.scheduledFor > input.today;
  const moveToToday = input.mode === "forced" && item.status !== "todo" && isFuture;

  return {
    ...item,
    key: getItemKey(item),
    minutes: getKeptMinutes({ input, item, units, windows }),
    scheduledFor: moveToToday ? input.today : item.scheduledFor,
  };
}

/**
 * Study minutes of an item the queue no longer schedules, from its unit when there is one. A mock
 * in an exam's final stretch (`windows`) is the whole exam day (see `createExamDays`).
 */
function getKeptMinutes({
  input,
  item,
  units,
  windows,
}: {
  input: BuildPlanInput;
  item: ExistingPlanItem;
  units: ReadonlyMap<string, QueueUnit>;
  windows: readonly ExamWindow[];
}): number {
  const unit = units.get(getItemKey(item));
  const share = getLearningShare({ phaseKind: "learn", practiceBias: input.settings.practiceBias });

  const isFullMock =
    item.scheduledFor !== null &&
    findExamWindow({ date: item.scheduledFor, windows })?.kind === "finalStretch";

  const byKind: Record<ExistingPlanItem["kind"], number> = {
    boss: BOSS_MINUTES,
    chapter: 0,
    checkpoint: WEEKLY_CHECKPOINT_MINUTES,
    lesson: (unit?.minutes ?? DEFAULT_LESSON_MINUTES * input.paceFactor) / share,
    mock: isFullMock ? (input.fullMockMinutes ?? input.mockMinutes) : input.mockMinutes,
    review: DAY_BEFORE_EXAM_MINUTES,
  };

  return byKind[item.kind];
}

/**
 * Each skill's lessons the plan keeps as they are (done, or this week's) or carries from earlier
 * days (`lessons`): a stand-in counts the lessons it plans. What's left of a skill counts them
 * toward its core (see `putCoresFirst`). A gap's tested-out lessons don't: practice missed what
 * the test-out claimed, and counted, the lessons that came back were depth a plan short on time
 * cut (career seed 2049). Nor do lessons set aside for time: they're out of the plan, and counted,
 * an ENEM plan took punctuation and syntax's topic as taught and let standard Portuguese, asked
 * most, leave with its only other skill (ENEM seed 2083).
 */
export function countKeptLessons({
  gaps = new Set(),
  kept,
  lessons,
  units,
}: {
  /** The skills the learner missed (see `BuildPlanInput.missedSkillIds`). */
  gaps?: ReadonlySet<string>;
  kept: readonly ExistingPlanItem[];
  lessons: readonly QueueUnit[];
  units: ReadonlyMap<string, QueueUnit>;
}): Map<string, number> {
  const counted = [
    ...kept.flatMap((item) =>
      item.kind === "lesson" &&
      item.skillId &&
      item.status !== "skipped" &&
      !(item.status === "testedOut" && gaps.has(item.skillId))
        ? [
            {
              lessons: item.lessonId ? 1 : (units.get(getItemKey(item))?.lessons ?? 1),
              skillId: item.skillId,
            },
          ]
        : [],
    ),
    ...lessons.flatMap((unit) => (unit.skillId ? [{ lessons: 1, skillId: unit.skillId }] : [])),
  ];

  return counted.reduce(
    (counts, entry) => counts.set(entry.skillId, (counts.get(entry.skillId) ?? 0) + entry.lessons),
    new Map<string, number>(),
  );
}

/**
 * A piece of this week's kept work: the day it's saved for, the share of its unit it holds (see
 * `getKeptShare`), and whether the plan saved it as it is (`saved`) or it's a lesson that landed in
 * a stand-in's place since.
 */
export type KeptPiece = { date: Date; key: string; saved: boolean; share: number };

/**
 * The share of its skill's stand-in that a stand-in kept as it is holds: the lessons it was saved
 * with, the rest cut as the run that saved it cut it; all of it for any other item. Counted whole,
 * a language plan's stand-in cut to 32 of 96 lessons took the time of 96 past this week, and a
 * refresh saved it at 96 and moved everything after it two weeks later.
 */
function getKeptShare({
  item,
  units,
}: {
  item: ExistingPlanItem;
  units: ReadonlyMap<string, QueueUnit>;
}): number {
  const total = units.get(getItemKey(item))?.lessons;
  return item.lessonId === null && item.lessons && total ? Math.min(1, item.lessons / total) : 1;
}

/**
 * This week's kept work on the days it's saved for: its items as they are and its stand-ins'
 * landed lessons.
 */
export function listThisWeekWork({
  frozen,
  landed,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  landed: readonly { date: Date; key: string }[];
  units: ReadonlyMap<string, QueueUnit>;
}): KeptPiece[] {
  return [
    ...frozen.flatMap((item) =>
      item.scheduledFor
        ? [
            {
              date: item.scheduledFor,
              key: getItemKey(item),
              saved: true,
              share: getKeptShare({ item, units }),
            },
          ]
        : [],
    ),
    ...landed.map((unit) => ({ date: unit.date, key: unit.key, saved: false, share: 1 })),
  ];
}

/**
 * What the run that saved this week's kept stand-ins cut of them (see `getKeptShare`), as units
 * left out: kept as they are, they still teach only the lessons they were saved with.
 */
export function listKeptStandInCuts({
  frozen,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  units: ReadonlyMap<string, QueueUnit>;
}): DroppedUnit[] {
  return frozen.flatMap((item) => {
    const unit = units.get(getItemKey(item));
    const share = getKeptShare({ item, units });

    return unit && share < 1 ? [{ ...unit, fittedMinutes: unit.minutes * share }] : [];
  });
}

/** The keys of this week's kept work: its items as they are and its stand-ins' landed lessons. */
function listThisWeekKeys({
  frozen,
  landed,
}: {
  frozen: readonly ExistingPlanItem[];
  landed: readonly { key: string }[];
}): Set<string> {
  return new Set([...frozen.map((item) => getItemKey(item)), ...landed.map((unit) => unit.key)]);
}

/**
 * An automatic run's schedule with this week as it is. The run lays out this week's kept work with
 * the rest, from today, as the run that saved it did, so what comes after this week starts where
 * it did: laid out from next week, a stand-in that began this week took days more, and the first
 * open of Today after a plan was made moved 240 of its 247 lessons. Its copies of this week's kept
 * items (`frozen`) and of the lessons placed in their stand-ins' time (`landed`) give way to them,
 * and nothing new comes into this week: what it would date sooner is due the week after (`start`).
 */
export function keepThisWeek({
  days,
  frozen,
  landed,
  schedule,
  start,
}: {
  days: readonly PlanDay[];
  frozen: readonly ExistingPlanItem[];
  landed: readonly ScheduledUnit[];
  schedule: { dropped: DroppedUnit[]; events: ScheduledEvent[]; units: ScheduledUnit[] };
  start: Date;
}) {
  const hidden = listThisWeekKeys({ frozen, landed });

  const first = days.find((day) => day.date >= start);
  const isNew = (unit: QueueUnit) => !hidden.has(unit.key);
  const fresh = schedule.units.filter((unit) => isNew(unit));

  // What this run would date this week is due the week after, or doesn't fit before the plan's
  // end when the week after has no days (a test this week).
  const toWeekAfter = (unit: ScheduledUnit): ScheduledUnit[] => {
    if (unit.date >= start) {
      return [unit];
    }

    return first
      ? [
          {
            ...unit,
            date: first.date,
            phase: first.shape.phase ?? unit.phase,
            studyMinutes: unit.minutes / (first.shape.share || 1),
          },
        ]
      : [];
  };

  const outOfTime = first ? [] : fresh.filter((unit) => unit.date < start);

  return {
    ...schedule,
    dropped: [
      ...schedule.dropped.filter((unit) => isNew(unit)),
      ...outOfTime.map(({ date: _date, studyMinutes: _study, ...unit }) => ({
        ...unit,
        fittedMinutes: 0,
      })),
    ],
    units: [...landed, ...fresh.flatMap((unit) => toWeekAfter(unit))],
  };
}

const LEFT_WORK_KINDS = new Set<ExistingPlanItem["kind"]>(["chapter", "lesson"]);

/**
 * Work earlier days left that a new day's settling can't place by the goal's date (see
 * `BuildPlanInput.setAsideLeftWork`): it stays in the plan, set aside (`skipped`), where the change
 * names its topics, instead of leaving it. A class test days after missed days deleted a topic
 * whose lessons weren't written yet, work the learner never got to. A stand-in whose lessons were
 * written since is left only when none of them is planned: they take its place (see
 * `isLandedStandIn`). Set aside as well, it read as its skill being done, and the next run left its
 * lessons out.
 */
export function setAsideLeftWork({
  input,
  placed,
  yielded = new Set(),
}: {
  input: BuildPlanInput;
  /** Everything the run keeps or schedules. */
  placed: readonly { key: string; skillId: string | null }[];
  /**
   * The keys of work earlier days left that gave way to the rest of a plan short on time (see
   * `scheduleCarriedAndRest`): set aside in any run, not only a new day's settling.
   */
  yielded?: ReadonlySet<string>;
}): PlannedItem[] {
  if (!input.setAsideLeftWork && yielded.size === 0) {
    return [];
  }

  const placedKeys = new Set(placed.map((entry) => entry.key));
  const placedSkills = new Set(placed.flatMap((entry) => entry.skillId ?? []));
  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  return input.items.flatMap((item) => {
    const key = getItemKey(item);

    const isOverdue =
      input.setAsideLeftWork === true &&
      item.scheduledFor !== null &&
      item.scheduledFor < input.today;

    const left =
      item.status === "todo" &&
      LEFT_WORK_KINDS.has(item.kind) &&
      (isOverdue || yielded.has(key)) &&
      !placedKeys.has(key) &&
      !(
        placedSkills.has(item.skillId ?? "") &&
        isLandedStandIn({ item, planned, written: listWrittenLessons(input) })
      );

    return left ? [{ ...item, key, minutes: 0, status: "skipped" as const }] : [];
  });
}
