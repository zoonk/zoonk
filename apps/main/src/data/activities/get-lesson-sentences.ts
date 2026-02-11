import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type LessonSentenceData = {
  id: bigint;
  sentence: string;
  translation: string;
  romanization: string | null;
  audioUrl: string | null;
};

const cachedGetLessonSentences = cache(async (lessonId: number): Promise<LessonSentenceData[]> => {
  const lessonSentences = await prisma.lessonSentence.findMany({
    select: {
      sentence: {
        select: {
          audioUrl: true,
          id: true,
          romanization: true,
          sentence: true,
          translation: true,
        },
      },
    },
    where: { lessonId },
  });

  return lessonSentences.map((ls) => ls.sentence);
});

export function getLessonSentences(params: { lessonId: number }): Promise<LessonSentenceData[]> {
  return cachedGetLessonSentences(params.lessonId);
}
