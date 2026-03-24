"use client";

import { type PhaseStatus, enforcePhaseProgression } from "@/lib/generation-phases";
import { type ChapterWorkflowStepName } from "@/lib/workflow/config";
import {
  type ThinkingMessageGenerator,
  createCountingGenerator,
  cycleMessage,
} from "@/lib/workflow/use-thinking-messages";
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
  startedSteps?: ChapterWorkflowStepName[],
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    gettingReady: t("Getting things ready"),
    preparingLessons: t("Preparing lessons"),
    savingLessons: t("Saving your lessons"),
  };

  const phaseOrder = getPhaseOrder();

  const rawPhases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, startedSteps),
  }));

  const phases = enforcePhaseProgression(rawPhases);

  const progress = calculateWeightedProgress(completedSteps, currentStep, startedSteps);

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    gettingReady: (index) =>
      cycleMessage([t("Setting things up..."), t("Getting everything ready...")], index),
    preparingLessons: createCountingGenerator({
      intro: [t("Exploring your topic..."), t("Mapping out the learning path...")],
      itemTemplate: (num) => t("Writing lesson {number}...", { number: String(num) }),
      reviewMessage: t("Reviewing the flow so far..."),
    }),
    savingLessons: (index) =>
      cycleMessage([t("Saving your progress..."), t("Putting it all together...")], index),
  };

  return { activePhaseNames, phases, progress, thinkingGenerators };
}
