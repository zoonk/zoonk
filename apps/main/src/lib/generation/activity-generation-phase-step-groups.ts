import { type ActivityStepName } from "@/lib/workflow/config";

const ALL_CONTENT_STEPS: ActivityStepName[] = [
  "generateChallengeContent",
  "generateCustomContent",
  "generateExplanationContent",
  "generateQuizContent",
  "generatePracticeContent",
  "generateGrammarContent",
  "generateLanguagePracticeContent",
  "generateSentences",
  "generateVocabularyContent",
  "copyListeningSteps",
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
  "setChallengeAsCompleted",
  "setCustomAsCompleted",
  "setExplanationAsCompleted",
  "setQuizAsCompleted",
  "setPracticeAsCompleted",
  "setGrammarAsCompleted",
  "setLanguagePracticeAsCompleted",
  "setVocabularyAsCompleted",
  "setReadingAsCompleted",
  "setListeningAsCompleted",
  "setActivityAsCompleted",
];

export const EXPLANATION_DEPS: ActivityStepName[] = [
  "setActivityAsRunning",
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
