export type PhaseStatus = "pending" | "active" | "completed";

export type PhaseConfig<TPhase extends string, TStep extends string> = {
  phaseSteps: Record<TPhase, TStep[]>;
  phaseOrder: TPhase[];
  phaseWeights: Record<TPhase, number>;
};

export function getPhaseStatus<TPhase extends string, TStep extends string>(
  phase: TPhase,
  completedSteps: TStep[],
  currentStep: TStep | null,
  phaseSteps: Record<TPhase, TStep[]>,
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
  config: PhaseConfig<TPhase, TStep>,
): number {
  const totalWeight = config.phaseOrder.reduce(
    (sum, phase) => sum + config.phaseWeights[phase],
    0,
  );

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
