import { settled } from "@zoonk/utils/settled";
import { generateGrammarContentStep } from "./steps/generate-grammar-content-step";
import { generateVocabularyAudioStep } from "./steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "./steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "./steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveVocabularyWordsStep } from "./steps/save-vocabulary-words-step";
import { updateVocabularyEnrichmentsStep } from "./steps/update-vocabulary-enrichments-step";

export async function languageActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  // Wave 1: Generate language activities independently
  const [vocabularyResult, grammarResult] = await Promise.allSettled([
    generateVocabularyContentStep(activities, workflowRunId),
    generateGrammarContentStep(activities, workflowRunId),
  ]);

  const { words } = settled(vocabularyResult, { words: [] });
  const { generated: grammarGenerated } = settled(grammarResult, { generated: false });

  if (words.length > 0) {
    // Wave 2: Save words + add pronunciation + record audio in parallel
    const [saveResult, pronResult, audioResult] = await Promise.allSettled([
      saveVocabularyWordsStep(activities, words),
      generateVocabularyPronunciationStep(activities, words),
      generateVocabularyAudioStep(activities, words),
    ]);

    const { savedWords } = settled(saveResult, { savedWords: [] });
    const { pronunciations } = settled(pronResult, { pronunciations: {} });
    const { audioUrls } = settled(audioResult, { audioUrls: {} });

    // Wave 3: Update word records with enrichments
    await updateVocabularyEnrichmentsStep(activities, savedWords, pronunciations, audioUrls);

    // Wave 4: Mark vocabulary as completed
    await saveActivityStep(activities, workflowRunId, "vocabulary");
  }

  if (grammarGenerated) {
    await saveActivityStep(activities, workflowRunId, "grammar");
  }
}
