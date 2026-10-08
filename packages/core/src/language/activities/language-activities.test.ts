import { describe, expect, it } from "vitest";
import { filterSkippedSteps } from "./language-activities";

const lesson = [
  { id: "1", kind: "vocabulary" },
  { id: "2", kind: "translation" },
  { id: "3", kind: "listening" },
  { id: "4", kind: "spokenAnswer" },
  { id: "5", kind: "typedAnswer" },
  { id: "6", kind: "summary" },
] as const;

describe(filterSkippedSteps, () => {
  it("drops the screens of skipped activities, words included", () => {
    const steps = filterSkippedSteps({ activities: ["vocabulary"], steps: lesson });

    expect(steps.map((step) => step.id)).toStrictEqual(["3", "4", "5", "6"]);
  });

  it("drops the screens of skipped activities", () => {
    const steps = filterSkippedSteps({ activities: ["writing", "speaking"], steps: lesson });

    expect(steps.map((step) => step.id)).toStrictEqual(["1", "2", "3", "6"]);
  });

  it("keeps every screen when nothing is skipped", () => {
    expect(filterSkippedSteps({ activities: [], steps: lesson })).toHaveLength(lesson.length);
  });

  it("never leaves a lesson with only its summary", () => {
    const steps = filterSkippedSteps({
      activities: ["vocabulary", "listening", "writing", "speaking"],
      steps: lesson,
    });

    expect(steps).toHaveLength(lesson.length);
  });
});
