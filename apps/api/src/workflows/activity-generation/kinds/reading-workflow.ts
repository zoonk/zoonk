import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { deduplicateNormalizedTexts, extractUniqueSentenceWords } from "@zoonk/utils/string";
import { failActivityWorkflow } from "../handle-activity-workflow-error";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentenceDistractorsStep } from "../steps/generate-sentence-distractors-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { generateSentenceWordPronunciationStep } from "../steps/generate-sentence-word-pronunciation-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveReadingActivityStep } from "../steps/save-reading-activity-step";

/**
 * Reading activities enrich every target-language word the player may render:
 * canonical sentence tokens plus generated reading distractors. Listening-side
 * distractors stay as plain learner-language strings and are excluded here.
 */
function collectReadingTargetWords(params: {
  distractors: Record<string, string[]>;
  sentences: { sentence: string }[];
}): string[] {
  return deduplicateNormalizedTexts([
    ...extractUniqueSentenceWords(params.sentences.map((entry) => entry.sentence)),
    ...params.sentences.flatMap((entry) => params.distractors[entry.sentence] ?? []),
  ]);
}

/**
 * Orchestrates reading activity generation.
 *
 * Only generates if a reading activity exists in the activitiesToGenerate list.
 * The allActivities parameter is passed to the save step and some sub-steps
 * that need the full activity list (e.g., to find vocabulary activities).
 */
export async function readingActivityWorkflow({
  activitiesToGenerate,
  allActivities,
  concepts,
  neighboringConcepts,
  words,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  allActivities: LessonActivity[];
  concepts: string[];
  neighboringConcepts: string[];
  words: VocabularyWord[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const readingActivity = findActivityByKind(activitiesToGenerate, "reading");

  if (!readingActivity) {
    return;
  }

  try {
    const { sentences } = await generateReadingContentStep(
      readingActivity,
      workflowRunId,
      words,
      concepts,
      neighboringConcepts,
    );

    const [{ sentenceAudioUrls }, { romanizations: sentenceRomanizations }] = await Promise.all([
      generateReadingAudioStep(activitiesToGenerate, sentences),
      generateReadingRomanizationStep(activitiesToGenerate, sentences),
    ]);

    const { distractors, translationDistractors } = await generateSentenceDistractorsStep(
      activitiesToGenerate,
      sentences,
    );

    const targetWords = collectReadingTargetWords({ distractors, sentences });

    const { wordMetadata } = await generateSentenceWordMetadataStep(
      activitiesToGenerate,
      sentences,
      targetWords,
    );

    const [{ wordAudioUrls }, { pronunciations }] = await Promise.all([
      generateSentenceWordAudioStep(activitiesToGenerate, targetWords),
      generateSentenceWordPronunciationStep(activitiesToGenerate, targetWords),
    ]);

    await saveReadingActivityStep({
      activities: allActivities,
      distractors,
      pronunciations,
      sentenceAudioUrls,
      sentenceRomanizations,
      sentences,
      translationDistractors,
      wordAudioUrls,
      wordMetadata,
      workflowRunId,
    });
  } catch (error) {
    await failActivityWorkflow({ activityId: readingActivity.id, error });
  }
}
