import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { settled } from "./_utils/settled";
import { generateVocabularyAudioStep } from "./steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "./steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "./steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "./steps/handle-failure-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveVocabularyWordsStep } from "./steps/save-vocabulary-words-step";
import { updateVocabularyEnrichmentsStep } from "./steps/update-vocabulary-enrichments-step";

function hasEnrichmentFailure(
  activity: LessonActivity,
  pronunciations: Record<string, string>,
  audioUrls: Record<string, string>,
): boolean {
  const targetLanguage = activity.lesson.chapter.course.targetLanguage;
  const pronunciationFailed = Object.keys(pronunciations).length === 0;
  const audioFailed = isTTSSupportedLanguage(targetLanguage) && Object.keys(audioUrls).length === 0;

  return pronunciationFailed || audioFailed;
}

export async function languageActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  // Wave 1: Build word list (AI)
  const { words } = await generateVocabularyContentStep(activities, workflowRunId);

  if (words.length === 0) {
    return;
  }

  // Wave 2: Save words + add pronunciation + record audio in parallel
  const [saveResult, pronResult, audioResult] = await Promise.allSettled([
    saveVocabularyWordsStep(activities, words),
    generateVocabularyPronunciationStep(activities, words),
    generateVocabularyAudioStep(activities, words),
  ]);

  const { savedWords } = settled(saveResult, { savedWords: [] });
  const { pronunciations } = settled(pronResult, { pronunciations: {} });
  const { audioUrls } = settled(audioResult, { audioUrls: {} });

  // Mark as failed if pronunciation or audio generation failed entirely
  const activity = activities.find((act) => act.kind === "vocabulary");

  if (activity && hasEnrichmentFailure(activity, pronunciations, audioUrls)) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  // Wave 3: Update word records with enrichments
  await updateVocabularyEnrichmentsStep(savedWords, pronunciations, audioUrls);

  // Wave 4: Mark activity as completed
  await saveActivityStep(activities, workflowRunId, "vocabulary");
}
