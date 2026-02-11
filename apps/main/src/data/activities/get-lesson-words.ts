import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type LessonWordData = {
  id: bigint;
  word: string;
  translation: string;
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

const cachedGetLessonWords = cache(async (lessonId: number): Promise<LessonWordData[]> => {
  const lessonWords = await prisma.lessonWord.findMany({
    select: {
      word: {
        select: {
          audioUrl: true,
          id: true,
          pronunciation: true,
          romanization: true,
          translation: true,
          word: true,
        },
      },
    },
    where: { lessonId },
  });

  return lessonWords.map((lw) => lw.word);
});

export function getLessonWords(params: { lessonId: number }): Promise<LessonWordData[]> {
  return cachedGetLessonWords(params.lessonId);
}
