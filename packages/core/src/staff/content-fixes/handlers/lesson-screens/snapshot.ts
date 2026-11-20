import { type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../../../../library/lessons/lesson-versions";
import { snapshotSchema } from "./schema";

export async function readLessonScreens(db: TransactionClient, id: string) {
  const lesson = await db.lesson.findUnique({
    select: {
      language: true,
      sentences: { include: { sentence: true }, orderBy: { position: "asc" } },
      skills: { select: { skillId: true } },
      steps: {
        include: {
          answerExplanations: { orderBy: [{ language: "asc" }, { normalizedAnswer: "asc" }] },
          optionPictures: { orderBy: { optionId: "asc" } },
          sharedTutorAnswers: { orderBy: { suggestion: "asc" } },
          sources: { orderBy: { sourceId: "asc" } },
          variants: { orderBy: [{ kind: "asc" }, { key: "asc" }] },
        },
        orderBy: { position: "asc" },
        where: CURRENT_STEPS,
      },
      summary: true,
      targetLanguage: true,
      words: { include: { word: true }, orderBy: { position: "asc" } },
    },
    where: { id },
  });

  if (!lesson) {
    return null;
  }

  const before = snapshotSchema.parse({
    screens: lesson.steps.map((step) => ({
      ...step,
      pictureAvailableAt: step.pictureAvailableAt?.toISOString() ?? null,
      pictureRemovedAt: step.pictureRemovedAt?.toISOString() ?? null,
    })),
    sentences: lesson.sentences.map((link) => ({
      ...link,
      ...link.sentence,
      ordersOwedAt: link.ordersOwedAt?.toISOString() ?? null,
    })),
    summary: lesson.summary,
    version: lesson.steps[0]?.version ?? 0,
    words: lesson.words.map((link) => ({ ...link, ...link.word })),
  });

  return {
    before,
    language: lesson.language,
    skillIds: lesson.skills.map((link) => link.skillId),
    targetLanguage: lesson.targetLanguage,
  };
}
export type ScreenLesson = NonNullable<Awaited<ReturnType<typeof readLessonScreens>>>;
