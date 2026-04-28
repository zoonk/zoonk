import { describe, expect, test } from "vitest";
import { calculateWeightedProgress, getPhaseOrder, getPhaseStatus } from "./generation-phases";

describe("chapter generation phases", () => {
  test("returns all 4 chapter phases in order", () => {
    const phases = getPhaseOrder();

    expect(phases).toEqual([
      "gettingReady",
      "preparingLessons",
      "classifyingLessons",
      "savingLessons",
    ]);
  });

  test("marks gettingReady as active when its step is the current step", () => {
    const status = getPhaseStatus("gettingReady", [], "getChapter");
    expect(status).toBe("active");
  });

  test("marks preparingLessons as active when generateLessons is in progress", () => {
    const status = getPhaseStatus(
      "preparingLessons",
      ["getChapter", "setChapterAsRunning"],
      "generateLessons",
    );

    expect(status).toBe("active");
  });

  test("marks classifyingLessons as active when lesson kind generation is in progress", () => {
    const status = getPhaseStatus(
      "classifyingLessons",
      ["getChapter", "setChapterAsRunning", "generateLessons"],
      "generateLessonKind",
    );

    expect(status).toBe("active");
  });

  test("marks savingLessons as completed when all its steps are done", () => {
    const status = getPhaseStatus(
      "savingLessons",
      [
        "getChapter",
        "setChapterAsRunning",
        "generateLessons",
        "generateLessonKind",
        "addLessons",
        "setChapterAsCompleted",
      ],
      null,
    );

    expect(status).toBe("completed");
  });

  test("returns 0 progress at start", () => {
    const progress = calculateWeightedProgress([], null);
    expect(progress).toBe(0);
  });

  test("returns 100 progress when all steps are complete", () => {
    const allSteps = [
      "getChapter",
      "setChapterAsRunning",
      "generateLessons",
      "generateLessonKind",
      "addLessons",
      "setChapterAsCompleted",
    ] as const;

    const progress = calculateWeightedProgress([...allSteps], null);
    expect(progress).toBe(100);
  });
});
