import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateWordAlternativeTranslations } from "@zoonk/ai/tasks/activities/language/word-alternative-translations";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type WordReference = {
  word: string;
  wordId: number;
};

type EnrichmentResult = {
  alternatives: Record<string, string[]>;
  pronunciations: Record<string, string>;
};

type ExistingTranslation = {
  alternativeTranslations: string[];
  pronunciation: string | null;
  translation: string;
  wordId: bigint;
};

type PronunciationEntry = { pronunciation: string; word: string; wordId: number };

type AlternativeEntry = {
  alternativeTranslations: string[];
  word: string;
  wordId: number;
};

/**
 * Checks which WordTranslation records are missing pronunciation or
 * alternativeTranslations, generates them via AI, and writes the results
 * to the database. Returns the generated enrichments for downstream use.
 *
 * Alternative translations prevent semantically equivalent words from
 * appearing as distractors (wrong answer options) in exercises — e.g.
 * not showing "good night" as a distractor when testing "boa noite"
 * since both translations are correct.
 *
 * This is the single source of truth for WordTranslation-level enrichments.
 * Both the vocabulary and reading workflows call this after saving words,
 * so adding a new enrichment here automatically covers all word sources.
 */
export async function enrichWordTranslations(params: {
  targetLanguage: string;
  userLanguage: string;
  words: WordReference[];
}): Promise<EnrichmentResult> {
  const { targetLanguage, userLanguage, words } = params;

  if (words.length === 0) {
    return { alternatives: {}, pronunciations: {} };
  }

  const wordIds = words.map((saved) => BigInt(saved.wordId));

  const existing = await prisma.wordTranslation.findMany({
    select: {
      alternativeTranslations: true,
      pronunciation: true,
      translation: true,
      wordId: true,
    },
    where: {
      userLanguage,
      wordId: { in: wordIds },
    },
  });

  const wordById = new Map(words.map((saved) => [saved.wordId, saved.word]));

  const needsPronunciation = existing.filter((record) => !record.pronunciation);
  const needsAlternatives = existing.filter(
    (record) => record.alternativeTranslations.length === 0,
  );

  const [pronunciationResults, alternativeResults] = await Promise.all([
    generateMissingPronunciations({
      records: needsPronunciation,
      targetLanguage,
      userLanguage,
      wordById,
    }),
    generateMissingAlternatives({
      records: needsAlternatives,
      targetLanguage,
      userLanguage,
      wordById,
    }),
  ]);

  await persistEnrichments({ alternativeResults, pronunciationResults, userLanguage });

  return {
    alternatives: Object.fromEntries(
      alternativeResults.map(({ alternativeTranslations, word }) => [
        word,
        alternativeTranslations,
      ]),
    ),
    pronunciations: Object.fromEntries(
      pronunciationResults.map(({ pronunciation, word }) => [word, pronunciation]),
    ),
  };
}

async function generateMissingPronunciations(params: {
  records: ExistingTranslation[];
  targetLanguage: string;
  userLanguage: string;
  wordById: Map<number, string>;
}): Promise<PronunciationEntry[]> {
  const { records, targetLanguage, userLanguage, wordById } = params;

  const results = await Promise.all(
    records.map(async (record) => {
      const word = wordById.get(Number(record.wordId));

      if (!word) {
        return null;
      }

      const { data: result, error } = await safeAsync(() =>
        generateActivityPronunciation({ targetLanguage, userLanguage, word }),
      );

      if (error || !result?.data) {
        return null;
      }

      return {
        pronunciation: result.data.pronunciation,
        word,
        wordId: Number(record.wordId),
      };
    }),
  );

  return results.filter((entry): entry is PronunciationEntry => entry !== null);
}

async function generateMissingAlternatives(params: {
  records: ExistingTranslation[];
  targetLanguage: string;
  userLanguage: string;
  wordById: Map<number, string>;
}): Promise<AlternativeEntry[]> {
  const { records, targetLanguage, userLanguage, wordById } = params;

  const results = await Promise.all(
    records.map(async (record) => {
      const word = wordById.get(Number(record.wordId));

      if (!word) {
        return null;
      }

      const { data: result, error } = await safeAsync(() =>
        generateWordAlternativeTranslations({
          targetLanguage,
          translation: record.translation,
          userLanguage,
          word,
        }),
      );

      if (error || !result?.data) {
        return null;
      }

      return {
        alternativeTranslations: result.data.alternativeTranslations,
        word,
        wordId: Number(record.wordId),
      };
    }),
  );

  return results.filter((entry): entry is AlternativeEntry => entry !== null);
}

/**
 * Writes generated pronunciation and alternativeTranslations to the
 * corresponding WordTranslation records in a single transaction.
 */
async function persistEnrichments(params: {
  alternativeResults: AlternativeEntry[];
  pronunciationResults: PronunciationEntry[];
  userLanguage: string;
}): Promise<void> {
  const { alternativeResults, pronunciationResults, userLanguage } = params;

  const pronunciationByWordId = new Map(
    pronunciationResults.map((entry) => [entry.wordId, entry.pronunciation]),
  );

  const alternativesByWordId = new Map(
    alternativeResults.map((entry) => [entry.wordId, entry.alternativeTranslations]),
  );

  const allWordIds = [
    ...new Set([
      ...pronunciationResults.map((entry) => entry.wordId),
      ...alternativeResults.map((entry) => entry.wordId),
    ]),
  ];

  if (allWordIds.length === 0) {
    return;
  }

  const updates = allWordIds.map((wordId) => {
    const data: { alternativeTranslations?: string[]; pronunciation?: string } = {};
    const pronunciation = pronunciationByWordId.get(wordId);
    const alternatives = alternativesByWordId.get(wordId);

    if (pronunciation) {
      data.pronunciation = pronunciation;
    }

    if (alternatives && alternatives.length > 0) {
      data.alternativeTranslations = alternatives;
    }

    return prisma.wordTranslation.update({
      data,
      where: { wordTranslation: { userLanguage, wordId: BigInt(wordId) } },
    });
  });

  await safeAsync(() => prisma.$transaction(updates));
}
