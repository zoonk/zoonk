import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonVocabulary } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { type VocabularyLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

function getTargetLanguage(context: LessonContext): string {
  const targetLanguage = context.chapter.course.targetLanguage;

  if (!targetLanguage) {
    throw new FatalError("Language lesson generation needs a target language");
  }

  return targetLanguage;
}

export async function generateVocabularyContentStep(
  context: LessonContext,
): Promise<VocabularyLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateVocabularyContent" });

  const targetLanguage = getTargetLanguage(context);
  const { data: result, error }: SafeReturn<Awaited<ReturnType<typeof generateLessonVocabulary>>> =
    await safeAsync(() =>
      generateLessonVocabulary({
        chapterTitle: context.chapter.title,
        lessonDescription: context.description,
        lessonTitle: context.title,
        targetLanguage,
        userLanguage: context.language,
      }),
    );

  if (error || !result || result.data.words.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateVocabularyContent" });

  return { kind: "vocabulary", words: result.data.words };
}
