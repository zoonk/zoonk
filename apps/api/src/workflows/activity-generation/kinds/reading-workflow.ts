import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { findActivityByKind } from "../steps/_utils/find-activity-by-kind";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentencePronunciationAndDistractorUnsafesStep } from "../steps/generate-sentence-pronunciation-and-distractor-unsafes-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveReadingActivityStep } from "../steps/save-reading-activity-step";

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

  const { sentences } = await generateReadingContentStep(
    readingActivity,
    workflowRunId,
    words,
    concepts,
    neighboringConcepts,
  );

  const [audioResult, romanizationResult] = await Promise.allSettled([
    generateReadingAudioStep(activitiesToGenerate, sentences),
    generateReadingRomanizationStep(activitiesToGenerate, sentences),
  ]);

  const { sentenceAudioUrls } = settled(audioResult, { sentenceAudioUrls: {} });
  const { romanizations: sentenceRomanizations } = settled(romanizationResult, {
    romanizations: {},
  });

  const { wordMetadata } = await generateSentenceWordMetadataStep(activitiesToGenerate, sentences);

  const sentenceWords = extractUniqueSentenceWords(sentences.map((entry) => entry.sentence)).filter(
    (word) => wordMetadata[word],
  );

  const [wordAudioResult, wordPronunciationResult] = await Promise.allSettled([
    generateSentenceWordAudioStep(activitiesToGenerate, sentenceWords),
    generateSentencePronunciationAndDistractorUnsafesStep(activitiesToGenerate, sentenceWords),
  ]);

  const { wordAudioUrls } = settled(wordAudioResult, { wordAudioUrls: {} });
  const { distractorUnsafeTranslations, pronunciations } = settled(wordPronunciationResult, {
    distractorUnsafeTranslations: {},
    pronunciations: {},
  });

  await saveReadingActivityStep({
    activities: allActivities,
    distractorUnsafeTranslations,
    pronunciations,
    sentenceAudioUrls,
    sentenceRomanizations,
    sentences,
    wordAudioUrls,
    wordMetadata,
    workflowRunId,
  });
}
