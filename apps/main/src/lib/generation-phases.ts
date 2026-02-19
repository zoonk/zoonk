export type PhaseStatus = "pending" | "active" | "completed";

/**
 * Compile-time check that all steps are assigned to a phase.
 * If any step is missing, TypeScript errors showing the exact missing step names.
 *
 * Usage: `type _Validate = AssertAllCovered<Exclude<StepName, AssignedSteps>>`
 */
export type AssertAllCovered<T extends never> = T;

export function getPhaseStatus<TPhase extends string, TStep extends string>(
  phase: TPhase,
  completedSteps: TStep[],
  currentStep: TStep | null,
  phaseSteps: Record<TPhase, readonly TStep[]>,
): PhaseStatus {
  const steps = phaseSteps[phase];
  const completedCount = steps.filter((step) => completedSteps.includes(step)).length;

  if (completedCount === steps.length) {
    return "completed";
  }

  if (currentStep && steps.includes(currentStep)) {
    return "active";
  }

  if (completedCount > 0) {
    return "active";
  }

  return "pending";
}

export function calculateWeightedProgress<TPhase extends string, TStep extends string>(
  completedSteps: TStep[],
  currentStep: TStep | null,
  config: {
    phaseSteps: Record<TPhase, readonly TStep[]>;
    phaseOrder: readonly TPhase[];
    phaseWeights: Record<TPhase, number>;
  },
): number {
  const totalWeight = config.phaseOrder.reduce((sum, phase) => sum + config.phaseWeights[phase], 0);

  if (totalWeight === 0) {
    return 0;
  }

  let weightedSum = 0;

  for (const phase of config.phaseOrder) {
    const status = getPhaseStatus(phase, completedSteps, currentStep, config.phaseSteps);
    const weight = config.phaseWeights[phase];

    if (status === "completed") {
      weightedSum += weight;
    } else if (status === "active") {
      const steps = config.phaseSteps[phase];
      const completedCount = steps.filter((step) => completedSteps.includes(step)).length;
      const partialProgress = (completedCount / steps.length) * weight;
      weightedSum += partialProgress;
    }
  }

  return Math.round((weightedSum / totalWeight) * 100);
}
