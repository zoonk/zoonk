import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { describe, expect, it } from "vitest";
import { getVerdictAreas } from "./mock-verdict";

type Area = MockResult["areas"][number];

function area({
  correct,
  name,
  score = null,
  total = 10,
}: {
  correct: number;
  name: string;
  score?: number | null;
  total?: number;
}): Area {
  return {
    correct,
    name,
    part: null,
    points: { asked: total, earned: correct },
    score: score === null ? null : { high: score + 60, low: score - 60, score },
    secondsPerQuestion: 120,
    targetSecondsPerQuestion: null,
    total,
  };
}

function names(areas: Area[]) {
  const verdict = getVerdictAreas(areas);
  return verdict && { best: verdict.best.name, worst: verdict.worst.name };
}

describe(getVerdictAreas, () => {
  it("names the subject with the highest score and the one with the lowest", () => {
    expect(
      names([
        area({ correct: 4, name: "Languages", score: 480 }),
        area({ correct: 8, name: "English", score: 620 }),
        area({ correct: 6, name: "Humanities", score: 540 }),
      ]),
    ).toStrictEqual({ best: "English", worst: "Languages" });
  });

  it("compares by the share of right answers when the exam gives no score per subject", () => {
    expect(
      names([area({ correct: 3, name: "Law" }), area({ correct: 9, name: "Ethics" })]),
    ).toStrictEqual({ best: "Ethics", worst: "Law" });
  });

  it("names no strongest subject when no answer was right, whatever each estimate says", () => {
    expect(
      names([
        area({ correct: 0, name: "Languages", score: 320 }),
        area({ correct: 0, name: "Humanities", score: 350 }),
      ]),
    ).toBeNull();
  });

  it("names no subject to work on when every answer was right", () => {
    expect(
      names([
        area({ correct: 10, name: "Languages", score: 800 }),
        area({ correct: 10, name: "Humanities", score: 830 }),
      ]),
    ).toBeNull();
  });

  it("says nothing with one subject", () => {
    expect(names([area({ correct: 5, name: "Law" })])).toBeNull();
  });

  it("says nothing when the subjects did the same", () => {
    const same = [area({ correct: 5, name: "Law" }), area({ correct: 5, name: "Ethics" })];

    expect(names(same)).toBeNull();
  });
});
