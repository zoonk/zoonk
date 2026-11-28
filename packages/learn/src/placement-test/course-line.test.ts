import { describe, expect, it } from "vitest";
import { toCourseSegments } from "./course-line";

describe(toCourseSegments, () => {
  it("fills what the test skipped and rings the chapter the learner starts in", () => {
    expect(
      toCourseSegments([
        { done: 0, lessons: 2, skipped: 2, start: false },
        { done: 0, lessons: 4, skipped: 1, start: true },
        { done: 0, lessons: 3, skipped: 0, start: false },
      ]),
    ).toStrictEqual([
      { share: 0, state: "done", weight: 2 },
      { share: 0.25, state: "current", weight: 4 },
      { share: 0, state: "ahead", weight: 3 },
    ]);
  });

  it("fills a chapter studied before the start like one the test skipped", () => {
    expect(
      toCourseSegments([
        { done: 2, lessons: 2, skipped: 0, start: false },
        { done: 1, lessons: 2, skipped: 1, start: false },
        { done: 0, lessons: 3, skipped: 0, start: true },
      ]),
    ).toStrictEqual([
      { share: 0, state: "done", weight: 2 },
      { share: 0, state: "done", weight: 2 },
      { share: 0, state: "current", weight: 3 },
    ]);
  });

  it("fills the start chapter's own lessons studied after the result", () => {
    expect(
      toCourseSegments([
        { done: 0, lessons: 2, skipped: 2, start: false },
        { done: 2, lessons: 4, skipped: 1, start: true },
        { done: 0, lessons: 2, skipped: 1, start: false },
      ]),
    ).toStrictEqual([
      { share: 0, state: "done", weight: 2 },
      { share: 0.75, state: "current", weight: 4 },
      { share: 0.5, state: "ahead", weight: 2 },
    ]);
  });
});
