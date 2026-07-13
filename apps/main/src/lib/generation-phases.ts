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

/**
 * Generation pages auto-start their workflows, so an all-pending timeline is
 * only waiting for the first server event. Starting the first phase
 * optimistically gives learners immediate feedback while the real stream is
 * connecting, and the first event naturally replaces this provisional state.
 */
function startFirstPhase<T extends { status: PhaseStatus }>(phases: T[]): T[] {
  const firstPhase = phases[0];
  const hasReportedProgress = phases.some((phase) => phase.status !== "pending");

  if (!firstPhase || hasReportedProgress) {
    return phases;
  }

  return [{ ...firstPhase, status: "active" }, ...phases.slice(1)];
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
  const started = startFirstPhase(phases);

  // Promotion doesn't cascade (pending -> active, not completed), so
  // each element only needs the original previous element's status.
  const promoted = started.map((phase, index) =>
    shouldPromote(phase, index, started) ? { ...phase, status: "active" as const } : phase,
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

/**
 * Resolves phase statuses from step data, applying enforcement rules.
 * Shared by both progress and target-progress calculations to avoid
 * duplicating the status resolution logic.
 */
function resolvePhaseStatuses<TPhase extends string, TStep extends string>(
  completedSteps: TStep[],
  currentStep: TStep | null,
  config: {
    phaseSteps: Record<TPhase, readonly TStep[]>;
    phaseOrder: readonly TPhase[];
    startedSteps?: TStep[];
  },
): { phase: TPhase; status: PhaseStatus }[] {
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

  return enforcePhaseProgression(rawStatuses);
}

type ProgressConfig<TPhase extends string, TStep extends string> = {
  phaseSteps: Record<TPhase, readonly TStep[]>;
  phaseOrder: readonly TPhase[];
  phaseWeights: Record<TPhase, number>;
  startedSteps?: TStep[];
};

/**
 * Converts the currently active phase weights into an animation duration.
 * Generation phase weights are second-based estimates, and parallel phases can
 * be active together, so the visible timer should follow the longest active
 * phase instead of adding independent work that runs at the same time.
 */
export function getActivePhaseDurationMs<TPhase extends string>({
  activePhases,
  phaseWeights,
}: {
  activePhases: TPhase[];
  phaseWeights: Record<TPhase, number>;
}): number | undefined {
  const durationSeconds = Math.max(...activePhases.map((phase) => phaseWeights[phase]));

  return durationSeconds > 0 ? durationSeconds * 1000 : undefined;
}

export function calculateWeightedProgress<TPhase extends string, TStep extends string>(
  completedSteps: TStep[],
  currentStep: TStep | null,
  config: ProgressConfig<TPhase, TStep>,
): number {
  const totalWeight = sumOf(config.phaseOrder.map((phase) => config.phaseWeights[phase]));

  if (totalWeight === 0) {
    return 0;
  }

  const enforced = resolvePhaseStatuses(completedSteps, currentStep, config);

  const weightedSum = sumOf(
    enforced.map(({ phase, status }) =>
      getPhaseWeightContribution(phase, status, completedSteps, config),
    ),
  );

  return Math.round((weightedSum / totalWeight) * 100);
}

/**
 * Computes the progress value that would be reached if all currently
 * active phases completed right now. This gives `useAnimatedProgress`
 * a meaningful ceiling to drift toward instead of a fixed constant.
 *
 * With parallel phases (e.g. listening runs vocab + grammar simultaneously),
 * multiple phases can be active at once — their combined remaining weight
 * is included in the target.
 */
export function calculateTargetProgress<TPhase extends string, TStep extends string>(
  completedSteps: TStep[],
  currentStep: TStep | null,
  config: ProgressConfig<TPhase, TStep>,
): number {
  const totalWeight = sumOf(config.phaseOrder.map((phase) => config.phaseWeights[phase]));

  if (totalWeight === 0) {
    return 0;
  }

  const enforced = resolvePhaseStatuses(completedSteps, currentStep, config);

  const weightedSum = sumOf(
    enforced.map(({ phase, status }) => {
      if (status === "active") {
        return config.phaseWeights[phase];
      }

      return getPhaseWeightContribution(phase, status, completedSteps, config);
    }),
  );

  return Math.round((weightedSum / totalWeight) * 100);
}
