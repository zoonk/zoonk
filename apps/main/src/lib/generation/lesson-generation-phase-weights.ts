import { type GeneratedLessonKind, type PhaseName } from "./lesson-generation-phase-config";

/** All phases default to 0 weight so each lesson kind can weight only the phases it uses. */
const ZERO_WEIGHTS: Record<PhaseName, number> = {
  addingGrammarRomanization: 0,
  addingPronunciation: 0,
  addingRomanization: 0,
  addingVocabularyRomanization: 0,
  addingWordPronunciation: 0,
  buildingWordList: 0,
  creatingAnswerOptions: 0,
  creatingExercises: 0,
  creatingImages: 0,
  creatingSentences: 0,
  gettingStarted: 0,
  lookingUpWords: 0,
  preparingImages: 0,
  recordingAudio: 0,
  recordingVocabularyAudio: 0,
  recordingWordAudio: 0,
  saving: 0,
  savingPrerequisites: 0,
  writingContent: 0,
  writingExplanation: 0,
};

/** Returns relative progress weights for the selected lesson kind's generated phases. */
export function getPhaseWeights(kind: GeneratedLessonKind): Record<PhaseName, number> {
  if (kind === "alphabet" || kind === "vocabulary") {
    return {
      ...ZERO_WEIGHTS,
      addingPronunciation: 20,
      addingRomanization: 10,
      buildingWordList: 15,
      creatingExercises: 5,
      gettingStarted: 3,
      recordingAudio: 45,
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
      creatingExercises: 20,
      creatingSentences: 20,
      gettingStarted: 3,
      lookingUpWords: 20,
      recordingAudio: 10,
      recordingWordAudio: 5,
      saving: 5,
    };
  }

  if (kind === "tutorial") {
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
      writingContent: 50,
    };
  }

  if (kind === "practice") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 30,
      gettingStarted: 5,
      saving: 5,
      writingContent: 60,
    };
  }

  return {
    ...ZERO_WEIGHTS,
    gettingStarted: 10,
    saving: 90,
  };
}
