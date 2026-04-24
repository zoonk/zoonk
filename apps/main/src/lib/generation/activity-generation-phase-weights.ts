import { type ActivityKind } from "@zoonk/db";
import { type PhaseName } from "./activity-generation-phase-config";

/** All phases default to 0 weight — only override the ones the kind uses. */
const ZERO_WEIGHTS: Record<PhaseName, number> = {
  addingGrammarRomanization: 0,
  addingPronunciation: 0,
  addingRomanization: 0,
  addingVocabularyRomanization: 0,
  addingWordPronunciation: 0,
  buildingScenario: 0,
  buildingWordList: 0,
  classifyingExplanations: 0,
  creatingAnswerOptions: 0,
  creatingExercises: 0,
  creatingImages: 0,
  creatingSentences: 0,
  designingActions: 0,
  gatheringEvidence: 0,
  gettingStarted: 0,
  lookingUpWords: 0,
  preparingImages: 0,
  recordingAudio: 0,
  recordingVocabularyAudio: 0,
  recordingWordAudio: 0,
  saving: 0,
  savingPrerequisites: 0,
  settingTheScene: 0,
  writingContent: 0,
  writingDebrief: 0,
  writingExplanation: 0,
};

export function getPhaseWeights(kind: ActivityKind): Record<PhaseName, number> {
  if (kind === "vocabulary" || kind === "translation") {
    return {
      ...ZERO_WEIGHTS,
      addingPronunciation: 20,
      addingRomanization: 10,
      buildingWordList: 15,
      gettingStarted: 3,
      recordingAudio: 50,
      saving: 2,
    };
  }

  if (kind === "grammar") {
    return {
      ...ZERO_WEIGHTS,
      addingRomanization: 15,
      creatingExercises: 30,
      gettingStarted: 5,
      saving: 5,
      writingContent: 45,
    };
  }

  if (kind === "reading") {
    return {
      ...ZERO_WEIGHTS,
      addingRomanization: 10,
      addingWordPronunciation: 7,
      creatingSentences: 20,
      gettingStarted: 3,
      lookingUpWords: 20,
      recordingAudio: 20,
      recordingWordAudio: 15,
      saving: 5,
    };
  }

  if (kind === "listening") {
    return {
      ...ZERO_WEIGHTS,
      addingGrammarRomanization: 3,
      addingPronunciation: 7,
      addingRomanization: 5,
      addingVocabularyRomanization: 4,
      addingWordPronunciation: 4,
      buildingWordList: 7,
      creatingAnswerOptions: 4,
      creatingExercises: 5,
      creatingSentences: 4,
      gettingStarted: 1,
      lookingUpWords: 12,
      recordingAudio: 12,
      recordingVocabularyAudio: 12,
      recordingWordAudio: 8,
      saving: 2,
      savingPrerequisites: 1,
      writingContent: 7,
    };
  }

  if (kind === "custom") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 35,
      gettingStarted: 3,
      preparingImages: 44,
      saving: 4,
      writingContent: 14,
    };
  }

  if (kind === "explanation") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 33,
      gettingStarted: 3,
      preparingImages: 40,
      saving: 4,
      writingContent: 20,
    };
  }

  if (kind === "quiz") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 42,
      gettingStarted: 3,
      saving: 5,
      writingContent: 30,
      writingExplanation: 20,
    };
  }

  if (kind === "practice") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 25,
      gettingStarted: 5,
      saving: 5,
      writingContent: 35,
      writingExplanation: 30,
    };
  }

  if (kind === "story") {
    return {
      ...ZERO_WEIGHTS,
      buildingScenario: 35,
      creatingAnswerOptions: 25,
      creatingImages: 25,
      gettingStarted: 5,
      saving: 10,
    };
  }

  if (kind === "investigation") {
    return {
      ...ZERO_WEIGHTS,
      classifyingExplanations: 25,
      designingActions: 16,
      gatheringEvidence: 38,
      gettingStarted: 1,
      saving: 1,
      settingTheScene: 19,
    };
  }

  return {
    ...ZERO_WEIGHTS,
    creatingImages: 27,
    gettingStarted: 3,
    preparingImages: 34,
    saving: 4,
    writingContent: 11,
    writingExplanation: 21,
  };
}
