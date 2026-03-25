import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export async function generateVocabularyAudioStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ wordAudioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { wordAudioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateVocabularyAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await stream.status({ status: "completed", step: "generateVocabularyAudio" });
    return { wordAudioUrls: {} };
  }

  const orgSlug = course.organization.slug;
  const organizationId = course.organization.id;

  const existingAudios = await prisma.word.findMany({
    select: { audioUrl: true, word: true },
    where: {
      audioUrl: { not: null },
      organizationId,
      targetLanguage,
      word: { in: words.map((vocab) => vocab.word), mode: "insensitive" },
    },
  });

  const existingAudioByLower: Record<string, string> = Object.fromEntries(
    existingAudios.flatMap((record) =>
      record.audioUrl ? [[record.word.toLowerCase(), record.audioUrl]] : [],
    ),
  );

  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    words.flatMap((vocab) => {
      const audioUrl = existingAudioByLower[vocab.word.toLowerCase()];
      return audioUrl ? [[vocab.word, audioUrl]] : [];
    }),
  );

  const wordsNeedingAudio = words.filter(
    (vocab) => !existingAudioByLower[vocab.word.toLowerCase()],
  );

  const results = await Promise.all(
    wordsNeedingAudio.map((vocabWord) =>
      generateAudioForText(vocabWord.word, targetLanguage, orgSlug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const newAudioRecords = await Promise.all(
    fulfilled.map((result) =>
      prisma.word.update({
        data: { audioUrl: result.audioUrl },
        select: { audioUrl: true, word: true },
        where: { orgWord: { organizationId, targetLanguage, word: result.text } },
      }),
    ),
  );

  const wordAudioUrls: Record<string, string> = {
    ...existingAudioUrls,
    ...Object.fromEntries(
      newAudioRecords.flatMap((record) =>
        record.audioUrl ? [[record.word, record.audioUrl]] : [],
      ),
    ),
  };

  if (fulfilled.length < wordsNeedingAudio.length) {
    await stream.error({ reason: "enrichmentFailed", step: "generateVocabularyAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordAudioUrls };
  }

  await stream.status({ status: "completed", step: "generateVocabularyAudio" });
  return { wordAudioUrls };
}
