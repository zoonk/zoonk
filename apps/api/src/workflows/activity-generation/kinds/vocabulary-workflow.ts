import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { completeActivityStep } from "../steps/complete-activity-step";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "../steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveVocabularyWordsStep } from "../steps/save-vocabulary-words-step";
import { updateVocabularyEnrichmentsStep } from "../steps/update-vocabulary-enrichments-step";

export async function vocabularyActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ words: VocabularyWord[] }> {
  "use workflow";

  const { words } = await generateVocabularyContentStep(
    activities,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );

  const [saveWordsResult, pronunciationResult, audioResult] = await Promise.allSettled([
    saveVocabularyWordsStep(activities, words),
    generateVocabularyPronunciationStep(activities, words),
    generateVocabularyAudioStep(activities, words),
  ]);

  const { savedWords } = settled(saveWordsResult, { savedWords: [] });
  const { pronunciations } = settled(pronunciationResult, { pronunciations: {} });
  const { audioUrls } = settled(audioResult, { audioUrls: {} });

  await updateVocabularyEnrichmentsStep(activities, savedWords, pronunciations, audioUrls);
  await completeActivityStep(activities, workflowRunId, "vocabulary");

  return { words };
}
