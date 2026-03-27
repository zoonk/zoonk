"use client";

import { type PhaseStatus, enforcePhaseProgression } from "@/lib/generation-phases";
import { type PhaseName, getPhaseOrder } from "@/lib/generation/activity-generation-phase-config";
import {
  PHASE_ICONS,
  calculateWeightedProgress,
  getPhaseStatus,
} from "@/lib/generation/activity-generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivityKind } from "@zoonk/db";
import { usePhaseLabels } from "./use-phase-labels";
import { usePhaseThinkingGenerators } from "./use-phase-thinking-generators";

export function useGenerationPhases(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
  startedSteps?: ActivityStepName[],
) {
  const labels = usePhaseLabels();
  const phaseOrder = getPhaseOrder(activityKind);

  const rawPhases: {
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

  const phases = enforcePhaseProgression(rawPhases);

  const progress = calculateWeightedProgress(
    completedSteps,
    currentStep,
    activityKind,
    startedSteps,
  );

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators = usePhaseThinkingGenerators();

  return { activePhaseNames, phases, progress, thinkingGenerators };
}
