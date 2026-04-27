"use client";

import { type PhaseName } from "@/lib/generation/activity-generation-phase-config";
import { useExtracted } from "next-intl";

/** Returns translated labels for each phase name. */
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
    creatingSentences: t("Creating sentences"),
    gettingStarted: t("Getting started"),
    lookingUpWords: t("Looking up words"),
    preparingImages: t("Planning the images"),
    recordingAudio: t("Recording audio"),
    recordingVocabularyAudio: t("Recording vocabulary audio"),
    recordingWordAudio: t("Recording word audio"),
    saving: t("Saving your activity"),
    savingPrerequisites: t("Saving earlier activities"),
    writingContent: t("Writing the content"),
    writingExplanation: t("Writing the explanation"),
  };
}
