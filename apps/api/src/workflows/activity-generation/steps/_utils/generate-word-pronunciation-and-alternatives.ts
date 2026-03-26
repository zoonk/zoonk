import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateWordAlternativeTranslations } from "@zoonk/ai/tasks/activities/language/word-alternative-translations";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type WordReference = {
  word: string;
};

type GeneratedWordTranslationFields = {
  alternatives: Record<string, string[]>;
  pronunciations: Record<string, string>;
};

type PronunciationEntry = { pronunciation: string; word: string };

type AlternativeEntry = {
  alternativeTranslations: string[];
  word: string;
};

type ExistingTranslationRecord = {
  alternativeTranslations: string[];
  pronunciation: string | null;
  translation: string;
  word: string;
};

/**
 * Checks which words are missing pronunciation or alternativeTranslations
 * by querying existing WordTranslation records by word TEXT (not by saved IDs).
 * Generates missing fields via AI and returns them for downstream persistence.
 *
 * This step is a pure data producer — it does NOT write to the database.
 * The save step is responsible for persisting the returned data.
 *
 * Alternative translations prevent semantically equivalent words from
 * appearing as distractors (wrong answer options) in exercises — e.g.
 * not showing "good night" as a distractor when testing "boa noite"
 * since both translations are correct.
 *
 * This is the single source of truth for generating WordTranslation
 * fields that require AI (pronunciation and alternativeTranslations).
 * Both the vocabulary and reading workflows call this, so adding a new
 * field here automatically covers all sources.
 */
export async function generateWordPronunciationAndAlternatives(params: {
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  words: WordReference[];
}): Promise<GeneratedWordTranslationFields> {
  const { organizationId, targetLanguage, userLanguage, words } = params;

  if (words.length === 0) {
    return { alternatives: {}, pronunciations: {} };
  }

  const wordTexts = words.map((ref) => ref.word);

  const existingRecords = await fetchExistingTranslationsByWordText({
    organizationId,
    targetLanguage,
    userLanguage,
    wordTexts,
  });

  const existingByWord = new Map(existingRecords.map((record) => [record.word, record]));

  const needsPronunciation = existingRecords.filter((record) => !record.pronunciation);
  const needsAlternatives = existingRecords.filter(
    (record) => record.alternativeTranslations.length === 0,
  );

  const [pronunciationResults, alternativeResults] = await Promise.all([
    generateMissingPronunciations({
      records: needsPronunciation,
      targetLanguage,
      userLanguage,
    }),
    generateMissingAlternatives({
      existingByWord,
      records: needsAlternatives,
      targetLanguage,
      userLanguage,
    }),
  ]);

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

/**
 * Queries existing WordTranslation records by word text instead of word IDs.
 * This allows the pronunciation step to run before words are saved to the DB,
 * while still skipping AI generation for words that already have translations.
 */
async function fetchExistingTranslationsByWordText(params: {
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  wordTexts: string[];
}): Promise<ExistingTranslationRecord[]> {
  const { organizationId, targetLanguage, userLanguage, wordTexts } = params;

  const wordRecords = await prisma.word.findMany({
    include: {
      translations: {
        where: { userLanguage },
      },
    },
    where: {
      organizationId,
      targetLanguage,
      word: { in: wordTexts, mode: "insensitive" },
    },
  });

  return wordRecords.flatMap((record) => {
    const translation = record.translations[0];

    if (!translation) {
      return [];
    }

    return [
      {
        alternativeTranslations: translation.alternativeTranslations,
        pronunciation: translation.pronunciation,
        translation: translation.translation,
        word: record.word,
      },
    ];
  });
}

async function generateMissingPronunciations(params: {
  records: ExistingTranslationRecord[];
  targetLanguage: string;
  userLanguage: string;
}): Promise<PronunciationEntry[]> {
  const { records, targetLanguage, userLanguage } = params;

  const results = await Promise.all(
    records.map(async (record) => {
      const { data: result, error } = await safeAsync(() =>
        generateActivityPronunciation({ targetLanguage, userLanguage, word: record.word }),
      );

      if (error || !result?.data) {
        return null;
      }

      return {
        pronunciation: result.data.pronunciation,
        word: record.word,
      };
    }),
  );

  return results.filter((entry): entry is PronunciationEntry => entry !== null);
}

async function generateMissingAlternatives(params: {
  existingByWord: Map<string, ExistingTranslationRecord>;
  records: ExistingTranslationRecord[];
  targetLanguage: string;
  userLanguage: string;
}): Promise<AlternativeEntry[]> {
  const { existingByWord, records, targetLanguage, userLanguage } = params;

  const results = await Promise.all(
    records.map(async (record) => {
      const existing = existingByWord.get(record.word);
      const translation = existing?.translation ?? "";

      if (!translation) {
        return null;
      }

      const { data: result, error } = await safeAsync(() =>
        generateWordAlternativeTranslations({
          targetLanguage,
          translation,
          userLanguage,
          word: record.word,
        }),
      );

      if (error || !result?.data) {
        return null;
      }

      return {
        alternativeTranslations: result.data.alternativeTranslations,
        word: record.word,
      };
    }),
  );

  return results.filter((entry): entry is AlternativeEntry => entry !== null);
}
