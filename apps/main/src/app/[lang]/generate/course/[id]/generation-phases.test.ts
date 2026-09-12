import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { describe, expect, it } from "vitest";
import {
  calculateTargetProgress,
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
} from "./generation-phases";

const identitySteps: CourseWorkflowStepName[] = [
  "getCoursePrompt",
  "generateCourseIdentitySearchQueries",
  "resolveCourseIdentity",
  "initializeCourse",
  "setCourseAsRunning",
];

const completedSteps: CourseWorkflowStepName[] = [
  ...identitySteps,
  "generateChapters",
  "generateDescription",
  "generateImage",
  "generateCategories",
  "generateLandingPage",
  "getExistingChapters",
  "updateCourse",
  "addCategories",
  "addChapters",
  "completeCourseSetup",
];

describe("course generation progress", () => {
  it("waits for the full course instead of a fixed introduction lesson", () => {
    expect(getPhaseOrder()).toStrictEqual(["findingCourse", "planningChapters", "preparingCourse"]);
    expect(calculateWeightedProgress(completedSteps, null)).toBe(100);
  });

  it("keeps the complete curriculum active while parallel metadata finishes", () => {
    const steps: CourseWorkflowStepName[] = [
      ...identitySteps,
      "generateDescription",
      "generateImage",
    ];

    expect(getPhaseStatus("planningChapters", steps, "generateImage", ["generateChapters"])).toBe(
      "active",
    );

    expect(calculateWeightedProgress(steps, "generateChapters")).toBeLessThan(50);
    expect(calculateTargetProgress(steps, "generateChapters")).toBeLessThan(100);
  });

  it("does not mark identity complete just because the initial read finished", () => {
    expect(getPhaseStatus("findingCourse", ["getCoursePrompt"], null)).toBe("active");
  });
});
