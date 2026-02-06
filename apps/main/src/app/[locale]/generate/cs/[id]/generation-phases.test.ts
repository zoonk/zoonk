import { ACTIVITY_STEPS, CHAPTER_STEPS, COURSE_STEPS, LESSON_STEPS } from "@/workflows/config";
import { describe, expect, it } from "vitest";
import { PHASE_ICONS, PHASE_ORDER } from "./generation-phases";

describe("generation-phases", () => {
  it("has 13 phases in PHASE_ORDER", () => {
    expect(PHASE_ORDER).toHaveLength(13);
  });

  it("has an icon for every phase", () => {
    for (const phase of PHASE_ORDER) {
      expect(PHASE_ICONS[phase]).toBeDefined();
    }
  });

  it("covers all workflow steps (module loads without throwing)", () => {
    const allSteps = [
      ...COURSE_STEPS,
      ...CHAPTER_STEPS,
      ...LESSON_STEPS,
      ...ACTIVITY_STEPS.filter((step) => step !== "workflowError"),
    ];

    // The module-level runtime check in generation-phases.ts throws if any step is missing.
    // If we got here, the import succeeded and all steps are covered.
    expect(allSteps.length).toBeGreaterThan(0);
  });
});
