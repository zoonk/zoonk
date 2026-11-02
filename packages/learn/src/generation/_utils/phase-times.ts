import { type GenerationKindDefinition } from "../generation-kinds";
import { type GenerationStepTimes } from "../generation-run";
import { type PhaseStatus, getPhaseSteps } from "./phase-progress";

type Definition<TPhase extends string> = GenerationKindDefinition<string, TPhase>;
type StepTimes = Partial<Record<string, GenerationStepTimes>>;

export type PhaseTime = { endedAt: number | null; startedAt: number | null };

const UNTIMED: PhaseTime = { endedAt: null, startedAt: null };

function earliest(times: (number | undefined)[]): number | null {
  const known = times.filter((time) => time !== undefined);
  return known.length > 0 ? Math.min(...known) : null;
}

function latest(times: (number | undefined)[]): number | null {
  const known = times.filter((time) => time !== undefined);
  return known.length > 0 ? Math.max(...known) : null;
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

  return {
    finished: latest(times.map((time) => time.completed)),
    started: earliest(times.map((time) => time.started ?? time.completed)),
  };
}

type ReportedTimes = ReturnType<typeof getReportedTimes>;

function toPhaseTime({
  next,
  own,
  previous,
  status,
}: {
  next?: ReportedTimes;
  own?: ReportedTimes;
  previous?: ReportedTimes;
  status: PhaseStatus;
}): PhaseTime {
  if (status === "pending") {
    return UNTIMED;
  }

  const startedAt = own?.started ?? previous?.finished ?? null;

  if (status !== "completed") {
    return { endedAt: null, startedAt };
  }

  return { endedAt: own?.finished ?? next?.started ?? null, startedAt };
}

/**
 * Runs don't report every step, so a phase begins when the one before it ended and ends as the next
 * one begins.
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
  const reported = phases.map((phase) =>
    getReportedTimes({ definition, phase: phase.id, stepTimes }),
  );

  return phases.map((phase, index) =>
    toPhaseTime({
      next: reported[index + 1],
      own: reported[index],
      previous: reported[index - 1],
      status: phase.status,
    }),
  );
}
