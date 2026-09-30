import { describe, expect, it } from "vitest";
import { choosePace, isMorePrecise } from "./plan-pace";

describe(choosePace, () => {
  it("uses the learner's own pace once they finished enough lessons", () => {
    expect(
      choosePace({
        course: { count: 100, ratio: 1.1 },
        own: { count: 5, ratio: 1.3 },
        typical: { count: 900, ratio: 1 },
      }),
    ).toStrictEqual({ factor: 1.3, source: "own" });
  });

  it("falls back to others on the same lessons, then to everyone", () => {
    expect(
      choosePace({ course: { count: 20, ratio: 0.9 }, own: { count: 4, ratio: 2 }, typical: null }),
    ).toStrictEqual({ factor: 0.9, source: "course" });

    expect(
      choosePace({
        course: { count: 19, ratio: 0.9 },
        own: null,
        typical: { count: 50, ratio: 1.2 },
      }),
    ).toStrictEqual({ factor: 1.2, source: "typical" });
  });

  it("uses the lessons' own estimates without data and keeps the factor in bounds", () => {
    expect(choosePace({ course: null, own: null, typical: null })).toStrictEqual({
      factor: 1,
      source: "typical",
    });

    expect(choosePace({ course: null, own: { count: 9, ratio: 7 }, typical: null }).factor).toBe(
      2.5,
    );
  });
});

describe(isMorePrecise, () => {
  it("is true only when the pace comes from a closer source than before", () => {
    const own = { factor: 1, source: "own" } as const;
    const course = { factor: 1, source: "course" } as const;

    expect(isMorePrecise({ next: own, previous: course })).toBe(true);
    expect(isMorePrecise({ next: course, previous: own })).toBe(false);
    expect(isMorePrecise({ next: own, previous: null })).toBe(false);
  });
});
