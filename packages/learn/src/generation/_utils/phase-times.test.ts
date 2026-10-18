import { describe, expect, it } from "vitest";
import { getGenerationKind } from "../generation-kinds";
import { type GenerationRun } from "../generation-run";
import { getPhaseProgress } from "./phase-progress";
import { getPhaseTimes } from "./phase-times";

const definition = getGenerationKind("curriculum");

function timesOf(run: Pick<GenerationRun, "stepTimes" | "steps">) {
  const { phases } = getPhaseProgress({
    definition,
    run: { failure: null, status: "following", ...run },
  });

  return getPhaseTimes({ definition, phases, stepTimes: run.stepTimes ?? {} });
}

describe(getPhaseTimes, () => {
  it("times finished phases from their steps and the running one from its start", () => {
    expect(
      timesOf({
        stepTimes: {
          buildSkillGraph: { started: 9000 },
          understandGoal: { completed: 8500, started: 1000 },
        },
        steps: { buildSkillGraph: "started", understandGoal: "completed" },
      }),
    ).toStrictEqual([
      { endedAt: 8500, startedAt: 1000 },
      { endedAt: null, startedAt: 9000 },
      { endedAt: null, startedAt: null },
    ]);
  });

  it("ends a phase whose finish wasn't reported as the next one begins", () => {
    // The run reported the skill graph's start, so reading the goal ended then.
    expect(
      timesOf({
        stepTimes: { buildSkillGraph: { started: 9000 }, understandGoal: { started: 1000 } },
        steps: { buildSkillGraph: "started", understandGoal: "started" },
      })[0],
    ).toStrictEqual({ endedAt: 9000, startedAt: 1000 });
  });

  it("starts the running phase when the one before it ended, before its own steps report", () => {
    expect(
      timesOf({
        stepTimes: { understandGoal: { completed: 8000, started: 1000 } },
        steps: { understandGoal: "completed" },
      })[1],
    ).toStrictEqual({ endedAt: null, startedAt: 8000 });
  });

  it("has no times for a run that reported none", () => {
    expect(timesOf({ steps: { understandGoal: "completed" } })).toStrictEqual([
      { endedAt: null, startedAt: null },
      { endedAt: null, startedAt: null },
      { endedAt: null, startedAt: null },
    ]);
  });
});
