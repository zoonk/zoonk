import { describe, expect, it } from "vitest";
import {
  type GenerationKind,
  getGenerationKind,
  getStepMeaning,
  isGenerationDone,
} from "./generation-kinds";

function isDone(kind: GenerationKind, steps: Record<string, "completed" | "started">) {
  return isGenerationDone({ definition: getGenerationKind(kind), steps });
}

describe(getStepMeaning, () => {
  it("reads an ordinary step as progress", () => {
    expect(getStepMeaning({ kind: "curriculum", status: "started", step: "buildSkillGraph" })).toBe(
      "progress",
    );
  });

  it("follows another run when this one hands over", () => {
    expect(getStepMeaning({ kind: "lesson", status: "started", step: "joinRunningLesson" })).toBe(
      "join",
    );
  });

  it("stops at an error", () => {
    expect(getStepMeaning({ kind: "explanation", status: "error", step: "workflowError" })).toBe(
      "error",
    );

    expect(getStepMeaning({ kind: "understanding", status: "error", step: "readGoal" })).toBe(
      "error",
    );
  });
});

describe(isGenerationDone, () => {
  it("ends plan creation once the plan is saved although the run goes on", () => {
    expect(isDone("curriculum", { createPlan: "started" })).toBe(false);
    expect(isDone("curriculum", { createPlan: "completed" })).toBe(true);
  });

  it("keeps placement's wait open while its questions are written, until the goal is ready", () => {
    expect(isDone("placement", { createPlan: "completed", preparePlacement: "started" })).toBe(
      false,
    );

    expect(
      isDone("placement", { prepareFirstLessons: "started", preparePlacement: "started" }),
    ).toBe(false);

    expect(isDone("placement", { goalReady: "completed", preparePlacement: "started" })).toBe(true);
  });

  it("ends a wait when the run reports a step past it", () => {
    expect(isDone("firstLesson", { outlineCourses: "started" })).toBe(true);
    expect(isDone("levelTestBank", { levelTestBankReady: "completed" })).toBe(true);
  });

  it("ends an explanation once it's written and saved", () => {
    expect(isDone("explanation", { writeExplanation: "started" })).toBe(false);
    expect(isDone("explanation", { writeExplanation: "completed" })).toBe(true);
  });
});
