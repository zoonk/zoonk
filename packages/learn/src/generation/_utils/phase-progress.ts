import { sumOf } from "@zoonk/utils/number";
import { type GenerationKindDefinition, isGenerationDone } from "../generation-kinds";
import { type GenerationRun } from "../generation-run";

export type PhaseStatus = "active" | "completed" | "failed" | "pending";

type Definition<TPhase extends string> = GenerationKindDefinition<string, TPhase>;
type RunState = Pick<GenerationRun, "failure" | "status" | "steps">;

export type PhaseProgress<TPhase extends string> = {
  activeMs: number | null;
  phases: { id: TPhase; seconds: number; status: PhaseStatus }[];
  /** 0 to 100. */
  progress: number;
  target: number;
};

const PERCENT = 100;

export function getPhaseSteps<TPhase extends string>(
  definition: Definition<TPhase>,
  phase: TPhase,
) {
  return Object.entries(definition.steps).flatMap(([step, place]) =>
    place === phase ? [step] : [],
  );
}

function isReported(run: RunState, step: string): boolean {
  return run.steps[step] !== undefined;
}

function getVisiblePhases<TPhase extends string>(definition: Definition<TPhase>, run: RunState) {
  return definition.phases.filter(
    (phase) =>
      !phase.optional || getPhaseSteps(definition, phase.id).some((step) => isReported(run, step)),
  );
}

function getFinishedShare<TPhase extends string>({
  definition,
  phase,
  run,
}: {
  definition: Definition<TPhase>;
  phase: TPhase;
  run: RunState;
}): number {
  const steps = getPhaseSteps(definition, phase);
  const finished = steps.filter((step) => run.steps[step] === "completed").length;

  return steps.length === 0 ? 0 : finished / steps.length;
}

/** Phases that run at the same time make one stage, and stages run in order. */
export function toStages<TItem extends { alongside?: boolean }>(
  phases: readonly TItem[],
): TItem[][] {
  const starts = phases.flatMap((phase, index) => (phase.alongside && index > 0 ? [] : [index]));
  return starts.map((start, index) => phases.slice(start, starts[index + 1]));
}

/** The furthest stage the run reported a step of, since runs don't report every step. */
function getActiveIndex<TPhase extends string>({
  definition,
  run,
  stages,
}: {
  definition: Definition<TPhase>;
  run: RunState;
  stages: readonly (readonly { id: TPhase }[])[];
}): number {
  const reported = stages.map((stage) =>
    stage.some((phase) =>
      getPhaseSteps(definition, phase.id).some((step) => isReported(run, step)),
    ),
  );

  const latest = Math.max(reported.lastIndexOf(true), 0);
  const latestStage = stages[latest];
  const isLast = latest === stages.length - 1;

  if (!latestStage || isLast) {
    return latest;
  }

  const finished = latestStage.every(
    (phase) => getFinishedShare({ definition, phase: phase.id, run }) === 1,
  );

  return finished ? latest + 1 : latest;
}

/** A phase running alongside others is done once its own steps are, while they go on. */
function getStatus({
  activeIndex,
  index,
  isDoneAlongside,
  run,
}: {
  activeIndex: number;
  index: number;
  isDoneAlongside: boolean;
  run: RunState;
}): PhaseStatus {
  if (index !== activeIndex) {
    return index < activeIndex ? "completed" : "pending";
  }

  if (isDoneAlongside) {
    return "completed";
  }

  if (run.failure === "generation") {
    return "failed";
  }

  return run.failure === "notStarted" ? "pending" : "active";
}

function toPercent(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * PERCENT;
}

export function getPhaseProgress<TPhase extends string>({
  definition,
  run,
}: {
  definition: Definition<TPhase>;
  run: RunState;
}): PhaseProgress<TPhase> {
  const phases = getVisiblePhases(definition, run);
  const total = sumOf(phases.map((phase) => phase.seconds));

  if (run.status === "ready" || isGenerationDone({ definition, steps: run.steps })) {
    return {
      activeMs: null,
      phases: phases.map((phase) => ({
        id: phase.id,
        seconds: phase.seconds,
        status: "completed",
      })),
      progress: PERCENT,
      target: PERCENT,
    };
  }

  const stages = toStages(phases);
  const activeIndex = getActiveIndex({ definition, run, stages });

  const finished = sumOf(
    stages.slice(0, activeIndex).flatMap((stage) => stage.map((phase) => phase.seconds)),
  );

  const active = (stages[activeIndex] ?? []).map((phase) => ({
    seconds: phase.seconds,
    share: getFinishedShare({ definition, phase: phase.id, run }),
  }));

  const running = active.filter((phase) => phase.share < 1);

  return {
    activeMs:
      run.status === "failed" || active.length === 0
        ? null
        : Math.max(...(running.length > 0 ? running : active).map((phase) => phase.seconds)) * 1000,
    phases: stages.flatMap((stage, index) =>
      stage.map((phase) => ({
        id: phase.id,
        seconds: phase.seconds,
        status: getStatus({
          activeIndex,
          index,
          isDoneAlongside:
            stage.length > 1 && getFinishedShare({ definition, phase: phase.id, run }) === 1,
          run,
        }),
      })),
    ),
    progress: toPercent(
      finished + sumOf(active.map((phase) => phase.share * phase.seconds)),
      total,
    ),
    target: toPercent(finished + sumOf(active.map((phase) => phase.seconds)), total),
  };
}
