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

  it("times a lesson's marking and drawing from when writing ended, each to its own finish", () => {
    expect(
      timesOf(
        {
          stepTimes: {
            drawPictures: { completed: 70_000, started: 50_000 },
            markLesson: { started: 50_000 },
            planLesson: { completed: 20_000, started: 1000 },
            writeLesson: { completed: 50_000, started: 20_000 },
          },
          steps: {
            drawPictures: "completed",
            markLesson: "started",
            planLesson: "completed",
            writeLesson: "completed",
          },
        },
        "lesson",
      ).slice(2),
    ).toStrictEqual([
      { endedAt: null, startedAt: 50_000 },
      { endedAt: 70_000, startedAt: 50_000 },
    ]);
  });

  it("keeps a lesson's drawing time once the lesson is ready after marking ends", () => {
    expect(
      timesOf(
        {
          stepTimes: {
            drawPictures: { completed: 70_000, started: 50_000 },
            lessonReady: { completed: 250_010 },
            markLesson: { completed: 250_000, started: 50_000 },
            planLesson: { completed: 20_000, started: 1000 },
            writeLesson: { completed: 50_000, started: 20_000 },
          },
          steps: {
            drawPictures: "completed",
            lessonReady: "completed",
            markLesson: "completed",
            planLesson: "completed",
            writeLesson: "completed",
          },
        },
        "lesson",
      ).slice(2),
    ).toStrictEqual([
      { endedAt: 250_000, startedAt: 50_000 },
      { endedAt: 70_000, startedAt: 50_000 },
    ]);
  });

  it("starts a lesson's drawing with marking, before drawing reports its own start", () => {
    expect(
      timesOf(
        {
          stepTimes: {
            markLesson: { started: 50_000 },
            planLesson: { completed: 20_000, started: 1000 },
            writeLesson: { completed: 50_000, started: 20_000 },
          },
          steps: { markLesson: "started", planLesson: "completed", writeLesson: "completed" },
        },
        "lesson",
      ).slice(2),
    ).toStrictEqual([
      { endedAt: null, startedAt: 50_000 },
      { endedAt: null, startedAt: 50_000 },
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
