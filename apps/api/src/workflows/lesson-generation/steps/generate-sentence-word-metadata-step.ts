import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateTranslation } from "@zoonk/ai/tasks/lessons/language/translation";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

async function fetchExistingWordRomanizations(params: {
  organizationId: string;
  targetLanguage: string;
  words: string[];
}): Promise<Record<string, string | null>> {
  const existing = await prisma.word.findMany({
    where: {
      organizationId: params.organizationId,
      targetLanguage: params.targetLanguage,
      word: { in: params.words, mode: "insensitive" },
    },
  });

  return Object.fromEntries(
    existing.map((record) => [record.word.toLowerCase(), record.romanization]),
  );
}

async function translateWord({
  targetLanguage,
  userLanguage,
  word,
}: {
  targetLanguage: string;
  userLanguage: string;
  word: string;
}): Promise<{ translation: string; word: string }> {
  const { data: result, error } = await safeAsync(() =>
    generateTranslation({ targetLanguage, userLanguage, word }),
  );

  if (error || !result?.data) {
    throw error ?? new Error("translationGenerationFailed");
  }

  return { translation: result.data.translation, word };
}

async function generateMissingTranslations({
  targetLanguage,
  userLanguage,
  words,
}: {
  targetLanguage: string;
  userLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  const results = await Promise.all(
    words.map((word) => translateWord({ targetLanguage, userLanguage, word })),
  );

  return Object.fromEntries(results.map((result) => [result.word, result.translation]));
}

export async function generateSentenceWordMetadataStep({
  context,
  sentences,
  targetWords,
}: {
  context: LessonContext;
  sentences: ReadingLessonContent["sentences"];
  targetWords: string[];
}): Promise<{ wordMetadata: Record<string, WordMetadataEntry> }> {
  "use step";

  const course = context.chapter.course;

  if (sentences.length === 0 || targetWords.length === 0 || !course.organization) {
    return { wordMetadata: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateSentenceWordMetadata" });

  const targetLanguage = course.targetLanguage ?? "";
  const canonicalWords = extractUniqueSentenceWords(sentences.map((entry) => entry.sentence));
  const existingRomanizations = await fetchExistingWordRomanizations({
    organizationId: course.organization.id,
    targetLanguage,
    words: targetWords,
  });
  const wordsNeedingRomanization = targetWords.filter(
    (word) => !existingRomanizations[word.toLowerCase()],
  );
  const [translations, newRomanizations] = await Promise.all([
    generateMissingTranslations({
      targetLanguage,
      userLanguage: context.language,
      words: canonicalWords,
    }),
    needsRomanization(targetLanguage)
      ? generateLessonRomanizations({
          targetLanguage,
          texts: wordsNeedingRomanization,
        })
      : Promise.resolve<Record<string, string>>({}),
  ]);

  if (Object.keys(translations).length !== canonicalWords.length) {
    throw new Error("translationGenerationFailed");
  }

  await stream.status({ status: "completed", step: "generateSentenceWordMetadata" });

  return {
    wordMetadata: Object.fromEntries(
      targetWords.map((word) => [
        word,
        {
          romanization: existingRomanizations[word.toLowerCase()] ?? newRomanizations[word] ?? null,
          translation: translations[word] ?? "",
        },
      ]),
    ),
  };
}
