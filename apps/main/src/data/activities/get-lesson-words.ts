import "server-only";
import { type Word, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonWords = cache(async (lessonId: number): Promise<Word[]> => {
  const lessonWords = await prisma.lessonWord.findMany({
    include: { word: true },
    where: { lessonId },
  });

  return lessonWords.map((lw) => lw.word);
});

export function getLessonWords(params: { lessonId: number }): Promise<Word[]> {
  return cachedGetLessonWords(params.lessonId);
}
