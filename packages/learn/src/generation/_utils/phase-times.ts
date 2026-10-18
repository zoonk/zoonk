import { type GenerationKindDefinition } from "../generation-kinds";
import { type GenerationStepTimes } from "../generation-run";
import { type PhaseStatus, getPhaseSteps } from "./phase-progress";

type Definition<TPhase extends string> = GenerationKindDefinition<string, TPhase>;
type StepTimes = Partial<Record<string, GenerationStepTimes>>;

/**
 * How long a phase has taken, on the server's clock: a finished one with its length (`endedAt`),
 * the running one with when it began, to count on from. Null fields where the run didn't say.
 */
export type PhaseTime = { endedAt: number | null; startedAt: number | null };

const UNTIMED: PhaseTime = { endedAt: null, startedAt: null };

/** The earliest of the times, or null when there's none. */
function earliest(times: (number | undefined)[]): number | null {
  const known = times.filter((time) => time !== undefined);
  return known.length > 0 ? Math.min(...known) : null;
}

/** The latest of the times, or null when there's none. */
function latest(times: (number | undefined)[]): number | null {
  const known = times.filter((time) => time !== undefined);
  return known.length > 0 ? Math.max(...known) : null;
}

/** When a phase's first step began and its last one finished, as far as the run reported them. */
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

/** One phase's time from its own reports and its neighbors' (`getPhaseTimes`). */
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
 * When each phase of a wait began and ended, from the times the run reported its steps (in the
 * phases' order, with their statuses from `getPhaseProgress`). A phase begins with its first
 * step's report, or when the one before it ended, since runs don't report every step; a finished
 * one ends with its last step to finish, or as the next one begins. Pending phases have no time.
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
