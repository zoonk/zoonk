import "server-only";
import { prisma } from "@zoonk/db";
import { getFoundationSkillIds, getSkillArea } from "../../../plans/planner/graph-areas";
import { type PlanGraph, type PlanSettings } from "../../../plans/planner/plan-state";
import { type SyllabusItem } from "./syllabus-input";

/**
 * A lesson tested out covers every skill it teaches: the ones its lesson names and, for a chapter
 * an outline tagged with several skills, all of them (the planner settles them all; see
 * `getSettledSkillIds`). A covered skill with no lesson of its own in the plan gets the tested-out
 * lesson as its own too, so its topics read as known, never as out of the plan.
 */
export async function withTestedOutSkills({
  graphSkillIds,
  items,
}: {
  graphSkillIds: ReadonlySet<string>;
  items: readonly SyllabusItem[];
}): Promise<SyllabusItem[]> {
  const testedOut = items.filter((item) => item.status === "testedOut" && item.lessonId);

  if (testedOut.length === 0) {
    return [...items];
  }

  const [lessonRows, chapterRows] = await Promise.all([
    prisma.lessonSkill.findMany({
      select: { lessonId: true, skillId: true },
      where: { lessonId: { in: testedOut.flatMap((item) => item.lessonId ?? []) } },
    }),
    prisma.chapterSkill.findMany({
      select: { chapterId: true, skillId: true },
      where: { chapterId: { in: testedOut.flatMap((item) => item.chapterId ?? []) } },
    }),
  ]);

  const own = new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));

  const covered = testedOut.flatMap((item) =>
    [
      ...lessonRows.filter((row) => row.lessonId === item.lessonId),
      ...chapterRows.filter((row) => row.chapterId === item.chapterId),
    ]
      .filter((row) => graphSkillIds.has(row.skillId) && !own.has(row.skillId))
      .map((row) => ({ ...item, skillId: row.skillId })),
  );

  const unique = covered.filter(
    (item, index) => covered.findIndex((other) => other.skillId === item.skillId) === index,
  );

  return [...items, ...unique];
}

/**
 * The subjects' basics the plan starts past: the first-phase skills of a subject the learner said
 * they know the basics of, or, with harder lessons, of one they do well in. Either way the plan
 * holds none of their lessons. Harder lessons skip all of a subject's basics at once, while a plan
 * short on time drops its last skills first, so a subject whose later skills the plan teaches and
 * whose basics it holds none of is one it started past.
 */
export function getPastBasicsSkillIds({
  graph,
  items,
  settings,
}: {
  graph: PlanGraph;
  items: readonly SyllabusItem[];
  settings: Pick<PlanSettings, "difficultyBias" | "pastBasicsAreas">;
}): Set<string> {
  const foundations = getFoundationSkillIds(graph);
  const taught = new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));
  const pastAreas = new Set(settings.pastBasicsAreas);
  const areaOf = (skill: PlanGraph["skills"][number]) => getSkillArea({ graph, skill });

  const isTaughtIn = ({ area, basics }: { area: string; basics: boolean }) =>
    graph.skills.some(
      (skill) =>
        areaOf(skill) === area &&
        foundations.has(skill.skillId) === basics &&
        taught.has(skill.skillId),
    );

  const harder = settings.difficultyBias === "harder";

  const goingOn = new Set(
    [...new Set(graph.skills.map((skill) => areaOf(skill)))].filter(
      (area) =>
        harder && isTaughtIn({ area, basics: false }) && !isTaughtIn({ area, basics: true }),
    ),
  );

  return new Set(
    graph.skills
      .filter((skill) => foundations.has(skill.skillId) && !taught.has(skill.skillId))
      .filter((skill) => pastAreas.has(areaOf(skill)) || goingOn.has(areaOf(skill)))
      .map((skill) => skill.skillId),
  );
}
