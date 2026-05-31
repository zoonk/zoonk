"use client";

import { useExtracted } from "next-intl";
import { type PhaseName } from "./generation-phase-config";

/** Returns translated labels for each lesson generation phase. */
export function usePhaseLabels(): Record<PhaseName, string> {
  const t = useExtracted();

  return {
    addingGrammarRomanization: t("Adding grammar romanization"),
    addingPronunciation: t("Adding pronunciation"),
    addingRomanization: t("Adding romanization"),
    addingVocabularyRomanization: t("Adding vocabulary romanization"),
    addingWordPronunciation: t("Adding word pronunciation"),
    buildingWordList: t("Building word list"),
    creatingAnswerOptions: t("Preparing options"),
    creatingExercises: t("Creating exercises"),
    creatingImages: t("Creating images"),
    creatingLessonImage: t("Creating lesson thumbnail"),
    creatingSentences: t("Creating sentences"),
    gettingStarted: t("Getting started"),
    lookingUpWords: t("Looking up words"),
    preparingImages: t("Planning the images"),
    recordingAudio: t("Recording audio"),
    recordingVocabularyAudio: t("Recording vocabulary audio"),
    recordingWordAudio: t("Recording word audio"),
    saving: t("Saving your lesson"),
    savingPrerequisites: t("Saving your lesson"),
    writingContent: t("Writing the content"),
    writingExplanation: t("Writing the explanation"),
  };
}
