import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { failActivityWorkflows } from "../handle-activity-workflow-error";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyDistractorsStep } from "../steps/generate-vocabulary-distractors-step";
import { generateVocabularyPronunciationStep } from "../steps/generate-vocabulary-pronunciation-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveTranslationFromExistingVocabularyStep } from "../steps/save-translation-from-existing-vocabulary-step";
import { saveVocabularyActivityStep } from "../steps/save-vocabulary-activity-step";

/**
 * Canonical vocabulary words and their generated distractor words share the same
 * target-language enrichment pipeline. Collecting the union here ensures we create
 * audio, romanization, and pronunciation for every word the player may render.
 */
function collectVocabularyTargetWords(
  words: VocabularyWord[],
  distractors: Record<string, string[]>,
): string[] {
  return deduplicateNormalizedTexts([
    ...words.map((entry) => entry.word),
    ...words.flatMap((entry) => distractors[entry.word] ?? []),
  ]);
}

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
      try {
        await saveTranslationFromExistingVocabularyStep({ allActivities, workflowRunId });
      } catch (error) {
        return failActivityWorkflows({
          activityIds: [translationActivity.id],
          error,
        });
      }
    }

    return { words: [] };
  }

  try {
    const { words } = await generateVocabularyContentStep(
      vocabularyActivity,
      workflowRunId,
      concepts,
      neighboringConcepts,
    );

    const { distractors } = await generateVocabularyDistractorsStep(activitiesToGenerate, words);
    const vocabularyTargetWords = collectVocabularyTargetWords(words, distractors);

    const [{ pronunciations }, { wordAudioUrls }, { romanizations }] = await Promise.all([
      generateVocabularyPronunciationStep(activitiesToGenerate, vocabularyTargetWords),
      generateVocabularyAudioStep(activitiesToGenerate, vocabularyTargetWords),
      generateVocabularyRomanizationStep(activitiesToGenerate, vocabularyTargetWords),
    ]);

    await saveVocabularyActivityStep({
      activities: allActivities,
      distractors,
      pronunciations,
      romanizations,
      wordAudioUrls,
      words,
      workflowRunId,
    });

    return { words };
  } catch (error) {
    const translationActivity = findActivityByKind(activitiesToGenerate, "translation");

    return failActivityWorkflows({
      activityIds: [
        vocabularyActivity.id,
        ...(translationActivity ? [translationActivity.id] : []),
      ],
      error,
    });
  }
}
