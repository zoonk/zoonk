import "server-only";
import { prisma } from "@zoonk/db";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";

const MIN_AREA_ANSWERS = 6;

const STRONG_ACCURACY = 0.85;

export async function loadStrongAreas({
  graph,
  lessons,
  userId,
}: {
  graph: PlanGraph;
  lessons: readonly PlannerLesson[];
  userId: string;
}): Promise<Set<string>> {
  const areaOf = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  const lessonArea = new Map(
    lessons.flatMap((lesson) => {
      const area = lesson.skillIds.map((skillId) => areaOf.get(skillId)).find(Boolean);
      return area ? [[lesson.lessonId, area] as const] : [];
    }),
  );

  const taught = await prisma.lessonSkill.findMany({
    select: { lessonId: true, skillId: true },
    where: { lessonId: { in: [...lessonArea.keys()] } },
  });

  const skillArea = new Map([
    ...taught.flatMap((row) => {
      const area = lessonArea.get(row.lessonId);
      return area ? [[row.skillId, area] as const] : [];
    }),
    ...areaOf,
  ]);

  const answers = await prisma.attempt.groupBy({
    _count: true,
    by: ["skillId", "isCorrect"],
    where: { skillId: { in: [...skillArea.keys()] }, userId },
  });

  const totals = answers.reduce((areas, row) => {
    const area = row.skillId ? skillArea.get(row.skillId) : undefined;

    if (!area) {
      return areas;
    }

    const total = areas.get(area) ?? { answered: 0, right: 0 };

    return areas.set(area, {
      answered: total.answered + row._count,
      right: total.right + (row.isCorrect ? row._count : 0),
    });
  }, new Map<string, { answered: number; right: number }>());

  return new Set(
    [...totals]
      .filter(
        ([, total]) =>
          total.answered >= MIN_AREA_ANSWERS && total.right / total.answered >= STRONG_ACCURACY,
      )
      .map(([area]) => area),
  );
}
