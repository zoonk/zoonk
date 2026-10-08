import { describe, expect, it } from "vitest";
import { type GenerationKind, getGenerationKind } from "../generation-kinds";
import { type GenerationRun } from "../generation-run";
import { getPhaseProgress } from "./phase-progress";

function progressOf(kind: GenerationKind, run: Partial<GenerationRun>) {
  return getPhaseProgress({
    definition: getGenerationKind(kind),
    run: { failure: null, status: "following", steps: {}, ...run },
  });
}

function statusesOf(kind: GenerationKind, run: Partial<GenerationRun>) {
  return progressOf(kind, run).phases.map((phase) => `${phase.id}:${phase.status}`);
}

describe(getPhaseProgress, () => {
  it("starts on the first phase before the run reports anything", () => {
    const result = progressOf("curriculum", { status: "waiting" });

    expect(result.phases.map((phase) => phase.status)).toStrictEqual([
      "active",
      "pending",
      "pending",
    ]);

    expect(result.progress).toBe(0);
    expect(result.target).toBeGreaterThan(0);
    expect(result.activeMs).toBe(8000);
  });

  it("treats the phases before a later reported step as done", () => {
    expect(
      statusesOf("curriculum", { steps: { saveSkills: "started", understandGoal: "started" } }),
    ).toStrictEqual(["goal:completed", "skills:completed", "plan:active"]);
  });

  it("moves to the next phase once every step of the running one finished", () => {
    expect(statusesOf("curriculum", { steps: { understandGoal: "completed" } })).toStrictEqual([
      "goal:completed",
      "skills:active",
      "plan:pending",
    ]);
  });

  it("weighs each phase by how long it usually takes", () => {
    const result = progressOf("curriculum", { steps: { understandGoal: "completed" } });

    // Reading the goal (8 s) is done and mapping skills (60 s) runs, out of 83 s.
    expect(result.progress).toBeCloseTo((8 / 83) * 100);
    expect(result.target).toBeCloseTo((68 / 83) * 100);
    expect(result.activeMs).toBe(60_000);
  });

  it("is done once the step that ends the wait finished, although the run goes on", () => {
    const result = progressOf("curriculum", {
      steps: { createPlan: "completed", saveSkills: "started" },
    });

    expect(result.phases.every((phase) => phase.status === "completed")).toBe(true);
    expect(result.progress).toBe(100);
    expect(result.activeMs).toBeNull();
  });

  it("is done when the run reports a step past the wait", () => {
    expect(progressOf("placement", { steps: { goalReady: "completed" } }).progress).toBe(100);
  });

  it("is done when the host says the content is ready", () => {
    expect(progressOf("lesson", { status: "ready" }).progress).toBe(100);
  });

  it("shows reading the exam's notice only for a run that reads one", () => {
    expect(statusesOf("curriculum", { steps: { understandGoal: "started" } })).toStrictEqual([
      "goal:active",
      "skills:pending",
      "plan:pending",
    ]);

    expect(
      statusesOf("curriculum", { steps: { readExamNotice: "started", understandGoal: "started" } }),
    ).toStrictEqual(["goal:completed", "notice:active", "skills:pending", "plan:pending"]);
  });

  it("is done with placement once the goal is ready, while its questions are written before", () => {
    const writing = progressOf("placement", {
      steps: { createPlan: "completed", preparePlacement: "started", saveSkills: "started" },
    });

    const ready = progressOf("placement", {
      steps: { createPlan: "completed", goalReady: "completed", preparePlacement: "started" },
    });

    expect(writing.progress).toBeLessThan(100);
    expect(ready.progress).toBe(100);
  });

  it("shows an optional phase only once the run reports it", () => {
    expect(statusesOf("understanding", { steps: { readGoal: "started" } })).toStrictEqual([
      "read:active",
    ]);

    expect(
      statusesOf("understanding", { steps: { findExamDates: "started", readGoal: "completed" } }),
    ).toStrictEqual(["read:completed", "dates:active"]);
  });

  it("marks where a failed run stopped", () => {
    expect(
      statusesOf("explanation", {
        failure: "generation",
        status: "failed",
        steps: { findExplanation: "started" },
      }),
    ).toStrictEqual(["read:completed", "find:failed", "write:pending"]);
  });

  it("keeps the running phase as it was when only the connection dropped", () => {
    expect(
      statusesOf("lesson", {
        failure: "connection",
        status: "failed",
        steps: { planLesson: "started" },
      }),
    ).toStrictEqual(["plan:active", "write:pending"]);
  });

  it("has nothing running when the run never started", () => {
    const result = progressOf("firstLesson", { failure: "notStarted", status: "failed" });

    expect(result.phases.map((phase) => phase.status)).toStrictEqual([
      "pending",
      "pending",
      "pending",
    ]);

    expect(result.activeMs).toBeNull();
  });
});
