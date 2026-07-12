import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { emptyToNull, normalizePunctuation } from "@zoonk/utils/string";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { replaceLessonSteps } from "./_utils/replace-lesson-steps";
import { type StepRecord } from "./_utils/save-lesson-content-helpers";
import { saveReadingTargetWords } from "./_utils/save-reading-target-words";
import { type WordMetadataEntry } from "./generate-sentence-word-metadata-step";
import { type LessonContext } from "./get-lesson-step";

type ReadingSentence = ReadingLessonContent["sentences"][number];

/**
 * Reading persistence writes sentence steps and target-word metadata together
 * so the player and review lessons can read a consistent set of sentence,
 * distractor, audio, romanization, and pronunciation resources.
 */
export async function saveReadingLessonStep(params: {
  context: LessonContext;
  distractors: Record<string, string[]>;
  pronunciations: Record<string, string>;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  sentences: ReadingSentence[];
  translationDistractors: Record<string, string[]>;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
}): Promise<void> {
  "use step";

  const course = params.context.chapter.course;

  if (params.sentences.length === 0) {
    throw new Error("Reading save step received no sentences");
  }

  if (!course.organization || !course.targetLanguage) {
    throw new Error("Reading save step needs course language and organization data");
  }

  const organizationId = course.organization.id;
  const targetLanguage = course.targetLanguage;

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveReadingLesson" });

  const [sentenceSteps] = await Promise.all([
    Promise.all(
      params.sentences.map((readingSentence, position) =>
        saveOneSentence({
          context: params.context,
          distractors: params.distractors,
          organizationId,
          position,
          readingSentence,
          sentenceAudioUrls: params.sentenceAudioUrls,
          sentenceRomanizations: params.sentenceRomanizations,
          targetLanguage,
          translationDistractors: params.translationDistractors,
          userLanguage: params.context.language,
        }),
      ),
    ),
    saveReadingTargetWords({
      chapterId: params.context.chapterId,
      distractors: params.distractors,
      organizationId,
      pronunciations: params.pronunciations,
      sentences: params.sentences,
      sourceLessonId: params.context.id,
      targetLanguage,
      userLanguage: params.context.language,
      wordAudioUrls: params.wordAudioUrls,
      wordMetadata: params.wordMetadata,
    }),
  ]);

  await replaceLessonSteps({
    lessonId: params.context.id,
    saveSteps: async (transaction) => {
      await transaction.step.createMany({ data: sentenceSteps });
    },
  });

  await stream.status({ status: "completed", step: "saveReadingLesson" });
}

/**
 * Sentence rows hold reusable target-language metadata while chapter-sentence
 * resources hold generated translation, explanation, and distractor content.
 * Both rows must be upserted before the reading step can safely reference them.
 */
async function saveOneSentence(params: {
  context: LessonContext;
  distractors: Record<string, string[]>;
  organizationId: string;
  position: number;
  readingSentence: ReadingSentence;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  targetLanguage: string;
  translationDistractors: Record<string, string[]>;
  userLanguage: string;
}): Promise<StepRecord> {
  const sentence = normalizePunctuation(params.readingSentence.sentence);
  const translation = normalizePunctuation(params.readingSentence.translation);

  const sentenceDistractors = sanitizeDistractors({
    distractors: params.distractors[params.readingSentence.sentence] ?? [],
    input: params.readingSentence.sentence,
    shape: "single-word",
  });

  const sentenceTranslationDistractors = sanitizeDistractors({
    distractors: params.translationDistractors[params.readingSentence.translation] ?? [],
    input: params.readingSentence.translation,
    shape: "single-word",
  });

  const audioUrl = params.sentenceAudioUrls[params.readingSentence.sentence] ?? null;
  const romanization = params.sentenceRomanizations[params.readingSentence.sentence] ?? null;

  const record = await prisma.sentence.upsert({
    create: {
      audioUrl,
      organizationId: params.organizationId,
      romanization,
      sentence,
      targetLanguage: params.targetLanguage,
    },
    update: { ...(audioUrl ? { audioUrl } : {}), ...(romanization ? { romanization } : {}) },
    where: {
      orgSentence: {
        organizationId: params.organizationId,
        sentence,
        targetLanguage: params.targetLanguage,
      },
    },
  });

  const chapterSentence = await prisma.chapterSentence.upsert({
    create: {
      chapterId: params.context.chapterId,
      distractors: sentenceDistractors,
      explanation: emptyToNull(params.readingSentence.explanation),
      sentenceId: record.id,
      sourceLessonId: params.context.id,
      translation,
      translationDistractors: sentenceTranslationDistractors,
      userLanguage: params.userLanguage,
    },
    update: {
      distractors: sentenceDistractors,
      explanation: emptyToNull(params.readingSentence.explanation),
      translation,
      translationDistractors: sentenceTranslationDistractors,
    },
    where: { chapterSentenceSource: { sentenceId: record.id, sourceLessonId: params.context.id } },
  });

  return {
    chapterSentenceId: chapterSentence.id,
    content: assertStepContent("reading", {}),
    isPublished: true,
    kind: "reading",
    lessonId: params.context.id,
    position: params.position,
    sentenceId: record.id,
  };
}
