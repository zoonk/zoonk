import { settled } from "@zoonk/utils/settled";
import { generateGrammarContentStep } from "./steps/generate-grammar-content-step";
import { generateReadingAudioStep } from "./steps/generate-reading-audio-step";
import { generateReadingContentStep } from "./steps/generate-reading-content-step";
import { generateVocabularyAudioStep } from "./steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "./steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "./steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveReadingSentencesStep } from "./steps/save-reading-sentences-step";
import { saveVocabularyWordsStep } from "./steps/save-vocabulary-words-step";
import { updateReadingEnrichmentsStep } from "./steps/update-reading-enrichments-step";
import { updateVocabularyEnrichmentsStep } from "./steps/update-vocabulary-enrichments-step";

export async function languageActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  // Wave 1: Generate language activities independently
  const [vocabularyResult] = await Promise.allSettled([
    generateVocabularyContentStep(activities, workflowRunId),
    generateGrammarContentStep(activities, workflowRunId),
  ]);

  const { words } = settled(vocabularyResult, { words: [] });
  const currentRunWords = words.map((word) => word.word);

  // Wave 2: vocab enrichment + reading generation + grammar completion
  const [saveWordsResult, pronunciationResult, vocabularyAudioResult, readingContentResult] =
    await Promise.allSettled([
      saveVocabularyWordsStep(activities, words),
      generateVocabularyPronunciationStep(activities, words),
      generateVocabularyAudioStep(activities, words),
      generateReadingContentStep(activities, workflowRunId, currentRunWords),
      saveActivityStep(activities, workflowRunId, "grammar"),
    ]);

  const { savedWords } = settled(saveWordsResult, { savedWords: [] });
  const { pronunciations } = settled(pronunciationResult, { pronunciations: {} });
  const { audioUrls: vocabularyAudioUrls } = settled(vocabularyAudioResult, { audioUrls: {} });
  const { sentences } = settled(readingContentResult, { sentences: [] });

  // Wave 3: save enrichments + reading sentences
  const [saveSentencesResult] = await Promise.allSettled([
    saveReadingSentencesStep(activities, sentences),
    updateVocabularyEnrichmentsStep(activities, savedWords, pronunciations, vocabularyAudioUrls),
  ]);

  const { savedSentences } = settled(saveSentencesResult, { savedSentences: [] });

  // Wave 4: generate reading audio + complete vocabulary
  const [readingAudioResult] = await Promise.allSettled([
    generateReadingAudioStep(activities, savedSentences),
    saveActivityStep(activities, workflowRunId, "vocabulary"),
  ]);

  const { audioUrls: readingAudioUrls } = settled(readingAudioResult, { audioUrls: {} });

  // Wave 5: save reading enrichments + complete reading
  await Promise.allSettled([
    updateReadingEnrichmentsStep(activities, savedSentences, readingAudioUrls),
    saveActivityStep(activities, workflowRunId, "reading"),
  ]);
}
