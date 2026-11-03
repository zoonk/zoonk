import { describe, expect, it } from "vitest";
import { type GenerationKind, getGenerationKind } from "../generation-kinds";
import { type GenerationRun } from "../generation-run";
import { getPhaseProgress } from "./phase-progress";
import { getPhaseTimes } from "./phase-times";

function timesOf(
  run: Pick<GenerationRun, "stepTimes" | "steps">,
  kind: GenerationKind = "curriculum",
) {
  const definition = getGenerationKind(kind);

  const { phases } = getPhaseProgress({
    definition,
    run: { failure: null, status: "following", ...run },
  });

  return getPhaseTimes({ definition, phases, stepTimes: run.stepTimes ?? {} });
}

describe(getPhaseTimes, () => {
  it("times finished phases from their steps and the running one from when the wait reached it", () => {
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
      { endedAt: null, startedAt: 8500 },
      { endedAt: null, startedAt: null },
    ]);
  });

  it("ends a phase whose finish wasn't reported as the next one begins", () => {
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

  it("keeps the running phase's start when its own step reports later", () => {
    expect(
      timesOf({
        stepTimes: {
          buildSkillGraph: { completed: 30_000, started: 2000 },
          saveSkills: { started: 41_000 },
          understandGoal: { started: 1000 },
        },
        steps: { buildSkillGraph: "completed", saveSkills: "started", understandGoal: "started" },
      })[2],
    ).toStrictEqual({ endedAt: null, startedAt: 30_000 });
  });

  it("times a finished phase over the whole time it was the running one", () => {
    expect(
      timesOf({
        stepTimes: {
          buildSkillGraph: { completed: 30_000, started: 2000 },
          createPlan: { completed: 54_000 },
          saveSkills: { started: 41_000 },
          understandGoal: { started: 1000 },
        },
        steps: {
          buildSkillGraph: "completed",
          createPlan: "completed",
          saveSkills: "started",
          understandGoal: "started",
        },
      }),
    ).toStrictEqual([
      { endedAt: 2000, startedAt: 1000 },
      { endedAt: 30_000, startedAt: 2000 },
      { endedAt: 54_000, startedAt: 30_000 },
    ]);
  });

  it("ends a phase when the wait moved past it, though one of its steps finished earlier", () => {
    expect(
      timesOf(
        {
          stepTimes: {
            buildSkillGraph: { completed: 30_000, started: 2000 },
            saveSkills: { started: 41_000 },
            understandGoal: { started: 1000 },
          },
          steps: { buildSkillGraph: "completed", saveSkills: "started", understandGoal: "started" },
        },
        "courseOutline",
      ).slice(0, 2),
    ).toStrictEqual([
      { endedAt: 41_000, startedAt: 1000 },
      { endedAt: null, startedAt: 41_000 },
    ]);
  });

  it("ends a phase when its own step finished, after the wait moved past it", () => {
    expect(
      timesOf(
        {
          stepTimes: {
            classifyQuestion: { completed: 2000, started: 1000 },
            findExplanation: { completed: 4000, started: 2020 },
            writeExplanation: { started: 2010 },
          },
          steps: {
            classifyQuestion: "completed",
            findExplanation: "completed",
            writeExplanation: "started",
          },
        },
        "explanation",
      ),
    ).toStrictEqual([
      { endedAt: 2000, startedAt: 1000 },
      { endedAt: 4000, startedAt: 2000 },
      { endedAt: null, startedAt: 2010 },
    ]);
  });

  it("ends the last phase when the run is done, after its own steps finished", () => {
    expect(
      timesOf(
        {
          stepTimes: {
            buildSkillGraph: { completed: 30_000, started: 2000 },
            createPlan: { completed: 54_000 },
            goalReady: { completed: 90_000 },
          },
          steps: { buildSkillGraph: "completed", createPlan: "completed", goalReady: "completed" },
        },
        "placement",
      ).at(-1),
    ).toStrictEqual({ endedAt: 90_000, startedAt: 30_000 });
  });

  it("has no times for a run that reported none", () => {
    expect(timesOf({ steps: { understandGoal: "completed" } })).toStrictEqual([
      { endedAt: null, startedAt: null },
      { endedAt: null, startedAt: null },
      { endedAt: null, startedAt: null },
    ]);
  });
});
