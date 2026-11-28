import { describe, expect, it } from "vitest";
import { getGoalCourseLevel } from "./goal-course-level";

describe(getGoalCourseLevel, () => {
  it.each([
    [{ level: "none", purpose: "deep" }, "beginner"],
    [{ level: "basic", purpose: "deep" }, "beginner"],
    [{ level: "intermediate", purpose: "deep" }, "intermediate"],
    [{ level: "advanced", purpose: "other" }, "advanced"],
    [{ purpose: "deep" }, "beginner"],
    [{}, "beginner"],
    [{ level: "advanced", purpose: "overview" }, "overview"],
    [{ level: "intermediate", purpose: "refresh" }, "intermediate"],
    [{ level: "basic", purpose: "work" }, undefined],
    [{ level: "none", purpose: "careerChange" }, undefined],
  ])("writes a learn goal with %j one band at a time: %s", (details, level) => {
    expect(getGoalCourseLevel({ details, kind: "learn" })).toBe(level);
  });

  it("keeps the band a goal continued at, whatever its purpose", () => {
    expect(
      getGoalCourseLevel({
        details: { courseLevel: "intermediate", level: "basic", purpose: "work" },
        kind: "learn",
      }),
    ).toBe("intermediate");
  });

  it("never bounds an exam or a language goal", () => {
    expect(
      getGoalCourseLevel({ details: { courseLevel: "beginner" }, kind: "exam" }),
    ).toBeUndefined();

    expect(getGoalCourseLevel({ details: { level: "none" }, kind: "language" })).toBeUndefined();
  });
});
