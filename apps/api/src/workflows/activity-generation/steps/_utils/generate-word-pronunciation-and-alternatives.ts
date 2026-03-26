import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { generateWordAlternativeTranslations } from "@zoonk/ai/tasks/activities/language/word-alternative-translations";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type WordReference = {
  /** Optional translation from the AI generation step, used for new words not yet in the DB. */
  translation?: string;
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

  const newWords = findNewWords(words, existingByWord);

  const needsPronunciation: { word: string }[] = [
    ...existingRecords.filter((record) => !record.pronunciation),
    ...newWords,
  ];

  const needsAlternatives: { translation: string; word: string }[] = [
    ...existingRecords
      .filter((record) => record.alternativeTranslations.length === 0)
      .map((record) => ({ translation: record.translation, word: record.word })),
    ...newWords
      .filter((entry): entry is WordReference & { translation: string } =>
        Boolean(entry.translation),
      )
      .map((entry) => ({ translation: entry.translation, word: entry.word })),
  ];

  const [pronunciationResults, alternativeResults] = await Promise.all([
    generateMissingPronunciations({
      records: needsPronunciation,
      targetLanguage,
      userLanguage,
    }),
    generateMissingAlternatives({
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
 * Finds words from the request that have no existing DB record.
 * These are brand-new words being generated for the first time.
 * Uses case-insensitive matching to avoid false positives from casing differences.
 */
function findNewWords(
  words: WordReference[],
  existingByWord: Map<string, ExistingTranslationRecord>,
): WordReference[] {
  const existingLower = new Set([...existingByWord.keys()].map((key) => key.toLowerCase()));
  return words.filter((ref) => !existingLower.has(ref.word.toLowerCase()));
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

/**
 * Generates pronunciation via AI for each word in the list.
 * Accepts any object with a `word` field so it works for both
 * existing DB records (missing pronunciation) and brand-new words.
 */
async function generateMissingPronunciations(params: {
  records: { word: string }[];
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

/**
 * Generates alternative translations via AI for each word in the list.
 * Each record must include a `translation` so the AI can produce
 * semantically equivalent alternatives. Records without a translation
 * are filtered out by the caller.
 */
async function generateMissingAlternatives(params: {
  records: { translation: string; word: string }[];
  targetLanguage: string;
  userLanguage: string;
}): Promise<AlternativeEntry[]> {
  const { records, targetLanguage, userLanguage } = params;

  const results = await Promise.all(
    records.map(async (record) => {
      const { data: result, error } = await safeAsync(() =>
        generateWordAlternativeTranslations({
          targetLanguage,
          translation: record.translation,
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
