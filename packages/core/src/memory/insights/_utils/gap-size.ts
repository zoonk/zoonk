import { type PlannerLesson } from "../../../plans/planner/plan-units";

/** Up to this many lessons fill a gap themselves; past it, the gap is a chapter's worth. */
export const FEW_LESSONS = 4;

/** A chain with no chapter to stand in for it keeps its nearest skills, so a proposal stays readable. */
const MAX_CHAIN_SKILLS = 8;

export type PrerequisiteEdge = { prerequisiteId: string; skillId: string };

type GapLesson = Pick<PlannerLesson, "chapterId" | "lessonId" | "skillIds">;

function groupPrerequisites(edges: readonly PrerequisiteEdge[]): Map<string, string[]> {
  const grouped = Map.groupBy(edges, (edge) => edge.skillId);

  return new Map(
    [...grouped].map(([skillId, rows]) => [skillId, rows.map((row) => row.prerequisiteId)]),
  );
}

/** How many steps up the chain each skill sits from the root, by the shortest way. */
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

/** Adds a skill after everything it rests on; a cycle in the graph is skipped, not followed. */
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

/**
 * The skills a gap under `rootId` takes, in an order a plan can teach them: everything a skill
 * rests on comes before it, the root last. The edges hold only unlearned skills the plan doesn't
 * teach. A long chain keeps the skills nearest the root.
 */
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

/**
 * What adding these skills brings into a plan, the way the planner expands them: every Library
 * lesson that teaches one of them and isn't in the plan already, plus one placeholder lesson for a
 * skill the Library has no lessons for yet. `perSkill` is each skill's size for the plan's graph.
 */
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

/** More lessons than a few: the prerequisite's chapter fills the gap instead of its chain. */
export function isChapterSized(lessons: number): boolean {
  return lessons > FEW_LESSONS;
}

/** The chapter a skill is taught in: that of its first lesson, in the order the plan would teach them. */
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
