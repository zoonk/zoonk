import { type GenerationKindDefinition, getGenerationDoneAt } from "../generation-kinds";
import { type GenerationStepTimes } from "../generation-run";
import { type PhaseStatus, getPhaseSteps, toStages } from "./phase-progress";

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

type StageTimes = Pick<ReportedTimes, "allFinished" | "started">;

/**
 * `getPhaseProgress` moves past a stage once a later one reports a step, every step of one before
 * the last finished, or the run is done.
 */
function getPassedAt({
  doneAt,
  index,
  stages,
}: {
  doneAt: number | null;
  index: number;
  stages: readonly StageTimes[];
}): number | null {
  const isLast = index === stages.length - 1;

  return earliest([
    isLast ? null : stages[index]?.allFinished,
    ...stages.slice(index + 1).map((times) => times.started),
    doneAt,
  ]);
}

function toStageTimes(stage: readonly { reported: ReportedTimes }[]): StageTimes {
  const finished = stage.map((phase) => phase.reported.allFinished);

  return {
    allFinished: finished.every((time) => time !== null) ? latest(finished) : null,
    started: earliest(stage.map((phase) => phase.reported.started)),
  };
}

/**
 * A phase's clock runs while the wait shows it as the running one, so a shown start never moves
 * later, and a finished phase keeps the time of a step that finished after the wait moved on.
 * Phases that run together start with their stage and each ends at its own finish.
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

  const stages = toStages(
    phases.map((phase) => ({
      alongside: definition.phases.find((defined) => defined.id === phase.id)?.alongside,
      reported: getReportedTimes({ definition, phase: phase.id, stepTimes }),
      status: phase.status,
    })),
  );

  const stageTimes = stages.map((stage) => toStageTimes(stage));

  return stages.flatMap((stage, index) =>
    stage.map(({ reported, status }) => {
      if (status === "pending") {
        return UNTIMED;
      }

      const startedAt = getPassedAt({ doneAt, index: index - 1, stages: stageTimes });

      if (status !== "completed") {
        return { endedAt: null, startedAt };
      }

      const ownFinish = stage.length > 1 ? reported.allFinished : null;

      return {
        endedAt:
          ownFinish ??
          latest([getPassedAt({ doneAt, index, stages: stageTimes }), reported.finished]),
        startedAt,
      };
    }),
  );
}
