import { describe, expect, it } from "vitest";
import { getQuickTestMinutes } from "../language/level-test/level-test-contract";
import { DAY_PLACEMENT_MINUTES } from "../learner/placement/placement-budget";
import { getCourseQuickTestMinutes } from "./course-quick-test";

describe(getCourseQuickTestMinutes, () => {
  it("times a language course's quick test as its level test, and other courses' as the placement", () => {
    const courses = [
      { format: "language", targetLanguage: "es" },
      { format: "core", targetLanguage: null },
      { format: "exam", targetLanguage: null },
    ] as const;

    expect(courses.map((course) => getCourseQuickTestMinutes(course))).toStrictEqual([
      getQuickTestMinutes("language"),
      DAY_PLACEMENT_MINUTES,
      DAY_PLACEMENT_MINUTES,
    ]);
  });
});
