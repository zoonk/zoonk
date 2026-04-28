import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { emptyToNull, normalizePunctuation } from "@zoonk/utils/string";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { saveReadingTargetWords } from "./_utils/save-reading-target-words";
import { type WordMetadataEntry } from "./generate-sentence-word-metadata-step";
import { type LessonContext } from "./get-lesson-step";

type ReadingSentence = ReadingLessonContent["sentences"][number];

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

  await prisma.step.deleteMany({ where: { lessonId: params.context.id } });

  await Promise.all(
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
  );

  await saveReadingTargetWords({
    distractors: params.distractors,
    lessonId: params.context.id,
    organizationId,
    pronunciations: params.pronunciations,
    sentences: params.sentences,
    targetLanguage,
    userLanguage: params.context.language,
    wordAudioUrls: params.wordAudioUrls,
    wordMetadata: params.wordMetadata,
  });

  await stream.status({ status: "completed", step: "saveReadingLesson" });
}

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
}): Promise<void> {
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
    update: {
      ...(audioUrl ? { audioUrl } : {}),
      ...(romanization ? { romanization } : {}),
    },
    where: {
      orgSentence: {
        organizationId: params.organizationId,
        sentence,
        targetLanguage: params.targetLanguage,
      },
    },
  });

  await prisma.lessonSentence.upsert({
    create: {
      distractors: sentenceDistractors,
      explanation: emptyToNull(params.readingSentence.explanation),
      lessonId: params.context.id,
      sentenceId: record.id,
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
    where: { lessonSentence: { lessonId: params.context.id, sentenceId: record.id } },
  });

  await prisma.step.create({
    data: {
      content: assertStepContent("reading", {}),
      isPublished: true,
      kind: "reading",
      lessonId: params.context.id,
      position: params.position,
      sentenceId: record.id,
    },
  });
}
