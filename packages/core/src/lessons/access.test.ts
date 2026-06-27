import { describe, expect, it } from "vitest";
import { getLessonAccessRequirement } from "./access";

describe(getLessonAccessRequirement, () => {
  it("allows every first-chapter lesson without checking lesson position", () => {
    const laterFirstChapterLesson = { chapter: { position: 0 }, position: 99 };
    const requirement = getLessonAccessRequirement({ lesson: laterFirstChapterLesson });

    expect(requirement).toBe("free");
  });

  it("requires a subscription for every lesson outside the first chapter", () => {
    const laterChapterLesson = { chapter: { position: 1 }, position: 0 };

    expect(getLessonAccessRequirement({ lesson: laterChapterLesson })).toBe("subscription");
  });
});
