import { type BuildPlanInput } from "./build-plan";
import { getEndOfWeek } from "./plan-calendar";
import { DAY_BEFORE_EXAM_MINUTES, WEEKLY_CHECKPOINT_MINUTES } from "./plan-days";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { getLearningShare } from "./plan-phases";
import { BOSS_MINUTES, DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";

/** Due by the end of this week, days already past included. */
function isByEndOfWeek({ date, today }: { date: Date | null; today: Date }): boolean {
  return date !== null && date <= getEndOfWeek(today);
}

/**
 * A stand-in whose skill the Library has outlined lessons for since the plan was saved (lessons it
 * doesn't hold yet): they take its place.
 */
function isLandedStandIn({
  input,
  item,
  planned,
}: {
  input: BuildPlanInput;
  item: ExistingPlanItem;
  planned: ReadonlySet<string>;
}) {
  const { skillId } = item;

  return (
    item.kind === "lesson" &&
    item.lessonId === null &&
    item.chapterId === null &&
    skillId !== null &&
    input.lessons.some(
      (lesson) => lesson.skillIds.includes(skillId) && !planned.has(lesson.lessonId),
    )
  );
}

/**
 * Finished items always stay; an automatic run also keeps this week's items as they are, and
 * what earlier days left where it is: only the new day's settling moves it (see `carryOver`). A
 * stand-in whose lessons were outlined since isn't kept: its lessons are planned in its place.
 */
export function splitExistingItems(input: BuildPlanInput) {
  const finished = input.items.filter((item) => item.status !== "todo");
  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  const thisWeek =
    input.mode === "automatic"
      ? input.items.filter(
          (item) =>
            item.status === "todo" &&
            isByEndOfWeek({ date: item.scheduledFor, today: input.today }),
        )
      : [];

  const landed = thisWeek.filter((item) => isLandedStandIn({ input, item, planned }));
  const frozen = thisWeek.filter((item) => !landed.includes(item));
  const keptIds = new Set([...finished, ...frozen].map((item) => item.id));
  const replaced = input.items.filter((item) => !keptIds.has(item.id));

  return { finished, frozen, landed, replaced, thisWeek };
}

/** A finished item done ahead of its date counts as done today once the plan restarts from today. */
export function toKeptItem({
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

/** Study minutes of an item the queue no longer schedules, from its unit when there is one. */
export function getKeptMinutes({
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
 * Each skill's lessons the plan keeps as they are (done, or this week's) or carries from earlier
 * days (`lessons`): a stand-in counts the lessons it plans. What's left of a skill counts them
 * toward its core (see `putCoresFirst`).
 */
export function countKeptLessons({
  kept,
  lessons,
  units,
}: {
  kept: readonly ExistingPlanItem[];
  lessons: readonly QueueUnit[];
  units: ReadonlyMap<string, QueueUnit>;
}): Map<string, number> {
  const counted = [
    ...kept.flatMap((item) =>
      item.kind === "lesson" && item.skillId
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
