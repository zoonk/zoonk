"use client";

import { type PhaseStatus, enforcePhaseProgression } from "@/lib/generation-phases";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  PHASE_ORDER,
  type PhaseName,
  calculateTargetProgress,
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
    creatingContent: t("Creating lesson content"),
    finishing: t("Almost done"),
    gettingStarted: t("Getting started"),
    savingContent: t("Saving lesson"),
  };

  const rawPhases: {
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

  const phases = enforcePhaseProgression(rawPhases);

  const progress = calculateWeightedProgress(completedSteps, currentStep, startedSteps);
  const targetProgress = calculateTargetProgress(completedSteps, currentStep, startedSteps);

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    creatingContent: (index: number) =>
      cycleMessage([t("Writing the lesson..."), t("Building the practice flow...")], index),
    finishing: (index) => cycleMessage([t("Wrapping up..."), t("Almost there...")], index),
    gettingStarted: (index) =>
      cycleMessage([t("Getting everything ready..."), t("Setting things up...")], index),
    savingContent: (index: number) =>
      cycleMessage([t("Saving your lesson..."), t("Preparing the player...")], index),
  };

  return { activePhaseNames, phases, progress, targetProgress, thinkingGenerators };
}
