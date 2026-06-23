import { describe, expect, it } from "vitest";
import { calculateWeightedProgress, getPhaseOrder, getPhaseStatus } from "./generation-phases";

describe("course generation phases", () => {
  it("returns all 9 course phases in workflow order", () => {
    const phases = getPhaseOrder();

    expect(phases).toStrictEqual([
      "gettingReady",
      "findingSimilarCourses",
      "checkingCourseIdentity",
      "preparingCourse",
      "writingDescription",
      "creatingCoverImage",
      "categorizingCourse",
      "outliningChapters",
      "savingCourseInfo",
    ]);
  });

  it("marks the search phase as active when generating identity search queries", () => {
    const status = getPhaseStatus(
      "findingSimilarCourses",
      [],
      "generateCourseIdentitySearchQueries",
    );

    expect(status).toBe("active");
  });

  it("marks the course identity phase as active when classifying candidates", () => {
    const status = getPhaseStatus("checkingCourseIdentity", [], "resolveCourseIdentity");
    expect(status).toBe("active");
  });

  it("marks phase as active when its step is the current step", () => {
    const status = getPhaseStatus("writingDescription", [], "generateDescription");
    expect(status).toBe("active");
  });

  it("marks phase as completed when all its steps are completed", () => {
    const status = getPhaseStatus(
      "preparingCourse",
      ["initializeCourse", "setCourseAsRunning"],
      null,
    );

    expect(status).toBe("completed");
  });

  it("marks phase as pending when no steps have started", () => {
    const status = getPhaseStatus("outliningChapters", [], null);
    expect(status).toBe("pending");
  });

  it("returns 0 progress at start", () => {
    const progress = calculateWeightedProgress([], null);
    expect(progress).toBe(0);
  });

  it("returns 100 progress when all steps are complete", () => {
    const allSteps = [
      "getCourseStartRequest",
      "generateCourseIdentitySearchQueries",
      "resolveCourseIdentity",
      "initializeCourse",
      "setCourseAsRunning",
      "generateDescription",
      "generateImage",
      "generateCategories",
      "generateChapters",
      "getExistingChapters",
      "updateCourse",
      "addCategories",
      "addChapters",
      "completeCourseSetup",
    ] as const;

    const progress = calculateWeightedProgress([...allSteps], null);
    expect(progress).toBe(100);
  });
});
