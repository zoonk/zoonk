import { describe, expect, it } from "vitest";
import { choosePace, isMorePrecise } from "./plan-pace";

describe(choosePace, () => {
  it("uses the learner's own pace once they finished enough lessons, more of it as they finish more", () => {
    const others = { course: { count: 100, ratio: 1.1 }, typical: { count: 900, ratio: 1 } };

    // Five lessons are a hint: the pace moves toward theirs from the course's.
    expect(choosePace({ ...others, own: { count: 5, ratio: 1.3 } })).toStrictEqual({
      factor: 1.14,
      source: "own",
    });

    expect(choosePace({ ...others, own: { count: 180, ratio: 1.3 } }).factor).toBe(1.28);
  });

  it("doesn't halve a plan on a few quick lessons", () => {
    // A learner who breezed through five easy lessons at half the estimate.
    const pace = choosePace({
      course: null,
      own: { count: 5, ratio: 0.5 },
      typical: { count: 900, ratio: 1.02 },
    });

    expect(pace.source).toBe("own");
    expect(pace.factor).toBeGreaterThan(0.9);
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
