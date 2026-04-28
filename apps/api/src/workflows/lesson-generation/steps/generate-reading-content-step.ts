import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

async function getVocabularyWordsSincePreviousReading(context: LessonContext): Promise<string[]> {
  const previousReading = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: {
      chapterId: context.chapterId,
      kind: "reading",
      position: { lt: context.position },
    },
  });

  const vocabularyLessons = await prisma.lesson.findMany({
    include: {
      words: {
        include: { word: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { position: "asc" },
    where: {
      chapterId: context.chapterId,
      generationStatus: "completed",
      kind: "vocabulary",
      position: { gt: previousReading?.position ?? -1, lt: context.position },
    },
  });

  return vocabularyLessons.flatMap((lesson) =>
    lesson.words.map((lessonWord) => lessonWord.word.word),
  );
}

export async function generateReadingContentStep(
  context: LessonContext,
): Promise<ReadingLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateReadingContent" });

  const targetLanguage = context.chapter.course.targetLanguage;
  const words = await getVocabularyWordsSincePreviousReading(context);

  if (!targetLanguage) {
    throw new FatalError("Reading generation needs a target language");
  }

  if (words.length === 0) {
    throw new FatalError("Reading generation needs completed vocabulary lessons");
  }

  const { data: result, error }: SafeReturn<Awaited<ReturnType<typeof generateLessonSentences>>> =
    await safeAsync(() =>
      generateLessonSentences({
        chapterTitle: context.chapter.title,
        lessonDescription: context.description,
        lessonTitle: context.title,
        targetLanguage,
        userLanguage: context.language,
        words,
      }),
    );

  if (error || !result || result.data.sentences.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateReadingContent" });

  return { kind: "reading", sentences: result.data.sentences };
}
