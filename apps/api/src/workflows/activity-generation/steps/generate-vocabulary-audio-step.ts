import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export async function generateVocabularyAudioStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ wordAudioIds: Record<string, bigint> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { wordAudioIds: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateVocabularyAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
    return { wordAudioIds: {} };
  }

  const orgSlug = course.organization.slug;
  const organizationId = course.organization.id;

  const existingAudios = await prisma.wordAudio.findMany({
    select: { id: true, word: true },
    where: {
      organizationId,
      targetLanguage,
      word: { in: words.map((vocab) => vocab.word) },
    },
  });

  const existingAudioIds: Record<string, bigint> = Object.fromEntries(
    existingAudios.map((record) => [record.word, record.id]),
  );

  const wordsNeedingAudio = words.filter((vocab) => !existingAudioIds[vocab.word]);

  const results = await Promise.all(
    wordsNeedingAudio.map((vocabWord) =>
      generateAudioForText(vocabWord.word, targetLanguage, orgSlug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const newAudioRecords = await Promise.all(
    fulfilled.map((result) =>
      prisma.wordAudio.upsert({
        create: {
          audioUrl: result.audioUrl,
          organizationId,
          targetLanguage,
          word: result.text,
        },
        select: { id: true, word: true },
        update: { audioUrl: result.audioUrl },
        where: { orgWordAudio: { organizationId, targetLanguage, word: result.text } },
      }),
    ),
  );

  const wordAudioIds: Record<string, bigint> = {
    ...existingAudioIds,
    ...Object.fromEntries(newAudioRecords.map((record) => [record.word, record.id])),
  };

  if (fulfilled.length < wordsNeedingAudio.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateVocabularyAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordAudioIds };
  }

  await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
  return { wordAudioIds };
}
