"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import {
  type ThinkingMessageGenerator,
  createCountingGenerator,
  cycleMessage,
} from "@/lib/workflow/use-thinking-messages";
import { type ChapterWorkflowStepName } from "@/workflows/config";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
} from "./generation-phases";

export function useGenerationPhases(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  targetLanguage: string | null,
  startedSteps?: ChapterWorkflowStepName[],
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    addingPronunciation: t("Adding pronunciation"),
    buildingWordList: t("Preparing practice content"),
    creatingImages: t("Creating images"),
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    preparingLessons: t("Preparing lessons"),
    preparingVisuals: t("Preparing illustrations"),
    recordingAudio: t("Recording audio"),
    settingUpActivities: t("Setting up activities"),
    writingContent: t("Writing the content"),
  };

  const phaseOrder = getPhaseOrder({ completedSteps, currentStep, targetLanguage });

  const phases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, targetLanguage, startedSteps),
  }));

  const progress = calculateWeightedProgress(
    completedSteps,
    currentStep,
    targetLanguage,
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
    figuringOutApproach: (index) =>
      cycleMessage(
        [t("Thinking about how to teach this..."), t("Choosing the right approach...")],
        index,
      ),
    finishing: (index) => cycleMessage([t("Wrapping up..."), t("Almost there...")], index),
    preparingLessons: createCountingGenerator({
      intro: [t("Exploring your topic..."), t("Mapping out the learning path...")],
      itemTemplate: (num) => t("Writing lesson {number}...", { number: String(num) }),
      reviewMessage: t("Reviewing the flow so far..."),
    }),
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
    recordingAudio: (index) =>
      cycleMessage([t("Recording the audio..."), t("Getting the pronunciation right...")], index),
    settingUpActivities: (index) =>
      cycleMessage([t("Designing practice exercises..."), t("Making it interactive...")], index),
    writingContent: (index) =>
      cycleMessage(
        [t("Researching the topic..."), t("Writing the explanation..."), t("Adding examples...")],
        index,
      ),
  };

  return { activePhaseNames, phases, progress, thinkingGenerators };
}
