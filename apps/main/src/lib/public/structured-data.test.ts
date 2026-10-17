import { describe, expect, it } from "vitest";
import { courseJsonLd, lessonJsonLd } from "./structured-data";

const lesson = {
  course: { name: "Quantum Physics", url: "https://www.zoonk.com/b/ai/c/quantum-physics" },
  description: "If it did, atoms wouldn't exist.",
  language: "en",
  level: "Beginner",
  name: "Why doesn't the electron fall into the nucleus?",
  teaches: [],
  url: "https://www.zoonk.com/b/ai/c/quantum-physics/ch/atoms/l/electrons",
};

const course = {
  description: "How the smallest things behave.",
  language: "en",
  levels: ["Overview", "Beginner"],
  name: "Quantum Physics",
  url: "https://www.zoonk.com/b/ai/c/quantum-physics",
};

describe(lessonJsonLd, () => {
  it("writes the lesson's length as an ISO 8601 duration", () => {
    expect(lessonJsonLd({ ...lesson, minutes: 5 }).timeRequired).toBe("PT5M");
    expect(lessonJsonLd({ ...lesson, minutes: 4.6 }).timeRequired).toBe("PT5M");
  });

  it("leaves out what it teaches until the summary is written", () => {
    expect(lessonJsonLd({ ...lesson, minutes: 5 })).not.toHaveProperty(
      "teaches",
      expect.anything(),
    );
  });
});

describe(courseJsonLd, () => {
  it("writes the course workload in hours and minutes", () => {
    expect(courseJsonLd({ ...course, totalMinutes: 134 }).hasCourseInstance).toMatchObject({
      courseWorkload: "PT2H14M",
    });

    expect(courseJsonLd({ ...course, totalMinutes: 120 }).hasCourseInstance).toMatchObject({
      courseWorkload: "PT2H",
    });
  });

  it("has no course instance before the outline is written", () => {
    expect(courseJsonLd({ ...course, totalMinutes: 0 }).hasCourseInstance).toBeUndefined();
  });
});
