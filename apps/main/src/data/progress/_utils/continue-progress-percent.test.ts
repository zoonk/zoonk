import { describe, expect, it } from "vitest";
import {
  type CourseContinueProgressChapter,
  calculateCourseContinueProgressPercent,
  calculateProgressPercent,
} from "./continue-progress-percent";

describe(calculateProgressPercent, () => {
  it("returns an integer percentage for completed items", () => {
    expect(calculateProgressPercent({ completedItems: 1, totalItems: 3 })).toBe(33);
  });

  it("keeps partial progress below 100 until every item is complete", () => {
    expect(calculateProgressPercent({ completedItems: 199, totalItems: 200 })).toBe(99);
  });

  it("keeps tiny non-zero progress visible", () => {
    expect(calculateProgressPercent({ completedItems: 1, totalItems: 300 })).toBe(1);
  });

  it("returns null when there is no total to measure", () => {
    expect(calculateProgressPercent({ completedItems: 0, totalItems: 0 })).toBeNull();
  });
});

describe(calculateCourseContinueProgressPercent, () => {
  it("uses actual lesson totals when every chapter is generated", () => {
    expect(
      calculateCourseContinueProgressPercent({
        chapters: [
          { completedLessons: 3, generationStatus: "completed", totalLessons: 3 },
          { completedLessons: 1, generationStatus: "completed", totalLessons: 2 },
          { completedLessons: 0, generationStatus: "completed", totalLessons: 2 },
        ],
      }),
    ).toBe(57);
  });

  it("estimates missing chapters from generated chapter lesson counts", () => {
    expect(
      calculateCourseContinueProgressPercent({
        chapters: [
          { completedLessons: 1, generationStatus: "completed", totalLessons: 3 },
          { completedLessons: 1, generationStatus: "completed", totalLessons: 2 },
          { completedLessons: 0, generationStatus: "pending", totalLessons: 0 },
        ],
      }),
    ).toBe(25);
  });

  it("never estimates below the lesson rows that already exist", () => {
    const chapters: CourseContinueProgressChapter[] = [
      { completedLessons: 1, generationStatus: "completed", totalLessons: 1 },
      { completedLessons: 0, generationStatus: "pending", totalLessons: 4 },
    ];

    expect(calculateCourseContinueProgressPercent({ chapters })).toBe(20);
  });
});
