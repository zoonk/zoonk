import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { completeActivityStep } from "../steps/complete-activity-step";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "../steps/generate-vocabulary-pronunciation-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
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

  const { savedWords } = await saveVocabularyWordsStep(activities, words, workflowRunId);

  const [pronunciationResult, audioResult, romanizationResult] = await Promise.allSettled([
    generateVocabularyPronunciationStep(activities, words),
    generateVocabularyAudioStep(activities, words),
    generateVocabularyRomanizationStep(activities, words),
  ]);

  const { pronunciations } = settled(pronunciationResult, { pronunciations: {} });
  const { wordAudioUrls } = settled(audioResult, { wordAudioUrls: {} });
  const { romanizations } = settled(romanizationResult, { romanizations: {} });

  await updateVocabularyEnrichmentsStep(
    activities,
    savedWords,
    pronunciations,
    wordAudioUrls,
    romanizations,
  );
  await completeActivityStep(activities, workflowRunId, "vocabulary");
  await completeActivityStep(activities, workflowRunId, "translation");

  return { words };
}
