import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { type LessonSupport } from "../contract";

/** A sitting keeps the opening order it started with, even after its first answer trains a skill. */
export function getRunLessonSupport(run: Pick<LearningEvent, "contentIds">): LessonSupport | null {
  const support = getString(run.contentIds, "support");
  return support === "explanationFirst" || support === "questionFirst" ? support : null;
}

/**
 * The skills a lesson opens with: the skill of its first screen after the hook that has one, or
 * all its skills when no screen says.
 */
async function loadOpeningSkillIds({
  client,
  lessonId,
}: {
  client: TransactionClient;
  lessonId: string;
}): Promise<string[]> {
  const [opening, lessonSkills] = await Promise.all([
    client.step.findFirst({
      orderBy: { position: "asc" },
      select: { skillId: true },
      where: { kind: { not: "hook" }, lessonId, skillId: { not: null }, ...CURRENT_STEPS },
    }),
    client.lessonSkill.findMany({ select: { skillId: true }, where: { lessonId } }),
  ]);

  return opening?.skillId ? [opening.skillId] : lessonSkills.map((row) => row.skillId);
}

/**
 * How a lesson opens for one learner. A skill they never answered starts with its explanation; a
 * skill they already answered (placement, a test-out, lessons or reviews) starts with a question,
 * so they use what they know before being told. Lessons without skills keep their own order.
 */
export async function loadLessonSupport({
  client = prisma,
  lessonId,
  userId,
}: {
  client?: TransactionClient;
  lessonId: string;
  userId: string;
}): Promise<LessonSupport | null> {
  const skillIds = await loadOpeningSkillIds({ client, lessonId });

  if (skillIds.length === 0) {
    return null;
  }

  const seen = await client.learnerSkill.findFirst({
    select: { id: true },
    where: { reps: { gt: 0 }, skillId: { in: skillIds }, userId },
  });

  return seen ? "questionFirst" : "explanationFirst";
}
