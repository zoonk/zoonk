import { type GeneratedLessonKind, type PhaseName } from "./generation-phase-config";

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
  creatingLessonImage: 0,
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
      addingPronunciation: 65,
      addingRomanization: 4,
      buildingWordList: 6,
      creatingExercises: 5,
      gettingStarted: 1,
      recordingAudio: 6,
      saving: 1,
    };
  }

  if (kind === "grammar") {
    return {
      ...ZERO_WEIGHTS,
      addingRomanization: 4,
      creatingExercises: 8,
      gettingStarted: 1,
      saving: 1,
      writingContent: 15,
    };
  }

  if (kind === "reading") {
    return {
      ...ZERO_WEIGHTS,
      addingRomanization: 4,
      addingWordPronunciation: 5,
      creatingExercises: 5,
      creatingSentences: 12,
      gettingStarted: 1,
      lookingUpWords: 5,
      recordingAudio: 5,
      recordingWordAudio: 10,
      saving: 1,
    };
  }

  if (kind === "tutorial") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 45,
      creatingLessonImage: 30,
      gettingStarted: 1,
      preparingImages: 8,
      saving: 1,
      writingContent: 10,
    };
  }

  if (kind === "explanation") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 50,
      creatingLessonImage: 30,
      gettingStarted: 1,
      preparingImages: 15,
      saving: 1,
      writingContent: 35,
    };
  }

  if (kind === "quiz") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 45,
      gettingStarted: 1,
      saving: 1,
      writingContent: 30,
    };
  }

  if (kind === "practice") {
    return {
      ...ZERO_WEIGHTS,
      creatingImages: 45,
      gettingStarted: 1,
      saving: 1,
      writingContent: 20,
    };
  }

  return { ...ZERO_WEIGHTS, gettingStarted: 1, saving: 1 };
}
