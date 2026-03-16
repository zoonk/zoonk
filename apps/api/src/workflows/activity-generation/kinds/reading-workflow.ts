import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { completeActivityStep } from "../steps/complete-activity-step";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
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

  const currentRunWords = words.map((word) => word.word);

  const { sentences } = await generateReadingContentStep(
    activities,
    workflowRunId,
    currentRunWords,
    concepts,
    neighboringConcepts,
  );

  const { savedSentences } = await saveReadingSentencesStep(activities, sentences);

  const { sentenceAudioIds } = await generateReadingAudioStep(activities, savedSentences);
  await updateReadingEnrichmentsStep(activities, savedSentences, sentenceAudioIds);

  const { wordMetadata } = await generateSentenceWordMetadataStep(activities, savedSentences);

  const { savedSentenceWords } = await saveSentenceWordsStep(
    activities,
    savedSentences,
    wordMetadata,
  );

  const { wordAudioIds } = await generateSentenceWordAudioStep(activities, savedSentenceWords);
  await updateSentenceWordEnrichmentsStep(activities, savedSentenceWords, wordAudioIds);

  await completeActivityStep(activities, workflowRunId, "reading");
}
