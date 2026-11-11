import { describe, expect, it } from "vitest";
import { selectMistakesToPractice } from "./mistake-drills";

describe(selectMistakesToPractice, () => {
  it("keeps the oldest first, one per skill before the rest", () => {
    const picked = selectMistakesToPractice({
      limit: 3,
      mistakes: [
        { id: "m1", skillId: "a" },
        { id: "m2", skillId: "a" },
        { id: "m3", skillId: "b" },
        { id: "m4", skillId: "c" },
        { id: "m5", skillId: "d" },
      ],
    });

    expect(picked.map((mistake) => mistake.id)).toStrictEqual(["m1", "m3", "m4"]);
  });
});
