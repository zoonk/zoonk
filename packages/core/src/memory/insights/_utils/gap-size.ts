import { type PlannerLesson } from "../../../plans/planner/plan-units";

export const FEW_LESSONS = 4;

const MAX_CHAIN_SKILLS = 8;

export type PrerequisiteEdge = { prerequisiteId: string; skillId: string };

type GapLesson = Pick<PlannerLesson, "chapterId" | "lessonId" | "skillIds">;

function groupPrerequisites(edges: readonly PrerequisiteEdge[]): Map<string, string[]> {
  const grouped = Map.groupBy(edges, (edge) => edge.skillId);

  return new Map(
    [...grouped].map(([skillId, rows]) => [skillId, rows.map((row) => row.prerequisiteId)]),
  );
}

function getDistances({
  depth,
  distances,
  frontier,
  prerequisitesOf,
}: {
  depth: number;
  distances: ReadonlyMap<string, number>;
  frontier: readonly string[];
  prerequisitesOf: ReadonlyMap<string, string[]>;
}): ReadonlyMap<string, number> {
  const next = [
    ...new Set(frontier.flatMap((skillId) => prerequisitesOf.get(skillId) ?? [])),
  ].filter((skillId) => !distances.has(skillId));

  if (next.length === 0) {
    return distances;
  }

  return getDistances({
    depth: depth + 1,
    distances: new Map([
      ...distances,
      ...next.map((skillId): [string, number] => [skillId, depth + 1]),
    ]),
    frontier: next,
    prerequisitesOf,
  });
}

function visit({
  kept,
  order,
  path,
  prerequisitesOf,
  skillId,
}: {
  kept: ReadonlySet<string>;
  order: readonly string[];
  path: ReadonlySet<string>;
  prerequisitesOf: ReadonlyMap<string, string[]>;
  skillId: string;
}): readonly string[] {
  if (!kept.has(skillId) || order.includes(skillId) || path.has(skillId)) {
    return order;
  }

  const nextPath = new Set([...path, skillId]);

  const withPrerequisites = (prerequisitesOf.get(skillId) ?? []).reduce<readonly string[]>(
    (current, prerequisiteId) =>
      visit({ kept, order: current, path: nextPath, prerequisitesOf, skillId: prerequisiteId }),
    order,
  );

  return [...withPrerequisites, skillId];
}

export function orderPrerequisiteChain({
  edges,
  rootId,
}: {
  edges: readonly PrerequisiteEdge[];
  rootId: string;
}): string[] {
  const prerequisitesOf = groupPrerequisites(edges);

  const distances = getDistances({
    depth: 0,
    distances: new Map([[rootId, 0]]),
    frontier: [rootId],
    prerequisitesOf,
  });

  const kept = new Set(
    [...distances]
      .toSorted((first, second) => first[1] - second[1])
      .slice(0, MAX_CHAIN_SKILLS)
      .map(([skillId]) => skillId),
  );

  return [...visit({ kept, order: [], path: new Set(), prerequisitesOf, skillId: rootId })];
}

export function countGapLessons({
  lessons,
  plannedLessonIds,
  skillIds,
}: {
  lessons: readonly GapLesson[];
  plannedLessonIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): { lessons: number; perSkill: Map<string, number> } {
  const teaching = (skillId: string) =>
    lessons.filter((lesson) => lesson.skillIds.includes(skillId));

  const newLessons = lessons.filter(
    (lesson) =>
      !plannedLessonIds.has(lesson.lessonId) &&
      lesson.skillIds.some((skillId) => skillIds.includes(skillId)),
  );

  const placeholders = skillIds.filter((skillId) => teaching(skillId).length === 0);

  return {
    lessons: newLessons.length + placeholders.length,
    perSkill: new Map(skillIds.map((skillId) => [skillId, Math.max(1, teaching(skillId).length)])),
  };
}

export function isChapterSized(lessons: number): boolean {
  return lessons > FEW_LESSONS;
}

export function findSkillChapterId({
  lessons,
  skillId,
}: {
  lessons: readonly GapLesson[];
  skillId: string;
}): string | null {
  return (
    lessons.find((lesson) => lesson.chapterId && lesson.skillIds.includes(skillId))?.chapterId ??
    null
  );
}
