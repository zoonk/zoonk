import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentencePronunciationAndAlternativesStep } from "../steps/generate-sentence-pronunciation-and-alternatives-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveReadingActivityStep } from "../steps/save-reading-activity-step";

export async function readingActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  words: VocabularyWord[],
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  const { sentences } = await generateReadingContentStep(
    activities,
    workflowRunId,
    words,
    concepts,
    neighboringConcepts,
  );

  const [audioResult, romanizationResult] = await Promise.allSettled([
    generateReadingAudioStep(activities, sentences),
    generateReadingRomanizationStep(activities, sentences),
  ]);

  const { sentenceAudioUrls } = settled(audioResult, { sentenceAudioUrls: {} });
  const { romanizations: sentenceRomanizations } = settled(romanizationResult, {
    romanizations: {},
  });

  const { wordMetadata } = await generateSentenceWordMetadataStep(activities, sentences);

  const sentenceWords = extractUniqueSentenceWords(sentences.map((entry) => entry.sentence)).filter(
    (word) => wordMetadata[word],
  );

  const [wordAudioResult, wordPronunciationResult] = await Promise.allSettled([
    generateSentenceWordAudioStep(activities, sentenceWords),
    generateSentencePronunciationAndAlternativesStep(activities, sentenceWords),
  ]);

  const { wordAudioUrls } = settled(wordAudioResult, { wordAudioUrls: {} });
  const { alternatives, pronunciations } = settled(wordPronunciationResult, {
    alternatives: {},
    pronunciations: {},
  });

  await saveReadingActivityStep({
    activities,
    alternatives,
    pronunciations,
    sentenceAudioUrls,
    sentenceRomanizations,
    sentences,
    wordAudioUrls,
    wordMetadata,
    workflowRunId,
  });
}
