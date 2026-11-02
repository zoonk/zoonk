import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  failAlphabetLessonStep,
  publishAlphabetLessonStep,
  voiceAlphabetClipStep,
  writeAlphabetLessonStep,
} from "./steps/alphabet-lesson-steps";

export async function voiceAlphabetClips({
  clips,
  targetLanguage,
}: {
  clips: readonly string[];
  targetLanguage: string;
}): Promise<Record<string, string>> {
  const voiced = await Promise.all(
    clips.map(
      async (text) => [text, await voiceAlphabetClipStep({ targetLanguage, text })] as const,
    ),
  );

  return Object.fromEntries(voiced);
}

/** A clip or the save that fails for good frees the lesson, so the pair's next learner writes it. */
export async function writeAlphabetLesson({
  analytics,
  learnerLanguage,
  targetLanguage,
  userId,
  workflowRunId,
}: {
  analytics: ContentAnalytics;
  learnerLanguage: string;
  targetLanguage: string;
  userId: string;
  workflowRunId: string;
}): Promise<void> {
  const written = await writeAlphabetLessonStep({
    analytics,
    learnerLanguage,
    targetLanguage,
    workflowRunId,
  });

  if (written.status !== "written") {
    return;
  }

  const { clips, lesson, lessonId, provenance } = written;

  try {
    const audioUrls = await voiceAlphabetClips({ clips, targetLanguage });

    await publishAlphabetLessonStep({
      audioUrls,
      lesson,
      lessonId,
      provenance,
      userId,
      workflowRunId,
    });
  } catch (error) {
    await failAlphabetLessonStep({ lessonId, workflowRunId });
    throw error;
  }
}
