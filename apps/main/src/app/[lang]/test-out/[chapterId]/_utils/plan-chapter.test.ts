import { describe, expect, it } from "vitest";
import { findPlanChapter } from "./plan-chapter";

function row(chapterId: string | null, lessonsDone: number, lessonsTotal: number) {
  return { chapterId, lessonsDone, lessonsTotal, title: `Chapter ${chapterId ?? "writing"}` };
}

describe(findPlanChapter, () => {
  it("names the chapter with the lessons it still has on the plan", () => {
    expect(
      findPlanChapter({
        chapterId: "ratios",
        phases: [{ chapters: [row("fractions", 4, 4), row("ratios", 1, 6)] }],
      }),
    ).toStrictEqual({ lessonsLeft: 5, title: "Chapter ratios" });
  });

  it("counts a chapter that goes deeper in a later phase across both", () => {
    expect(
      findPlanChapter({
        chapterId: "ratios",
        phases: [
          { chapters: [row("ratios", 3, 3)] },
          { chapters: [row(null, 0, 2), row("ratios", 0, 2)] },
        ],
      }),
    ).toStrictEqual({ lessonsLeft: 2, title: "Chapter ratios" });
  });

  it("finds nothing when the plan doesn't have the chapter", () => {
    expect(
      findPlanChapter({ chapterId: "ratios", phases: [{ chapters: [row("fractions", 0, 4)] }] }),
    ).toBeNull();
  });
});
