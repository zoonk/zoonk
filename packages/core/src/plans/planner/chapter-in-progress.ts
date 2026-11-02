import { type ExistingPlanItem } from "./plan-items";
import { type PlannerLesson, type QueueUnit } from "./plan-units";

type ProgressItem = Pick<
  ExistingPlanItem,
  "chapterId" | "completedAt" | "kind" | "lessonId" | "scheduledFor" | "skillId" | "status"
>;

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

function findStartIndex({ rest, started }: { rest: readonly QueueUnit[]; started: QueueUnit[] }) {
  const phase = Math.min(...started.map((unit) => unit.phase));
  const at = rest.findIndex((unit) => unit.phase >= phase);

  return at === -1 ? rest.length : at;
}

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

export function putChapterInProgressFirst({
  items,
  lessons = [],
  prerequisites = new Map(),
  units,
}: {
  items: readonly ProgressItem[];
  lessons?: readonly Pick<PlannerLesson, "lessonId" | "skillIds">[];
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
