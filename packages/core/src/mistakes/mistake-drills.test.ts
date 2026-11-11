import { describe, expect, it } from "vitest";
import { selectMistakesToPractice } from "./mistake-drills";

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
