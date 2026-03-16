import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonSentences = cache(async (lessonId: number) => {
  const lessonSentences = await prisma.lessonSentence.findMany({
    include: { sentence: { include: { sentenceAudio: true } } },
    where: { lessonId },
  });

  return lessonSentences.map((ls) => ls.sentence);
});

export function getLessonSentences(params: { lessonId: number }) {
  return cachedGetLessonSentences(params.lessonId);
}
