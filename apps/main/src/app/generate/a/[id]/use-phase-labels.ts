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
    buildingScenario: t("Creating the story"),
    buildingWordList: t("Building word list"),
    classifyingExplanations: t("Analyzing explanations"),
    creatingAnswerOptions: t("Preparing options"),
    creatingExercises: t("Creating exercises"),
    creatingImages: t("Creating images"),
    creatingSentences: t("Creating sentences"),
    creatingVisuals: t("Creating illustrations"),
    designingActions: t("Designing investigation paths"),
    gatheringEvidence: t("Gathering evidence"),
    gettingStarted: t("Getting started"),
    lookingUpWords: t("Looking up words"),
    preparingVisuals: t("Preparing illustrations"),
    recordingAudio: t("Recording audio"),
    recordingVocabularyAudio: t("Recording vocabulary audio"),
    recordingWordAudio: t("Recording word audio"),
    saving: t("Saving your activity"),
    savingPrerequisites: t("Saving earlier activities"),
    settingTheScene: t("Setting the scene"),
    writingContent: t("Writing the content"),
    writingDebrief: t("Preparing the wrap-up"),
    writingExplanation: t("Writing the explanation"),
  };
}
