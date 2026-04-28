import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { generateWordAudioUrls } from "./_utils/generate-word-audio-urls";
import { type LessonContext } from "./get-lesson-step";

export async function generateSentenceWordAudioStep({
  context,
  words,
}: {
  context: LessonContext;
  words: string[];
}): Promise<{ wordAudioUrls: Record<string, string> }> {
  "use step";

  const course = context.chapter.course;

  if (words.length === 0) {
    return { wordAudioUrls: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateSentenceWordAudio" });

  if (!isTTSSupportedLanguage(course.targetLanguage) || !course.organization) {
    await stream.status({ status: "completed", step: "generateSentenceWordAudio" });
    return { wordAudioUrls: {} };
  }

  const wordAudioUrls = await generateWordAudioUrls({
    orgSlug: course.organization.slug,
    organizationId: course.organization.id,
    targetLanguage: course.targetLanguage,
    words,
  });

  await stream.status({ status: "completed", step: "generateSentenceWordAudio" });

  return { wordAudioUrls };
}
