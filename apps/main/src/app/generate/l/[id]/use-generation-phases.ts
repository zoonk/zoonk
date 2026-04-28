"use client";

import { type PhaseStatus, enforcePhaseProgression } from "@/lib/generation-phases";
import { type GeneratedLessonKind } from "@/lib/generation/lesson-generation-phase-config";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateTargetProgress,
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
} from "./generation-phases";
import { usePhaseLabels } from "./use-phase-labels";
import { usePhaseThinkingGenerators } from "./use-phase-thinking-generators";

/** Returns the visible timeline state for the selected lesson generation workflow. */
export function useGenerationPhases(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  lessonKind: GeneratedLessonKind,
  startedSteps?: LessonStepName[],
) {
  const labels = usePhaseLabels();
  const phaseOrder = getPhaseOrder(lessonKind);

  const rawPhases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, lessonKind, startedSteps),
  }));

  const phases = enforcePhaseProgression(rawPhases);

  const progress = calculateWeightedProgress(completedSteps, currentStep, lessonKind, startedSteps);

  const targetProgress = calculateTargetProgress(
    completedSteps,
    currentStep,
    lessonKind,
    startedSteps,
  );

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators = usePhaseThinkingGenerators();

  return { activePhaseNames, phases, progress, targetProgress, thinkingGenerators };
}
