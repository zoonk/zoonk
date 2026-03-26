import { type ActivityStepName } from "@/lib/workflow/config";

const ALL_CONTENT_STEPS: ActivityStepName[] = [
  "generateChallengeContent",
  "generateCustomContent",
  "generateExplanationContent",
  "generateQuizContent",
  "generatePracticeContent",
  "generateGrammarContent",
  "generateGrammarUserContent",
  "generateGrammarRomanization",
  "generateSentences",
  "generateVocabularyContent",
  "copyListeningSteps",
];

const ALL_VOCABULARY_STEPS: ActivityStepName[] = [
  "generateVocabularyPronunciationAndAlternatives",
  "generateVocabularyRomanization",
  "generateVocabularyAudio",
];

const ALL_READING_STEPS: ActivityStepName[] = [
  "generateAudio",
  "generateReadingRomanization",
  "generateSentenceWordMetadata",
  "generateSentenceWordAudio",
  "generateSentencePronunciationAndAlternatives",
];

const ALL_SAVE_STEPS: ActivityStepName[] = [
  "saveChallengeActivity",
  "saveCustomActivity",
  "saveExplanationActivity",
  "saveGrammarActivity",
  "saveListeningActivity",
  "savePracticeActivity",
  "saveQuizActivity",
  "saveReadingActivity",
  "saveVocabularyActivity",
];

export const EXPLANATION_DEPS: ActivityStepName[] = ["generateExplanationContent"];

export const LISTENING_DEPENDENCY_STEPS: ActivityStepName[] = [
  "generateVocabularyContent",
  "generateVocabularyPronunciationAndAlternatives",
  "generateVocabularyRomanization",
  "generateVocabularyAudio",
  "saveVocabularyActivity",
  "generateGrammarContent",
  "generateGrammarUserContent",
  "generateGrammarRomanization",
  "saveGrammarActivity",
  "generateSentences",
];

export const LISTENING_WRITING_STEPS: ActivityStepName[] = [
  "copyListeningSteps",
  "saveListeningActivity",
];

export function getFinishingSteps(exclude: readonly ActivityStepName[]): ActivityStepName[] {
  const excluded = new Set(exclude);
  return [
    ...ALL_CONTENT_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_VOCABULARY_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_READING_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_SAVE_STEPS.filter((step) => !excluded.has(step)),
  ];
}
