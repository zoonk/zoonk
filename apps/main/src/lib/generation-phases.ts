import { sumOf } from "@zoonk/utils/number";

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
  startedSteps?: TStep[],
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

  if (startedSteps && steps.some((step) => startedSteps.includes(step))) {
    return "active";
  }

  return "pending";
}

function shouldPromote<T extends { status: PhaseStatus }>(phase: T, index: number, phases: T[]) {
  if (index === 0 || phase.status !== "pending") {
    return false;
  }

  return phases[index - 1]?.status === "completed";
}

function clampLastPhase<T extends { status: PhaseStatus }>(phases: T[]): T[] {
  const allPredecessorsCompleted = phases.slice(0, -1).every((item) => item.status === "completed");

  if (allPredecessorsCompleted) {
    return phases;
  }

  const last = phases.at(-1);

  if (!last || last.status === "pending") {
    return phases;
  }

  return [...phases.slice(0, -1), { ...last, status: "pending" as const }];
}

export function enforcePhaseProgression<T extends { status: PhaseStatus }>(phases: T[]): T[] {
  // Promotion doesn't cascade (pending -> active, not completed), so
  // each element only needs the original previous element's status.
  const promoted = phases.map((phase, index) =>
    shouldPromote(phase, index, phases) ? { ...phase, status: "active" as const } : phase,
  );

  return clampLastPhase(promoted);
}

function getPhaseWeightContribution<TPhase extends string, TStep extends string>(
  phase: TPhase,
  status: PhaseStatus,
  completedSteps: TStep[],
  config: { phaseSteps: Record<TPhase, readonly TStep[]>; phaseWeights: Record<TPhase, number> },
) {
  if (status === "pending") {
    return 0;
  }

  const weight = config.phaseWeights[phase];

  if (status === "completed") {
    return weight;
  }

  const steps = config.phaseSteps[phase];
  const completedCount = steps.filter((step) => completedSteps.includes(step)).length;

  return (completedCount / steps.length) * weight;
}

export function calculateWeightedProgress<TPhase extends string, TStep extends string>(
  completedSteps: TStep[],
  currentStep: TStep | null,
  config: {
    phaseSteps: Record<TPhase, readonly TStep[]>;
    phaseOrder: readonly TPhase[];
    phaseWeights: Record<TPhase, number>;
    startedSteps?: TStep[];
  },
): number {
  const totalWeight = sumOf(config.phaseOrder.map((phase) => config.phaseWeights[phase]));

  if (totalWeight === 0) {
    return 0;
  }

  const rawStatuses = config.phaseOrder.map((phase) => ({
    phase,
    status: getPhaseStatus(
      phase,
      completedSteps,
      currentStep,
      config.phaseSteps,
      config.startedSteps,
    ),
  }));

  const enforced = enforcePhaseProgression(rawStatuses);

  const weightedSum = sumOf(
    enforced.map(({ phase, status }) =>
      getPhaseWeightContribution(phase, status, completedSteps, config),
    ),
  );

  return Math.round((weightedSum / totalWeight) * 100);
}
