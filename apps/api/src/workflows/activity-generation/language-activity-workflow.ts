import { settled } from "@zoonk/utils/settled";
import { findActivityByKind } from "./steps/_utils/find-activity-by-kind";
import { generateVocabularyAudioStep } from "./steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "./steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "./steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "./steps/handle-failure-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveVocabularyWordsStep } from "./steps/save-vocabulary-words-step";
import { updateVocabularyEnrichmentsStep } from "./steps/update-vocabulary-enrichments-step";

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

  if (savedWords.length === 0) {
    const vocabActivity = findActivityByKind(activities, "vocabulary");

    if (vocabActivity) {
      await handleActivityFailureStep({ activityId: vocabActivity.id });
    }

    return;
  }

  // Wave 3: Update word records with enrichments
  await updateVocabularyEnrichmentsStep(activities, savedWords, pronunciations, audioUrls);

  // Wave 4: Mark activity as completed
  await saveActivityStep(activities, workflowRunId, "vocabulary");
}
