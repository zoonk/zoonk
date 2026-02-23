"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
} from "@/lib/generation/activity-generation-phases";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { type ActivityStepName } from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import { useExtracted } from "next-intl";

export function useGenerationPhases(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
  startedSteps?: ActivityStepName[],
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    addingPronunciation: t("Adding pronunciation"),
    buildingWordList: t("Preparing practice content"),
    creatingImages: t("Creating images"),
    finishing: t("Almost done"),
    gettingStarted: t("Getting started"),
    preparingVisuals: t("Preparing illustrations"),
    processingDependencies: t("Processing earlier activities"),
    recordingAudio: t("Recording audio"),
    writingContent: t("Writing the content"),
  };

  const phaseOrder = getPhaseOrder(activityKind);

  const phases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, activityKind, startedSteps),
  }));

  const progress = calculateWeightedProgress(
    completedSteps,
    currentStep,
    activityKind,
    startedSteps,
  );

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    addingPronunciation: (index) =>
      cycleMessage(
        [t("Looking up how each word sounds..."), t("Mapping out the pronunciation...")],
        index,
      ),
    buildingWordList: (index) =>
      cycleMessage([t("Picking the key vocabulary..."), t("Choosing words to practice...")], index),
    creatingImages: (index) =>
      cycleMessage(
        [
          t("Drawing an illustration..."),
          t("Working on the visuals..."),
          t("Adding some color..."),
          t("Refining the details..."),
        ],
        index,
      ),
    finishing: (index) => cycleMessage([t("Wrapping up..."), t("Almost there...")], index),
    gettingStarted: (index) =>
      cycleMessage([t("Getting everything ready..."), t("Setting things up...")], index),
    preparingVisuals: (index) =>
      cycleMessage(
        [
          t("Thinking about what to illustrate..."),
          t("Sketching out ideas..."),
          t("Choosing the right style..."),
          t("Planning the layout..."),
        ],
        index,
      ),
    processingDependencies: (index) =>
      cycleMessage([t("Reviewing earlier activities..."), t("Connecting the pieces...")], index),
    recordingAudio: (index) =>
      cycleMessage([t("Recording the audio..."), t("Getting the pronunciation right...")], index),
    writingContent: (index) =>
      cycleMessage(
        [t("Researching the topic..."), t("Writing the explanation..."), t("Adding examples...")],
        index,
      ),
  };

  return { activePhaseNames, phases, progress, thinkingGenerators };
}
