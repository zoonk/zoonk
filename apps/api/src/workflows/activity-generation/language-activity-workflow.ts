import { settled } from "@zoonk/utils/settled";
import { generateGrammarContentStep } from "./steps/generate-grammar-content-step";
import { generateReadingAudioStep } from "./steps/generate-reading-audio-step";
import {
  type ReadingSentence,
  generateReadingContentStep,
} from "./steps/generate-reading-content-step";
import { generateVocabularyAudioStep } from "./steps/generate-vocabulary-audio-step";
import {
  type VocabularyWord,
  generateVocabularyContentStep,
} from "./steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "./steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveReadingSentencesStep } from "./steps/save-reading-sentences-step";
import { saveVocabularyWordsStep } from "./steps/save-vocabulary-words-step";
import { updateReadingEnrichmentsStep } from "./steps/update-reading-enrichments-step";
import { updateVocabularyEnrichmentsStep } from "./steps/update-vocabulary-enrichments-step";

type VocabularyBranchResult = {
  readyForCompletion: boolean;
  words: VocabularyWord[];
};

type ReadingBranchResult = {
  readyForCompletion: boolean;
};

async function runVocabularyEnrichmentBranch(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<VocabularyBranchResult> {
  if (words.length === 0) {
    return { readyForCompletion: false, words: [] };
  }

  const [saveResult, pronResult, audioResult] = await Promise.allSettled([
    saveVocabularyWordsStep(activities, words),
    generateVocabularyPronunciationStep(activities, words),
    generateVocabularyAudioStep(activities, words),
  ]);

  const { savedWords } = settled(saveResult, { savedWords: [] });
  const { pronunciations } = settled(pronResult, { pronunciations: {} });
  const { audioUrls } = settled(audioResult, { audioUrls: {} });

  await updateVocabularyEnrichmentsStep(activities, savedWords, pronunciations, audioUrls);

  return {
    readyForCompletion: savedWords.length > 0,
    words,
  };
}

async function runReadingPersistenceBranch(
  activities: LessonActivity[],
  sentences: ReadingSentence[],
): Promise<ReadingBranchResult> {
  if (sentences.length === 0) {
    return { readyForCompletion: false };
  }

  const { savedSentences } = await saveReadingSentencesStep(activities, sentences);
  const { audioUrls } = await generateReadingAudioStep(activities, savedSentences);

  await updateReadingEnrichmentsStep(activities, savedSentences, audioUrls);

  return {
    readyForCompletion: savedSentences.length > 0,
  };
}

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
  const currentRunWords = words.map((word) => word.word);

  // Wave 2: vocabulary enrichment + grammar completion + reading generation in parallel
  const [vocabularyBranchResult, , readingContentResult] = await Promise.allSettled([
    runVocabularyEnrichmentBranch(activities, words),
    grammarGenerated ? saveActivityStep(activities, workflowRunId, "grammar") : Promise.resolve(),
    generateReadingContentStep(activities, workflowRunId, currentRunWords),
  ]);

  const vocabularyBranch = settled(vocabularyBranchResult, {
    readyForCompletion: false,
    words: [],
  } satisfies VocabularyBranchResult);

  const readingContent = settled(readingContentResult, {
    sentences: [],
  } satisfies {
    sentences: ReadingSentence[];
  });

  // Wave 3: reading persistence + vocabulary completion in parallel
  const [readingBranchResult] = await Promise.allSettled([
    runReadingPersistenceBranch(activities, readingContent.sentences),
    vocabularyBranch.readyForCompletion
      ? saveActivityStep(activities, workflowRunId, "vocabulary")
      : Promise.resolve(),
  ]);

  const readingBranch = settled(readingBranchResult, {
    readyForCompletion: false,
  } satisfies ReadingBranchResult);

  // Wave 4: reading completion
  if (readingBranch.readyForCompletion) {
    await saveActivityStep(activities, workflowRunId, "reading");
  }
}
