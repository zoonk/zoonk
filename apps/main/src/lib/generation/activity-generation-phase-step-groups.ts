import { type ActivityStepName } from "@/workflows/config";

const ALL_CONTENT_STEPS: ActivityStepName[] = [
  "generateBackgroundContent",
  "generateChallengeContent",
  "generateCustomContent",
  "generateExamplesContent",
  "generateExplanationContent",
  "generateMechanicsContent",
  "generateQuizContent",
  "generateReviewContent",
  "generateStoryContent",
  "generateGrammarContent",
  "generateLanguageStoryContent",
  "generateSentences",
  "generateVocabularyContent",
  "copyListeningSteps",
  "copyLanguageReviewSteps",
];

const ALL_VOCABULARY_STEPS: ActivityStepName[] = [
  "saveVocabularyWords",
  "generateVocabularyPronunciation",
  "generateVocabularyAudio",
  "updateVocabularyEnrichments",
];

const ALL_READING_STEPS: ActivityStepName[] = [
  "saveSentences",
  "generateAudio",
  "updateSentenceEnrichments",
];

const ALL_COMPLETION_STEPS: ActivityStepName[] = [
  "setBackgroundAsCompleted",
  "setChallengeAsCompleted",
  "setCustomAsCompleted",
  "setExamplesAsCompleted",
  "setExplanationAsCompleted",
  "setMechanicsAsCompleted",
  "setQuizAsCompleted",
  "setReviewAsCompleted",
  "setStoryAsCompleted",
  "setGrammarAsCompleted",
  "setLanguageStoryAsCompleted",
  "setVocabularyAsCompleted",
  "setReadingAsCompleted",
  "setListeningAsCompleted",
  "setLanguageReviewAsCompleted",
  "setActivityAsCompleted",
];

export const EXPLANATION_DEPS: ActivityStepName[] = [
  "setActivityAsRunning",
  "generateBackgroundContent",
  "generateExplanationContent",
];

export const LISTENING_DEPENDENCY_STEPS: ActivityStepName[] = [
  "setActivityAsRunning",
  "generateVocabularyContent",
  "saveVocabularyWords",
  "generateVocabularyPronunciation",
  "generateVocabularyAudio",
  "updateVocabularyEnrichments",
  "generateGrammarContent",
  "generateSentences",
  "setGrammarAsCompleted",
  "setActivityAsCompleted",
];

export const LANGUAGE_REVIEW_DEPENDENCY_STEPS: ActivityStepName[] = [
  "setActivityAsRunning",
  "generateVocabularyContent",
  "saveVocabularyWords",
  "generateVocabularyPronunciation",
  "generateVocabularyAudio",
  "updateVocabularyEnrichments",
  "generateGrammarContent",
  "generateSentences",
  "saveSentences",
  "setGrammarAsCompleted",
  "setActivityAsCompleted",
];

export const LISTENING_WRITING_STEPS: ActivityStepName[] = [
  "copyListeningSteps",
  "setVocabularyAsCompleted",
  "setReadingAsCompleted",
];

export function getFinishingSteps(exclude: readonly ActivityStepName[]): ActivityStepName[] {
  const excluded = new Set(exclude);
  return [
    ...ALL_CONTENT_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_VOCABULARY_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_READING_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_COMPLETION_STEPS.filter((step) => !excluded.has(step)),
  ];
}
