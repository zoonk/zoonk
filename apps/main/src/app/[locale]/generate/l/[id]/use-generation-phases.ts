"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type LessonStepName } from "@/lib/workflow/config";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  PHASE_ORDER,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseStatus,
} from "./generation-phases";

export function useGenerationPhases(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    gettingStarted: t("Getting started"),
    settingUpActivities: t("Setting up activities"),
  };

  const phases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = PHASE_ORDER.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, startedSteps),
  }));

  const progress = calculateWeightedProgress(completedSteps, currentStep, startedSteps);

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    figuringOutApproach: (index) =>
      cycleMessage(
        [t("Thinking about how to teach this..."), t("Choosing the right approach...")],
        index,
      ),
    finishing: (index) => cycleMessage([t("Wrapping up..."), t("Almost there...")], index),
    gettingStarted: (index) =>
      cycleMessage([t("Getting everything ready..."), t("Setting things up...")], index),
    settingUpActivities: (index) =>
      cycleMessage([t("Designing practice exercises..."), t("Making it interactive...")], index),
  };

  return { activePhaseNames, phases, progress, thinkingGenerators };
}
