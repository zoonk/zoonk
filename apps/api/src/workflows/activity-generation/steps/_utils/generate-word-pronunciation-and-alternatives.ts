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
 * Checks which words are missing `pronunciation` or `alternativeTranslations`
 * by querying existing `WordPronunciation` and `LessonWord` records by word
 * TEXT (not by saved IDs). Generates missing fields via AI and returns
 * them for downstream persistence.
 *
 * This step is a pure data producer — it does NOT write to the database.
 * The save step is responsible for persisting the returned data.
 *
 * Alternative translations prevent semantically equivalent words from
 * appearing as distractors (wrong answer options) in exercises — e.g.
 * not showing "good night" as a distractor when testing "boa noite"
 * since both translations are correct.
 *
 * Pronunciation and alternatives live in separate tables because they have
 * different scoping: pronunciation is meaning-independent (keyed on `wordId +
 * userLanguage` via `WordPronunciation`), while alternatives are lesson-scoped
 * (keyed on `lessonId + wordId` via `LessonWord`) because "banco" has different
 * synonyms when it means "bank" vs "bench".
 *
 * This is the single source of truth for generating pronunciation and
 * alternativeTranslations via AI. Both the vocabulary and reading workflows
 * call this, so adding a new field here automatically covers all sources.
 */
export async function generateWordPronunciationAndAlternatives(params: {
  lessonId: number;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  words: WordReference[];
}): Promise<GeneratedWordTranslationFields> {
  const { lessonId, organizationId, targetLanguage, userLanguage, words } = params;

  if (words.length === 0) {
    return { alternatives: {}, pronunciations: {} };
  }

  const wordTexts = words.map((ref) => ref.word);

  const existingRecords = await fetchExistingTranslationsByWordText({
    lessonId,
    organizationId,
    targetLanguage,
    userLanguage,
    wordTexts,
  });

  const existingByWord = new Map(
    existingRecords.map((record) => [record.word.toLowerCase(), record]),
  );

  const newWords = findWordsNewToLesson(words, existingByWord);

  const needsPronunciation: { word: string }[] = [
    ...existingRecords.filter((record) => !record.pronunciation),
    ...newWords.filter((ref) => !existingByWord.has(ref.word.toLowerCase())),
  ];

  const needsAlternatives: { translation: string; word: string }[] = [
    ...existingRecords
      .filter((record) => record.alternativeTranslations.length === 0 && record.translation)
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
 * Finds words that need to be treated as "new to this lesson" for
 * alternatives generation. A word is new if either:
 * 1. It doesn't exist in the DB at all (brand-new word), or
 * 2. It exists in the DB but has no LessonWord in the current lesson
 *    (empty translation), so the caller-provided translation should be
 *    used for alternatives generation instead.
 */
function findWordsNewToLesson(
  words: WordReference[],
  existingByWord: Map<string, ExistingTranslationRecord>,
): WordReference[] {
  return words.filter((ref) => {
    const existing = existingByWord.get(ref.word.toLowerCase());
    return !existing || !existing.translation;
  });
}

/**
 * Queries existing `WordPronunciation` and `LessonWord` records by word text
 * instead of word IDs. This allows the pronunciation step to run before
 * words are saved to the DB, while still skipping AI generation for words
 * that already have the relevant data.
 *
 * Pronunciation comes from `WordPronunciation` (meaning-independent, keyed
 * on `wordId + userLanguage`). Alternatives come from `LessonWord` (lesson-scoped,
 * keyed on `lessonId + wordId`) because the same word can have different
 * synonyms depending on which meaning the lesson teaches.
 */
async function fetchExistingTranslationsByWordText(params: {
  lessonId: number;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
  wordTexts: string[];
}): Promise<ExistingTranslationRecord[]> {
  const { lessonId, organizationId, targetLanguage, userLanguage, wordTexts } = params;

  const wordRecords = await prisma.word.findMany({
    include: {
      lessons: {
        where: { lessonId },
      },
      pronunciations: {
        where: { userLanguage },
      },
    },
    where: {
      organizationId,
      targetLanguage,
      word: { in: wordTexts, mode: "insensitive" },
    },
  });

  return wordRecords.map((record) => {
    const lessonWord = record.lessons[0];
    const pronunciation = record.pronunciations[0]?.pronunciation ?? null;

    return {
      alternativeTranslations: lessonWord?.alternativeTranslations ?? [],
      pronunciation,
      translation: lessonWord?.translation ?? "",
      word: record.word,
    };
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
