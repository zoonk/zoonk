import { describe, expect, test } from "vitest";
import { calculateWeightedProgress, getPhaseOrder, getPhaseStatus } from "./generation-phases";

describe("course generation phases", () => {
  test("returns all 6 course phases in order", () => {
    const phases = getPhaseOrder();

    expect(phases).toEqual([
      "gettingReady",
      "writingDescription",
      "creatingCoverImage",
      "categorizingCourse",
      "outliningChapters",
      "savingCourseInfo",
    ]);
  });

  test("marks phase as active when its step is the current step", () => {
    const status = getPhaseStatus("writingDescription", [], "generateDescription");
    expect(status).toBe("active");
  });

  test("marks phase as completed when all its steps are completed", () => {
    const status = getPhaseStatus(
      "gettingReady",
      ["getCourseSuggestion", "checkExistingCourse", "initializeCourse", "setCourseAsRunning"],
      null,
    );

    expect(status).toBe("completed");
  });

  test("marks phase as pending when no steps have started", () => {
    const status = getPhaseStatus("outliningChapters", [], null);
    expect(status).toBe("pending");
  });

  test("returns 0 progress at start", () => {
    const progress = calculateWeightedProgress([], null);
    expect(progress).toBe(0);
  });

  test("returns 100 progress when all steps are complete", () => {
    const allSteps = [
      "getCourseSuggestion",
      "checkExistingCourse",
      "initializeCourse",
      "setCourseAsRunning",
      "generateDescription",
      "generateImage",
      "generateAlternativeTitles",
      "generateCategories",
      "generateChapters",
      "getExistingChapters",
      "updateCourse",
      "addAlternativeTitles",
      "addCategories",
      "addChapters",
      "completeCourseSetup",
    ] as const;

    const progress = calculateWeightedProgress([...allSteps], null);
    expect(progress).toBe(100);
  });
});
