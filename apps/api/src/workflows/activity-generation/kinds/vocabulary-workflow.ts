import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationAndAlternativesStep } from "../steps/generate-vocabulary-pronunciation-and-alternatives-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveVocabularyActivityStep } from "../steps/save-vocabulary-activity-step";

/**
 * Orchestrates vocabulary activity generation.
 *
 * Only generates if a vocabulary activity exists in the activitiesToGenerate list.
 * The allActivities parameter is passed to the save step because it needs
 * the full list to find translation activities — the translation activity
 * may not be in activitiesToGenerate (e.g., already completed).
 *
 * TODO: If vocabulary is completed but translation failed, vocabulary won't be
 * in activitiesToGenerate, so this workflow returns early. Translation
 * regeneration in that case needs separate handling in languageActivityWorkflow.
 */
export async function vocabularyActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  concepts,
  neighboringConcepts,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  concepts: string[];
  neighboringConcepts: string[];
  workflowRunId: string;
}): Promise<{ words: VocabularyWord[] }> {
  "use workflow";

  const vocabularyActivity = findActivityByKind(activitiesToGenerate, "vocabulary");

  if (!vocabularyActivity) {
    return { words: [] };
  }

  const { words } = await generateVocabularyContentStep(
    vocabularyActivity,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );

  const [pronunciationAndAltsResult, audioResult, romanizationResult] = await Promise.allSettled([
    generateVocabularyPronunciationAndAlternativesStep(activitiesToGenerate, words),
    generateVocabularyAudioStep(activitiesToGenerate, words),
    generateVocabularyRomanizationStep(activitiesToGenerate, words),
  ]);

  const { alternatives, pronunciations } = settled(pronunciationAndAltsResult, {
    alternatives: {},
    pronunciations: {},
  });
  const { wordAudioUrls } = settled(audioResult, { wordAudioUrls: {} });
  const { romanizations } = settled(romanizationResult, { romanizations: {} });

  await saveVocabularyActivityStep({
    activities: allActivities,
    alternatives,
    pronunciations,
    romanizations,
    wordAudioUrls,
    words,
    workflowRunId,
  });

  return { words };
}
