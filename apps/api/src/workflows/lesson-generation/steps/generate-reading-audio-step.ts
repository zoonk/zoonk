import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function generateReadingAudioStep({
  context,
  sentences,
}: {
  context: LessonContext;
  sentences: ReadingLessonContent["sentences"];
}): Promise<{ sentenceAudioUrls: Record<string, string> }> {
  "use step";

  if (sentences.length === 0) {
    return { sentenceAudioUrls: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateReadingAudio" });

  const course = context.chapter.course;
  const organization = course.organization;
  const targetLanguage = course.targetLanguage;

  if (!targetLanguage || !isTTSSupportedLanguage(targetLanguage) || !organization) {
    await stream.status({ status: "completed", step: "generateReadingAudio" });
    return { sentenceAudioUrls: {} };
  }

  const existingAudios = await prisma.sentence.findMany({
    where: {
      audioUrl: { not: null },
      organizationId: organization.id,
      sentence: { in: sentences.map((entry) => entry.sentence) },
      targetLanguage,
    },
  });
  const existingAudioUrls = Object.fromEntries(
    existingAudios.flatMap((record) =>
      record.audioUrl ? [[record.sentence, record.audioUrl]] : [],
    ),
  );
  const sentencesNeedingAudio = sentences.filter((entry) => !existingAudioUrls[entry.sentence]);
  const results = await Promise.all(
    sentencesNeedingAudio.map((entry) =>
      generateAudioForText(entry.sentence, targetLanguage, organization.slug),
    ),
  );

  await stream.status({ status: "completed", step: "generateReadingAudio" });

  return {
    sentenceAudioUrls: {
      ...existingAudioUrls,
      ...Object.fromEntries(results.map((result) => [result.text, result.audioUrl])),
    },
  };
}
