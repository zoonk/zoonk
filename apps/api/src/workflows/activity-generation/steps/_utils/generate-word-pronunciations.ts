import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type PronunciationEntry = {
  pronunciation: string;
  word: string;
};

/**
 * Generates missing pronunciations for target-language words by surface text.
 *
 * Pronunciation is meaning-independent, so one `WordPronunciation` record can be reused
 * across canonical lesson words and generated distractor words. Querying by word text
 * lets the workflow enrich words before it knows which database IDs will be reused.
 */
export async function generateWordPronunciations(params: {
  organizationId: number;
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
  organizationId: number;
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
  const results = await Promise.all(
    params.words.map(async (word) => {
      const { data: result, error } = await safeAsync(() =>
        generateActivityPronunciation({
          targetLanguage: params.targetLanguage,
          userLanguage: params.userLanguage,
          word,
        }),
      );

      if (error || !result?.data) {
        return null;
      }

      return {
        pronunciation: result.data.pronunciation,
        word,
      };
    }),
  );

  return results.filter((entry): entry is PronunciationEntry => entry !== null);
}
