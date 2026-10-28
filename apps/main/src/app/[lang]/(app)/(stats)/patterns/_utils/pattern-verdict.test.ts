import { MIN_PATTERN_ANSWERS } from "@zoonk/core/progress/score-performance";
import { describe, expect, it } from "vitest";
import { getPatternVerdict } from "./pattern-verdict";

function group({
  score,
  totalAnswers = MIN_PATTERN_ANSWERS,
}: {
  score: number;
  totalAnswers?: number;
}) {
  const correctAnswers = Math.round((score / 100) * totalAnswers);

  return { correctAnswers, incorrectAnswers: totalAnswers - correctAnswers, score, totalAnswers };
}

describe(getPatternVerdict, () => {
  it("names the best group when it stands out from the others that count", () => {
    const best = group({ score: 90 });
    const patterns = [group({ score: 70 }), best, group({ score: 60 })];

    expect(getPatternVerdict({ patterns, strongest: best })).toStrictEqual({ best, kind: "best" });
  });

  it("calls groups a few points apart even, with how close they are", () => {
    const best = group({ score: 73 });
    const patterns = [group({ score: 69.4 }), best, group({ score: 71 })];

    expect(getPatternVerdict({ patterns, strongest: best })).toStrictEqual({
      kind: "even",
      points: 4,
    });
  });

  it("names none while fewer than two groups have enough answers to compare", () => {
    const only = group({ score: 80 });
    const lucky = group({ score: 100, totalAnswers: 1 });

    expect(getPatternVerdict({ patterns: [only, lucky], strongest: only })).toStrictEqual({
      kind: "notEnough",
    });

    expect(getPatternVerdict({ patterns: [lucky], strongest: null })).toStrictEqual({
      kind: "notEnough",
    });
  });

  it("reports identical scores as zero points apart", () => {
    const first = group({ score: 70 });
    const second = group({ score: 70 });

    expect(getPatternVerdict({ patterns: [first, second], strongest: first })).toStrictEqual({
      kind: "even",
      points: 0,
    });
  });

  it("leaves a lucky group with too few answers out of the comparison", () => {
    const best = group({ score: 90 });
    const patterns = [group({ score: 60 }), best, group({ score: 100, totalAnswers: 1 })];

    expect(getPatternVerdict({ patterns, strongest: best })).toStrictEqual({ best, kind: "best" });
  });
});
