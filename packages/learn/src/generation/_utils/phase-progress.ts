import { sumOf } from "@zoonk/utils/number";
import { type GenerationKindDefinition, isGenerationDone } from "../generation-kinds";
import { type GenerationRun } from "../generation-run";

export type PhaseStatus = "active" | "completed" | "failed" | "pending";

type Definition<TPhase extends string> = GenerationKindDefinition<string, TPhase>;
type RunState = Pick<GenerationRun, "failure" | "status" | "steps">;

export type PhaseProgress<TPhase extends string> = {
  /** How long the running phase usually takes: the bar's pace. Null when nothing runs. */
  activeMs: number | null;
  phases: { id: TPhase; status: PhaseStatus }[];
  /** The share of work finished, 0 to 100. */
  progress: number;
  /** Where `progress` will be once the running phase finishes. */
  target: number;
};

const PERCENT = 100;

function getPhaseSteps<TPhase extends string>(definition: Definition<TPhase>, phase: TPhase) {
  return Object.entries(definition.steps).flatMap(([step, place]) =>
    place === phase ? [step] : [],
  );
}

function isReported(run: RunState, step: string): boolean {
  return run.steps[step] !== undefined;
}

/** Optional phases show once the run reports one of their steps. */
function getVisiblePhases<TPhase extends string>(definition: Definition<TPhase>, run: RunState) {
  return definition.phases.filter(
    (phase) =>
      !phase.optional || getPhaseSteps(definition, phase.id).some((step) => isReported(run, step)),
  );
}

/** The share of a phase's steps the run finished, 0 to 1. */
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

/**
 * The phase running now: the furthest one the run reported a step of (a later step means the
 * earlier phases are done, since runs don't report every step), or the next one once all of its
 * steps finished. Before any report, the first phase: the host already started the run.
 */
function getActiveIndex<TPhase extends string>({
  definition,
  phases,
  run,
}: {
  definition: Definition<TPhase>;
  phases: readonly { id: TPhase }[];
  run: RunState;
}): number {
  const reported = phases.map((phase) =>
    getPhaseSteps(definition, phase.id).some((step) => isReported(run, step)),
  );

  const latest = Math.max(reported.lastIndexOf(true), 0);
  const latestPhase = phases[latest];
  const isLast = latest === phases.length - 1;

  if (!latestPhase || isLast) {
    return latest;
  }

  const finished = getFinishedShare({ definition, phase: latestPhase.id, run }) === 1;
  return finished ? latest + 1 : latest;
}

function getStatus({
  activeIndex,
  index,
  run,
}: {
  activeIndex: number;
  index: number;
  run: RunState;
}): PhaseStatus {
  if (index !== activeIndex) {
    return index < activeIndex ? "completed" : "pending";
  }

  if (run.failure === "generation") {
    return "failed";
  }

  // A run that never started has nothing running.
  return run.failure === "notStarted" ? "pending" : "active";
}

function toPercent(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * PERCENT;
}

/**
 * A run's phases for a wait of this kind, each done, running, stopped or still to come, and the
 * progress bar's position: phases weigh what they usually take, so a long phase moves the bar more.
 */
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
      phases: phases.map((phase) => ({ id: phase.id, status: "completed" })),
      progress: PERCENT,
      target: PERCENT,
    };
  }

  const activeIndex = getActiveIndex({ definition, phases, run });
  const active = phases[activeIndex];
  const finished = sumOf(phases.slice(0, activeIndex).map((phase) => phase.seconds));
  const activeSeconds = active?.seconds ?? 0;

  const activeShare = active ? getFinishedShare({ definition, phase: active.id, run }) : 0;

  return {
    activeMs: run.status === "failed" || !active ? null : activeSeconds * 1000,
    phases: phases.map((phase, index) => ({
      id: phase.id,
      status: getStatus({ activeIndex, index, run }),
    })),
    progress: toPercent(finished + activeShare * activeSeconds, total),
    target: toPercent(finished + activeSeconds, total),
  };
}
