import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { completeActivityStep } from "../steps/complete-activity-step";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveReadingSentencesStep } from "../steps/save-reading-sentences-step";
import { saveSentenceWordsStep } from "../steps/save-sentence-words-step";
import { updateReadingEnrichmentsStep } from "../steps/update-reading-enrichments-step";
import { updateSentenceWordEnrichmentsStep } from "../steps/update-sentence-word-enrichments-step";

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

  const { savedSentences } = await saveReadingSentencesStep(activities, sentences);

  const [audioResult, romanizationResult] = await Promise.allSettled([
    generateReadingAudioStep(activities, savedSentences),
    generateReadingRomanizationStep(activities, savedSentences),
  ]);

  const { sentenceAudioUrls } = settled(audioResult, { sentenceAudioUrls: {} });
  const { romanizations } = settled(romanizationResult, { romanizations: {} });

  await updateReadingEnrichmentsStep(activities, savedSentences, sentenceAudioUrls, romanizations);

  const { wordMetadata } = await generateSentenceWordMetadataStep(activities, savedSentences);

  const { savedSentenceWords } = await saveSentenceWordsStep(
    activities,
    savedSentences,
    wordMetadata,
  );

  const { wordAudioUrls } = await generateSentenceWordAudioStep(activities, savedSentenceWords);
  await updateSentenceWordEnrichmentsStep(activities, savedSentenceWords, wordAudioUrls);

  await completeActivityStep(activities, workflowRunId, "reading");
}
