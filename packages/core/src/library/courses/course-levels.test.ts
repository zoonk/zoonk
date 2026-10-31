import { describe, expect, it } from "vitest";
import { listCourseLevels } from "./course-levels";

describe(listCourseLevels, () => {
  it("keeps the levels a course on the path to mastery hasn't written yet, in order", () => {
    expect(listCourseLevels({ format: "language", written: ["beginner"] })).toStrictEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);

    expect(
      listCourseLevels({ format: "core", written: ["intermediate", "overview"] }),
    ).toStrictEqual(["overview", "beginner", "intermediate", "advanced"]);
  });

  it("leaves an overview course as an overview", () => {
    expect(listCourseLevels({ format: "core", written: ["overview"] })).toStrictEqual(["overview"]);
  });

  it("adds no level to an exam's course, which the exam's subjects shape", () => {
    expect(listCourseLevels({ format: "exam", written: ["beginner"] })).toStrictEqual(["beginner"]);
  });

  it("adds no level to a learner's private course, which covers only their material", () => {
    expect(listCourseLevels({ format: "personalized", written: ["beginner"] })).toStrictEqual([
      "beginner",
    ]);
  });

  it("has no level before any chapter is written", () => {
    expect(listCourseLevels({ format: "language", written: [] })).toStrictEqual([]);
  });
});
