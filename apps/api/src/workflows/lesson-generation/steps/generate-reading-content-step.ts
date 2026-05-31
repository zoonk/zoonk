import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { getSourceLessonMetadataInRange } from "./_utils/source-lesson-metadata";
import { type LessonContext } from "./get-lesson-step";

/**
 * Reading lessons should only use vocabulary lesson metadata that has not
 * already been consumed by an earlier reading lesson in the same chapter.
 */
async function getVocabularySourceLessonsSincePreviousReading(context: LessonContext) {
  const previousReading = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: { chapterId: context.chapterId, kind: "reading", position: { lt: context.position } },
  });

  return getSourceLessonMetadataInRange({
    afterPosition: previousReading?.position ?? -1,
    beforePosition: context.position,
    chapterId: context.chapterId,
    kinds: ["vocabulary"],
  });
}

/**
 * Generates reading sentences from vocabulary lesson metadata immediately
 * before the reading lesson. This removes the need for generated vocabulary
 * content while preserving the chapter's planned topic boundary.
 */
export async function generateReadingContentStep(
  context: LessonContext,
): Promise<ReadingLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateReadingContent" });

  const targetLanguage = context.chapter.course.targetLanguage;
  const sourceLessons = await getVocabularySourceLessonsSincePreviousReading(context);

  if (!targetLanguage) {
    throw new FatalError("Reading generation needs a target language");
  }

  if (sourceLessons.length === 0) {
    throw new FatalError("Reading generation needs vocabulary lesson metadata");
  }

  const result = await generateLessonSentences({
    chapterTitle: context.chapter.title,
    lessonDescription: context.description ?? undefined,
    lessonTitle: context.title ?? "",
    sourceLessons,
    targetLanguage,
    userLanguage: context.language,
  });

  await stream.status({ status: "completed", step: "generateReadingContent" });

  return { kind: "reading", sentences: result.data.sentences };
}
