import "server-only";
import { type Sentence, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonSentences = cache(async (lessonId: number): Promise<Sentence[]> => {
  const lessonSentences = await prisma.lessonSentence.findMany({
    include: { sentence: true },
    where: { lessonId },
  });

  return lessonSentences.map((ls) => ls.sentence);
});

export function getLessonSentences(params: { lessonId: number }): Promise<Sentence[]> {
  return cachedGetLessonSentences(params.lessonId);
}
