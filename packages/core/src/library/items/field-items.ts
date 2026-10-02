import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { parsePlanGraph } from "../../plans/planner/plan-state";

/** Enough questions for a few days of practice and reviews on a skill; more can come later. */
export const FIELD_ITEMS_PER_SKILL = 4;

/** The skills one preparation writes field questions for, so a big phase doesn't write all at once. */
const MAX_FIELD_SKILLS = 8;

type FieldItemSkill = {
  description: string;
  example: string | null;
  id: string;
  language: string;
  level: CourseLevel | null;
  name: string;
  /** Set for a private course's skill, whose questions are personal content. */
  ownerId: string | null;
};

export type FieldItemTarget = { field: string; skill: FieldItemSkill };

/**
 * The skills, in the order given, that don't have a field's questions yet. Field questions are
 * shared by everyone in the field, so a skill another learner in it already has them for is
 * skipped and nothing is written twice.
 */
async function findSkillsWithoutFieldItems({
  field,
  skillIds,
}: {
  field: string;
  skillIds: readonly string[];
}): Promise<FieldItemTarget[]> {
  const skills = await prisma.skill.findMany({
    select: {
      _count: { select: { items: { where: { field } } } },
      description: true,
      example: true,
      id: true,
      language: true,
      level: true,
      name: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: { id: { in: [...new Set(skillIds)] }, mergedIntoId: null },
  });

  return skillIds
    .flatMap((skillId) => skills.find((skill) => skill.id === skillId) ?? [])
    .filter((skill) => !skill.targetLanguage && skill._count.items < FIELD_ITEMS_PER_SKILL)
    .slice(0, MAX_FIELD_SKILLS)
    .map(({ _count, targetLanguage: _targetLanguage, ...skill }) => ({ field, skill }));
}

/**
 * The first phase's skills that need questions in the goal's field: written while placement runs,
 * so the first practice and reviews are already set in the learner's work.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
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

/**
 * The skills of the lessons a learner reaches soon that need questions in their field, written
 * ahead of the practice and reviews that follow those lessons.
 */
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
