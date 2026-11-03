import { type GenerationKindDefinition, getGenerationDoneAt } from "../generation-kinds";
import { type GenerationStepTimes } from "../generation-run";
import { type PhaseStatus, getPhaseSteps } from "./phase-progress";

type Definition<TPhase extends string> = GenerationKindDefinition<string, TPhase>;
type StepTimes = Partial<Record<string, GenerationStepTimes>>;

export type PhaseTime = { endedAt: number | null; startedAt: number | null };

const UNTIMED: PhaseTime = { endedAt: null, startedAt: null };

function known(times: (number | null | undefined)[]): number[] {
  return times.filter((time) => typeof time === "number");
}

function earliest(times: (number | null | undefined)[]): number | null {
  const reported = known(times);
  return reported.length > 0 ? Math.min(...reported) : null;
}

function latest(times: (number | null | undefined)[]): number | null {
  const reported = known(times);
  return reported.length > 0 ? Math.max(...reported) : null;
}

function getReportedTimes<TPhase extends string>({
  definition,
  phase,
  stepTimes,
}: {
  definition: Definition<TPhase>;
  phase: TPhase;
  stepTimes: StepTimes;
}) {
  const times = getPhaseSteps(definition, phase).map((step) => stepTimes[step] ?? {});
  const finished = times.map((time) => time.completed);

  return {
    allFinished: finished.every((time) => time !== undefined) ? latest(finished) : null,
    finished: latest(finished),
    started: earliest(times.map((time) => time.started ?? time.completed)),
  };
}

type ReportedTimes = ReturnType<typeof getReportedTimes>;

/**
 * `getPhaseProgress` moves past a phase once a later one reports a step, every step of one before
 * the last finished, or the run is done.
 */
function getPassedAt({
  doneAt,
  index,
  reported,
}: {
  doneAt: number | null;
  index: number;
  reported: readonly ReportedTimes[];
}): number | null {
  const isLast = index === reported.length - 1;

  return earliest([
    isLast ? null : reported[index]?.allFinished,
    ...reported.slice(index + 1).map((times) => times.started),
    doneAt,
  ]);
}

/**
 * A phase's clock runs while the wait shows it as the running one, so a shown start never moves
 * later, and a finished phase keeps the time of a step that finished after the wait moved on.
 */
export function getPhaseTimes<TPhase extends string>({
  definition,
  phases,
  stepTimes,
}: {
  definition: Definition<TPhase>;
  phases: readonly { id: TPhase; status: PhaseStatus }[];
  stepTimes: StepTimes;
}): PhaseTime[] {
  const doneAt = getGenerationDoneAt({ definition, stepTimes });

  const reported = phases.map((phase) =>
    getReportedTimes({ definition, phase: phase.id, stepTimes }),
  );

  return phases.map((phase, index) => {
    if (phase.status === "pending") {
      return UNTIMED;
    }

    const startedAt = getPassedAt({ doneAt, index: index - 1, reported });

    if (phase.status !== "completed") {
      return { endedAt: null, startedAt };
    }

    return {
      endedAt: latest([getPassedAt({ doneAt, index, reported }), reported[index]?.finished]),
      startedAt,
    };
  });
}
