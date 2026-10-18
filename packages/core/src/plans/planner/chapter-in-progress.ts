import { type ExistingPlanItem } from "./plan-items";
import { type PlannerLesson, type QueueUnit } from "./plan-units";

type ProgressItem = Pick<
  ExistingPlanItem,
  "chapterId" | "completedAt" | "kind" | "lessonId" | "scheduledFor" | "skillId" | "status"
>;

/**
 * The chapter the learner is in the middle of: the one of the last lesson they finished, while it
 * has lessons left to do. Null when that chapter is done or nothing is finished yet.
 */
export function findChapterInProgress(items: readonly ProgressItem[]): string | null {
  const last = items
    .filter((item) => item.kind === "lesson" && item.status === "done" && item.completedAt)
    .toSorted((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .at(0);

  const chapterId = last?.chapterId ?? null;

  const hasLeft = items.some(
    (item) => item.kind === "lesson" && item.status === "todo" && item.chapterId === chapterId,
  );

  return chapterId && hasLeft ? chapterId : null;
}

/**
 * The item of the plan the learner sees that holds this unit of the chapter still to do: its
 * lesson, or a stand-in of its skill there (whose lessons this unit may be, landed since).
 */
function findSeen({
  todo,
  unit,
}: {
  todo: readonly ProgressItem[];
  unit: QueueUnit;
}): ProgressItem | undefined {
  return todo.find((item) =>
    item.lessonId ? item.lessonId === unit.lessonId : item.skillId === unit.skillId,
  );
}

/**
 * The chapter's units the plan the learner sees holds, marked (`QueueUnit.inProgress`), the next
 * one with the day it's on there (`QueueUnit.dueBy`).
 */
function markSeen({
  chapterId,
  todo,
  units,
}: {
  chapterId: string;
  todo: readonly ProgressItem[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const next = units.find((unit) => unit.chapterId === chapterId && findSeen({ todo, unit }));
  const dueBy = next && findSeen({ todo, unit: next })?.scheduledFor;

  return units.map((unit) => {
    if (unit.chapterId !== chapterId || !findSeen({ todo, unit })) {
      return unit;
    }

    return unit === next && dueBy
      ? { ...unit, dueBy, inProgress: true }
      : { ...unit, inProgress: true };
  });
}

/** Where the chapter's lessons go: before the first of `rest` in their phase or a later one. */
function findStartIndex({ rest, started }: { rest: readonly QueueUnit[]; started: QueueUnit[] }) {
  const phase = Math.min(...started.map((unit) => unit.phase));
  const at = rest.findIndex((unit) => unit.phase >= phase);

  return at === -1 ? rest.length : at;
}

/**
 * The skills a lesson the learner finished teaches: its item's, and every one its lesson teaches. A
 * guest's first lesson taught what owning a share is with what a holder gets, and the plan built
 * from it counted it for the second alone.
 */
function listStudiedSkills({
  items,
  lessons,
}: {
  items: readonly ProgressItem[];
  lessons: readonly Pick<PlannerLesson, "lessonId" | "skillIds">[];
}): Set<string> {
  const taught = new Map(lessons.map((lesson) => [lesson.lessonId, lesson.skillIds]));

  return new Set(
    items.flatMap((item) =>
      item.kind === "lesson" && item.status === "done"
        ? [...(item.skillId ? [item.skillId] : []), ...(taught.get(item.lessonId ?? "") ?? [])]
        : [],
    ),
  );
}

/**
 * The chapter's lessons that stay where their skill is taught: those whose skill builds on one
 * whose first lesson comes after the chapter's new place, so a lesson never comes before what its
 * skill builds on. A language unit's apartment chapter put booking a visit before asking about the
 * rent. A skill the learner already studied in a lesson they finished holds nothing back.
 */
function listWaiting({
  chapter,
  prerequisites,
  studied,
  units,
}: {
  chapter: readonly QueueUnit[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  studied: ReadonlySet<string>;
  units: readonly QueueUnit[];
}): Set<QueueUnit> {
  const waiting = new Set<QueueUnit>();

  const grow = (): Set<QueueUnit> => {
    const started = chapter.filter((unit) => !waiting.has(unit));
    const rest = units.filter((unit) => !started.includes(unit));
    const index = started.length > 0 ? findStartIndex({ rest, started }) : 0;
    const before = new Set(rest.slice(0, index).map((unit) => unit.skillId));
    const later = new Set(rest.slice(index).map((unit) => unit.skillId));

    const isLater = (skillId: string) =>
      later.has(skillId) && !before.has(skillId) && !studied.has(skillId);

    const blocked = started.filter((unit) =>
      (prerequisites.get(unit.skillId ?? "") ?? []).some((skillId) => isLater(skillId)),
    );

    blocked.forEach((unit) => waiting.add(unit));
    return blocked.length > 0 ? grow() : waiting;
  };

  return grow();
}

/**
 * The plan's units with the rest of the chapter the learner is in the middle of first among its
 * phase's lessons: before anything a change adds or moves ahead in that phase, and after earlier
 * phases, so each phase's challenge still closes it. Carla's added topic sent the last four
 * lessons of hers to March. A lesson whose skill builds on one taught later stays in its place
 * (see `listWaiting`). The ones the plan the learner sees holds are marked
 * (`QueueUnit.inProgress`) so a plan short on time keeps them; the chapter's lessons it never had
 * aren't: a class test's change kept its chapter's next four lessons in place of the two its test
 * announces, which the learner saw. Its next lesson keeps the day the learner sees it on as the
 * latest (`QueueUnit.dueBy`): an exam's study cycle rotates subjects, so a change that adds lessons
 * to other subjects could otherwise push that chapter's turn back (Câmara's "less English" sent
 * the rest of political science's chapter a day later, behind administrative law).
 */
export function putChapterInProgressFirst({
  items,
  lessons = [],
  prerequisites = new Map(),
  units,
}: {
  items: readonly ProgressItem[];
  /** The plan's lessons, with the skills each teaches (see `listStudiedSkills`). */
  lessons?: readonly Pick<PlannerLesson, "lessonId" | "skillIds">[];
  /** What each skill builds on, by skill id. */
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const chapterId = findChapterInProgress(items);

  if (!chapterId) {
    return [...units];
  }

  const todo = items.filter(
    (item) => item.kind === "lesson" && item.status === "todo" && item.chapterId === chapterId,
  );

  const marked = markSeen({ chapterId, todo, units });

  const chapter = marked.filter((unit) => unit.chapterId === chapterId);
  const studied = listStudiedSkills({ items, lessons });
  const waiting = listWaiting({ chapter, prerequisites, studied, units: marked });
  const started = chapter.filter((unit) => !waiting.has(unit));

  if (started.length === 0) {
    return marked;
  }

  const rest = marked.filter((unit) => !started.includes(unit));
  const index = findStartIndex({ rest, started });

  return [...rest.slice(0, index), ...started, ...rest.slice(index)];
}
