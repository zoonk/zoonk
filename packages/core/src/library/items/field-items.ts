import "server-only";
import { type Skill, prisma } from "@zoonk/db";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { ITEM_WRITING_SKILL_SELECT, type ItemWritingSkill } from "./item-writing-skill";
import { loadUsedSituations } from "./used-situations";

export const FIELD_ITEMS_PER_SKILL = 4;

const MAX_FIELD_SKILLS = 8;

type FieldItemSkill = Omit<ItemWritingSkill, "targetLanguage"> & Pick<Skill, "example">;

export type FieldItemTarget = { field: string; skill: FieldItemSkill; usedSituations: string[] };

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
      select: { ...ITEM_WRITING_SKILL_SELECT, example: true },
      where: { id: { in: uniqueSkillIds }, mergedIntoId: null },
    }),
    prisma.item.groupBy({
      _count: { id: true },
      by: ["skillId"],
      where: { field, skillId: { in: uniqueSkillIds } },
    }),
  ]);

  const countBySkill = new Map(fieldItemCounts.map((row) => [row.skillId, row._count.id]));

  const targets = skillIds
    .flatMap((skillId) => skills.find((skill) => skill.id === skillId) ?? [])
    .filter(
      (skill) => !skill.targetLanguage && (countBySkill.get(skill.id) ?? 0) < FIELD_ITEMS_PER_SKILL,
    )
    .slice(0, MAX_FIELD_SKILLS);

  const usedSituations = await loadUsedSituations({
    field,
    includeMockReserve: true,
    skillIds: targets.map((skill) => skill.id),
  });

  return targets.map(({ targetLanguage: _targetLanguage, ...skill }) => ({
    field,
    skill,
    usedSituations: usedSituations.get(skill.id) ?? [],
  }));
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
