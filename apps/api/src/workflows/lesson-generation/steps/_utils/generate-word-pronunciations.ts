import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type PronunciationEntry = {
  pronunciation: string;
  word: string;
};

export async function generateWordPronunciations(params: {
  organizationId: string;
  targetLanguage: string;
  userLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  if (params.words.length === 0) {
    return {};
  }

  const existingPronunciations = await fetchExistingPronunciations(params);
  const wordsNeedingPronunciation = params.words.filter(
    (word) => !existingPronunciations[word.toLowerCase()],
  );
  const generatedPronunciations = await generateMissingPronunciations({
    targetLanguage: params.targetLanguage,
    userLanguage: params.userLanguage,
    words: wordsNeedingPronunciation,
  });

  return {
    ...Object.fromEntries(
      params.words.flatMap((word) => {
        const pronunciation = existingPronunciations[word.toLowerCase()];
        return pronunciation ? [[word, pronunciation]] : [];
      }),
    ),
    ...Object.fromEntries(
      generatedPronunciations.map((entry) => [entry.word, entry.pronunciation]),
    ),
  };
}

async function fetchExistingPronunciations(params: {
  organizationId: string;
  targetLanguage: string;
  userLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  const existingWords = await prisma.word.findMany({
    include: {
      pronunciations: {
        where: { userLanguage: params.userLanguage },
      },
    },
    where: {
      organizationId: params.organizationId,
      targetLanguage: params.targetLanguage,
      word: { in: params.words, mode: "insensitive" },
    },
  });

  return Object.fromEntries(
    existingWords.flatMap((record) => {
      const pronunciation = record.pronunciations[0]?.pronunciation;
      return pronunciation ? [[record.word.toLowerCase(), pronunciation]] : [];
    }),
  );
}

async function generateMissingPronunciations(params: {
  targetLanguage: string;
  userLanguage: string;
  words: string[];
}): Promise<PronunciationEntry[]> {
  return Promise.all(
    params.words.map(async (word) => {
      const { data: result, error } = await safeAsync(() =>
        generateLessonPronunciation({
          targetLanguage: params.targetLanguage,
          userLanguage: params.userLanguage,
          word,
        }),
      );

      if (error || !result?.data) {
        throw error ?? new Error("pronunciationGenerationFailed");
      }

      return {
        pronunciation: result.data.pronunciation,
        word,
      };
    }),
  );
}
