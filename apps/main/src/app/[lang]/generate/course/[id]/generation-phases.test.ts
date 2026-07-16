import { describe, expect, it } from "vitest";
import { calculateWeightedProgress, getPhaseOrder, getPhaseStatus } from "./generation-phases";

describe("course generation phases", () => {
  it("returns non-language phases through first lesson readiness", () => {
    const phases = getPhaseOrder();

    expect(phases).toStrictEqual([
      "gettingReady",
      "findingSimilarCourses",
      "checkingCourseIdentity",
      "preparingCourse",
      "planningIntroduction",
      "savingIntroduction",
      "writingFirstLesson",
    ]);
  });

  it("returns language phases without regular-course introduction phases", () => {
    const phases = getPhaseOrder({ isLanguageCourse: true });

    expect(phases).toStrictEqual([
      "gettingReady",
      "findingSimilarCourses",
      "checkingCourseIdentity",
      "preparingCourse",
      "writingDescription",
      "creatingCoverImage",
      "categorizingCourse",
      "outliningChapters",
      "writingLandingPage",
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

  it("marks the landing-page phase as active when generating landing copy", () => {
    const status = getPhaseStatus(
      "writingLandingPage",
      ["generateChapters"],
      "generateLandingPage",
    );

    expect(status).toBe("active");
  });

  it("marks the first-lesson phase as active when streaming intro lesson content", () => {
    const status = getPhaseStatus("writingFirstLesson", [], "generateExplanationContent");

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

  it("returns 100 progress for non-language courses when the first intro lesson is ready", () => {
    const completedSteps = [
      "getCoursePrompt",
      "generateCourseIdentitySearchQueries",
      "resolveCourseIdentity",
      "initializeCourse",
      "setCourseAsRunning",
      "generateIntroductionChapter",
      "addIntroductionChapter",
      "getChapter",
      "addLessons",
      "getLesson",
      "setLessonAsRunning",
      "generateExplanationContent",
      "generateImagePrompts",
      "generateStepImages",
      "generateLessonImage",
      "saveExplanationLesson",
      "setLessonAsCompleted",
      "completeIntroductionLesson",
    ] as const;

    const progress = calculateWeightedProgress([...completedSteps], null);
    expect(progress).toBe(100);
  });

  it("returns 100 progress for language courses when full course setup is complete", () => {
    const completedSteps = [
      "getCoursePrompt",
      "generateCourseIdentitySearchQueries",
      "resolveCourseIdentity",
      "initializeCourse",
      "setCourseAsRunning",
      "generateDescription",
      "generateImage",
      "generateCategories",
      "generateChapters",
      "generateLandingPage",
      "getExistingChapters",
      "updateCourse",
      "addCategories",
      "addChapters",
      "completeCourseSetup",
    ] as const;

    const progress = calculateWeightedProgress([...completedSteps], null, undefined, true);
    expect(progress).toBe(100);
  });
});
