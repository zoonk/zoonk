import { describe, expect, it } from "vitest";
import { selectMistakeDrill, selectMistakesToPractice } from "./mistake-drills";

const CANDIDATES = [
  { hasMisconceptions: false, id: "original", seen: true },
  { hasMisconceptions: false, id: "seen-plain", seen: true },
  { hasMisconceptions: false, id: "new-plain", seen: false },
  { hasMisconceptions: true, id: "new-trap", seen: false },
  { hasMisconceptions: true, id: "seen-trap", seen: true },
];

describe(selectMistakeDrill, () => {
  it("re-teaches a content gap with the lesson and two new questions", () => {
    expect(
      selectMistakeDrill({
        candidates: CANDIDATES,
        cause: "gap",
        lessonId: "lesson",
        originalItemId: "original",
      }),
    ).toStrictEqual({
      itemIds: ["original", "new-plain", "new-trap"],
      kind: "reteach",
      lessonId: "lesson",
      timeLimitSeconds: null,
    });
  });

  it("drills traps with questions whose wrong options carry misconceptions", () => {
    const drill = selectMistakeDrill({
      candidates: CANDIDATES,
      cause: "trap",
      lessonId: "lesson",
      originalItemId: "original",
    });

    expect(drill).toMatchObject({
      itemIds: ["original", "new-trap", "seen-trap"],
      kind: "spotTheTrap",
      lessonId: null,
    });
  });

  it("times the drill for a mistake made by running out of time", () => {
    const drill = selectMistakeDrill({
      candidates: CANDIDATES,
      cause: "time",
      lessonId: null,
      originalItemId: "original",
    });

    expect(drill.kind).toBe("timed");
    expect(drill.timeLimitSeconds).toBeGreaterThan(0);
  });

  it("retries a mistake whose cause isn't known yet", () => {
    expect(
      selectMistakeDrill({
        candidates: CANDIDATES,
        cause: null,
        lessonId: null,
        originalItemId: "original",
      }).kind,
    ).toBe("retry");
  });

  it("works when the original question is gone", () => {
    const drill = selectMistakeDrill({
      candidates: CANDIDATES,
      cause: "misread",
      lessonId: null,
      originalItemId: null,
    });

    expect(drill.itemIds).toStrictEqual(["new-plain"]);
  });
});

function day(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

describe(selectMistakesToPractice, () => {
  it("takes the oldest mistakes, one per skill first, and none from today", () => {
    const picked = selectMistakesToPractice({
      limit: 3,
      mistakes: [
        { createdLocalDate: day("2026-09-01"), id: "m1", skillId: "a" },
        { createdLocalDate: day("2026-09-02"), id: "m2", skillId: "a" },
        { createdLocalDate: day("2026-09-03"), id: "m3", skillId: "b" },
        { createdLocalDate: day("2026-09-04"), id: "m4", skillId: "c" },
        { createdLocalDate: day("2026-09-10"), id: "today", skillId: "d" },
      ],
      today: day("2026-09-10"),
    });

    expect(picked.map((mistake) => mistake.id)).toStrictEqual(["m1", "m3", "m4"]);
  });
});
