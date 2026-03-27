import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationAndDistractorUnsafesStep } from "../steps/generate-vocabulary-pronunciation-and-distractor-unsafes-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveTranslationFromExistingVocabularyStep } from "../steps/save-translation-from-existing-vocabulary-step";
import { saveVocabularyActivityStep } from "../steps/save-vocabulary-activity-step";

/**
 * Orchestrates vocabulary and translation activity generation.
 *
 * Handles two scenarios:
 * 1. Normal: vocabulary needs generation → generate content, audio, pronunciation,
 *    romanization → save everything (including translation steps) at once.
 * 2. Edge case: vocabulary is already completed but translation failed on a prior run.
 *    In this case, vocabulary is NOT in activitiesToGenerate but translation IS.
 *    We skip AI generation and instead create translation steps from the existing
 *    vocabulary steps in the DB.
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
    const translationActivity = findActivityByKind(activitiesToGenerate, "translation");

    if (translationActivity) {
      await saveTranslationFromExistingVocabularyStep({ allActivities, workflowRunId });
    }

    return { words: [] };
  }

  const { words } = await generateVocabularyContentStep(
    vocabularyActivity,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );

  const [pronunciationAndDistractorUnsafeResult, audioResult, romanizationResult] =
    await Promise.allSettled([
      generateVocabularyPronunciationAndDistractorUnsafesStep(activitiesToGenerate, words),
      generateVocabularyAudioStep(activitiesToGenerate, words),
      generateVocabularyRomanizationStep(activitiesToGenerate, words),
    ]);

  const { distractorUnsafeTranslations, pronunciations } = settled(
    pronunciationAndDistractorUnsafeResult,
    {
      distractorUnsafeTranslations: {},
      pronunciations: {},
    },
  );
  const { wordAudioUrls } = settled(audioResult, { wordAudioUrls: {} });
  const { romanizations } = settled(romanizationResult, { romanizations: {} });

  await saveVocabularyActivityStep({
    activities: allActivities,
    distractorUnsafeTranslations,
    pronunciations,
    romanizations,
    wordAudioUrls,
    words,
    workflowRunId,
  });

  return { words };
}
