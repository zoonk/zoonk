import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { type LessonSupport } from "../contract";

/** Preserve the run's opening order even after its first answer trains the skill. */
export function getRunLessonSupport(run: Pick<LearningEvent, "contentIds">): LessonSupport | null {
  const support = getString(run.contentIds, "support");
  return support === "explanationFirst" || support === "questionFirst" ? support : null;
}

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

/** Skills never answered open explanation-first; lessons without skills retain their own order. */
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
