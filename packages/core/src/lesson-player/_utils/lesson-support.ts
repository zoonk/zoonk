import "server-only";
import { prisma } from "@zoonk/db";
import { type LessonSupport } from "../contract";

/**
 * The skills a lesson opens with: the skill of its first screen after the hook that has one, or
 * all its skills when no screen says.
 */
async function loadOpeningSkillIds(lessonId: string): Promise<string[]> {
  const [opening, lessonSkills] = await Promise.all([
    prisma.step.findFirst({
      orderBy: { position: "asc" },
      select: { skillId: true },
      where: { kind: { not: "hook" }, lessonId, skillId: { not: null } },
    }),
    prisma.lessonSkill.findMany({ select: { skillId: true }, where: { lessonId } }),
  ]);

  return opening?.skillId ? [opening.skillId] : lessonSkills.map((row) => row.skillId);
}

/**
 * How a lesson opens for one learner. A skill they never answered starts with its explanation; a
 * skill they already answered (placement, a test-out, lessons or reviews) starts with a question,
 * so they use what they know before being told. Lessons without skills keep their own order.
 */
export async function loadLessonSupport({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<LessonSupport | null> {
  const skillIds = await loadOpeningSkillIds(lessonId);

  if (skillIds.length === 0) {
    return null;
  }

  const seen = await prisma.learnerSkill.findFirst({
    select: { id: true },
    where: { reps: { gt: 0 }, skillId: { in: skillIds }, userId },
  });

  return seen ? "questionFirst" : "explanationFirst";
}
