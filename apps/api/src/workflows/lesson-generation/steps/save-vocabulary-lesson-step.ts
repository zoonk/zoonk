import { createStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { deduplicateNormalizedTexts, normalizePunctuation } from "@zoonk/utils/string";
import { fetchExistingWordCasing } from "./_utils/fetch-existing-word-casing";
import { upsertWordWithPronunciation } from "./_utils/upsert-word-with-pronunciation";
import { type LessonContext } from "./get-lesson-step";

export async function saveVocabularyLessonStep({
  context,
  distractors,
  pronunciations,
  romanizations,
  wordAudioUrls,
  words,
}: {
  context: LessonContext;
  distractors: Record<string, string[]>;
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  wordAudioUrls: Record<string, string>;
  words: VocabularyWord[];
}): Promise<void> {
  "use step";

  if (words.length === 0) {
    throw new Error("Vocabulary save step received no words");
  }

  const course = context.chapter.course;

  if (!course.organization || !course.targetLanguage) {
    throw new Error("Vocabulary save step needs course language and organization data");
  }

  const organizationId = course.organization.id;
  const targetLanguage = course.targetLanguage;

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveVocabularyLesson" });

  await prisma.step.deleteMany({ where: { lessonId: context.id } });

  const allTargetWords = deduplicateNormalizedTexts([
    ...words.map((word) => word.word),
    ...words.flatMap((word) => distractors[word.word] ?? []),
  ]);
  const existingCasing = await fetchExistingWordCasing({
    organizationId,
    targetLanguage,
    words: allTargetWords,
  });
  const canonicalWordKeys = new Set(words.map((word) => word.word.toLowerCase()));
  const distractorWords = deduplicateNormalizedTexts(
    words.flatMap((word) => distractors[word.word] ?? []),
  ).filter((word) => !canonicalWordKeys.has(word.toLowerCase()));

  await Promise.all(
    words.map((word, position) =>
      saveOneVocabularyWord({
        context,
        distractors,
        existingCasing,
        organizationId,
        position,
        pronunciations,
        romanizations,
        targetLanguage,
        userLanguage: context.language,
        word,
        wordAudioUrls,
      }),
    ),
  );

  await Promise.all(
    distractorWords.map((word) => {
      const romanization = romanizations[word] ?? null;

      return upsertWordWithPronunciation({
        audioUrl: wordAudioUrls[word] ?? null,
        organizationId,
        pronunciation: pronunciations[word] ?? null,
        romanization,
        romanizationUpdate: romanization ? { romanization } : {},
        targetLanguage,
        userLanguage: context.language,
        word: existingCasing[word.toLowerCase()] ?? word,
      });
    }),
  );

  await stream.status({ status: "completed", step: "saveVocabularyLesson" });
}

async function saveOneVocabularyWord(params: {
  context: LessonContext;
  distractors: Record<string, string[]>;
  existingCasing: Record<string, string>;
  organizationId: string;
  position: number;
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  targetLanguage: string;
  userLanguage: string;
  word: VocabularyWord;
  wordAudioUrls: Record<string, string>;
}): Promise<void> {
  const dbWord = params.existingCasing[params.word.word.toLowerCase()] ?? params.word.word;
  const romanization = params.romanizations[params.word.word] ?? null;
  const wordDistractors = sanitizeDistractors({
    distractors: params.distractors[params.word.word] ?? [],
    input: params.word.word,
    shape: "any",
  });
  const wordId = await upsertWordWithPronunciation({
    audioUrl: params.wordAudioUrls[params.word.word] ?? null,
    organizationId: params.organizationId,
    pronunciation: params.pronunciations[params.word.word] ?? null,
    romanization,
    romanizationUpdate: romanization ? { romanization } : {},
    targetLanguage: params.targetLanguage,
    userLanguage: params.userLanguage,
    word: dbWord,
  });

  await prisma.lessonWord.upsert({
    create: {
      distractors: wordDistractors,
      lessonId: params.context.id,
      translation: normalizePunctuation(params.word.translation),
      userLanguage: params.userLanguage,
      wordId,
    },
    update: {
      distractors: wordDistractors,
      translation: normalizePunctuation(params.word.translation),
    },
    where: { lessonWord: { lessonId: params.context.id, wordId } },
  });

  await prisma.step.create({
    data: {
      content: assertStepContent("vocabulary", {}),
      isPublished: true,
      kind: "vocabulary",
      lessonId: params.context.id,
      position: params.position,
      wordId,
    },
  });
}
