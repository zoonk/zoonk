import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { parsePlanGraph } from "../../plans/planner/plan-state";

export const FIELD_ITEMS_PER_SKILL = 4;

const MAX_FIELD_SKILLS = 8;

type FieldItemSkill = {
  description: string;
  example: string | null;
  id: string;
  language: string;
  level: CourseLevel | null;
  name: string;
  ownerId: string | null;
};

export type FieldItemTarget = { field: string; skill: FieldItemSkill };

async function findSkillsWithoutFieldItems({
  field,
  skillIds,
}: {
  field: string;
  skillIds: readonly string[];
}): Promise<FieldItemTarget[]> {
  const uniqueSkillIds = [...new Set(skillIds)];

  const [skills, fieldItemCounts] = await Promise.all([
    prisma.skill.findMany({
      select: {
        description: true,
        example: true,
        id: true,
        language: true,
        level: true,
        name: true,
        ownerId: true,
        targetLanguage: true,
      },
      where: { id: { in: uniqueSkillIds }, mergedIntoId: null },
    }),
    prisma.item.groupBy({
      _count: { id: true },
      by: ["skillId"],
      where: { field, skillId: { in: uniqueSkillIds } },
    }),
  ]);

  const countBySkill = new Map(fieldItemCounts.map((row) => [row.skillId, row._count.id]));

  return skillIds
    .flatMap((skillId) => skills.find((skill) => skill.id === skillId) ?? [])
    .filter(
      (skill) => !skill.targetLanguage && (countBySkill.get(skill.id) ?? 0) < FIELD_ITEMS_PER_SKILL,
    )
    .slice(0, MAX_FIELD_SKILLS)
    .map(({ targetLanguage: _targetLanguage, ...skill }) => ({ field, skill }));
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function listGoalFieldItemTargets({
  field,
  goalId,
}: {
  field: string;
  goalId: string;
}): Promise<FieldItemTarget[]> {
  const plan = await prisma.plan.findUnique({ select: { graph: true }, where: { goalId } });
  const { skills } = parsePlanGraph(plan?.graph);
  const firstPhase = Math.min(...skills.map((skill) => skill.phase));

  return findSkillsWithoutFieldItems({
    field,
    skillIds: skills.filter((skill) => skill.phase === firstPhase).map((skill) => skill.skillId),
  });
}

export async function listLessonFieldItemTargets({
  field,
  lessonIds,
}: {
  field: string;
  lessonIds: readonly string[];
}): Promise<FieldItemTarget[]> {
  const lessonSkills = await prisma.lessonSkill.findMany({
    orderBy: { createdAt: "asc" },
    select: { lessonId: true, skillId: true },
    where: { lessonId: { in: [...lessonIds] } },
  });

  const skillIds = lessonIds.flatMap((lessonId) =>
    lessonSkills.filter((row) => row.lessonId === lessonId).map((row) => row.skillId),
  );

  return findSkillsWithoutFieldItems({ field, skillIds });
}
