import "server-only";
import { prisma } from "@zoonk/db";
import { getFoundationSkillIds, getSkillArea } from "../../../plans/planner/graph-areas";
import { type PlanGraph, type PlanSettings } from "../../../plans/planner/plan-state";
import { type SyllabusItem } from "./syllabus-input";

/** Propagate test-out credit to every covered skill while retaining the same item id for once-only lesson counts. */
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

/** Harder starts skip all subject basics, and a language plan skips the levels below the learner's; time cuts remove later skills first, so missing basics with later teaching indicate a skipped base. */
export function getPastBasicsSkillIds({
  graph,
  items,
  prerequisites,
  settings,
}: {
  graph: PlanGraph;
  items: readonly Pick<SyllabusItem, "skillId">[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  settings: Pick<PlanSettings, "difficultyBias" | "pastBasicsAreas">;
}): Set<string> {
  const foundations = getFoundationSkillIds({ graph, prerequisites });
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

  const isPastBasics = (skill: PlanGraph["skills"][number]) =>
    skill.pastLevel === true ||
    (foundations.has(skill.skillId) &&
      (pastAreas.has(areaOf(skill)) || goingOn.has(areaOf(skill))));

  return new Set(
    graph.skills
      .filter((skill) => !taught.has(skill.skillId) && isPastBasics(skill))
      .map((skill) => skill.skillId),
  );
}
