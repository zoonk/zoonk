import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonWords = cache(async (lessonId: number) => {
  const lessonWords = await prisma.lessonWord.findMany({
    include: { word: { include: { translations: true } } },
    where: { lessonId },
  });

  return lessonWords.map((lw) => lw.word);
});

export function getLessonWords(params: { lessonId: number }) {
  return cachedGetLessonWords(params.lessonId);
}
