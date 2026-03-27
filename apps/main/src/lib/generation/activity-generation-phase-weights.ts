import { type ActivityKind } from "@zoonk/db";
import { type PhaseName } from "./activity-generation-phase-config";

/** All phases default to 0 weight — only override the ones the kind uses. */
const ZERO_WEIGHTS: Record<PhaseName, number> = {
  addingGrammarRomanization: 0,
  addingPronunciation: 0,
  addingRomanization: 0,
  addingVocabularyRomanization: 0,
  addingWordPronunciation: 0,
  buildingWordList: 0,
  creatingExercises: 0,
  creatingImages: 0,
  creatingSentences: 0,
  gettingStarted: 0,
  lookingUpWords: 0,
  preparingVisuals: 0,
  recordingAudio: 0,
  recordingVocabularyAudio: 0,
  recordingWordAudio: 0,
  saving: 0,
  savingPrerequisites: 0,
  writingContent: 0,
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
      creatingExercises: 5,
      creatingSentences: 8,
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
      creatingImages: 43,
      gettingStarted: 3,
      preparingVisuals: 22,
      saving: 7,
      writingContent: 25,
    };
  }

  if (kind === "explanation") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 52,
      gettingStarted: 3,
      preparingVisuals: 18,
      saving: 7,
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

  if (kind === "practice" || kind === "challenge") {
    return {
      ...ZERO_WEIGHTS,
      gettingStarted: 5,
      saving: 5,
      writingContent: 50,
      writingExplanation: 40,
    };
  }

  return {
    ...ZERO_WEIGHTS,
    creatingImages: 35,
    gettingStarted: 3,
    preparingVisuals: 18,
    saving: 9,
    writingContent: 20,
    writingExplanation: 15,
  };
}
