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
): Promise<{ audioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { audioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateVocabularyAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
    return { audioUrls: {} };
  }

  const orgSlug = course.organization.slug;
  const organizationId = course.organization.id;
  const userLanguage = activity.language;

  const wordsWithAudio = await prisma.word.findMany({
    select: { audioUrl: true, word: true },
    where: {
      audioUrl: { not: null },
      organizationId,
      targetLanguage,
      userLanguage,
      word: { in: words.map((vocab) => vocab.word) },
    },
  });

  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    wordsWithAudio.flatMap((record) => (record.audioUrl ? [[record.word, record.audioUrl]] : [])),
  );

  const wordsNeedingAudio = words.filter((vocab) => !existingAudioUrls[vocab.word]);

  const results = await Promise.all(
    wordsNeedingAudio.map((vocabWord) =>
      generateAudioForText(vocabWord.word, targetLanguage, orgSlug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const audioUrls: Record<string, string> = {
    ...existingAudioUrls,
    ...Object.fromEntries(fulfilled.map(({ text, audioUrl }) => [text, audioUrl])),
  };

  if (fulfilled.length < wordsNeedingAudio.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateVocabularyAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { audioUrls };
  }

  await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
  return { audioUrls };
}
