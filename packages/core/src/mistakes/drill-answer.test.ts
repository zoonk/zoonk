import { describe, expect, it } from "vitest";
import { applyDrillRules } from "./drill-answer";

const TRAP = "Adds the discount to the price";

const TRAP_DRILL = { kind: "spotTheTrap", timeLimitSeconds: null } as const;
const TIMED_DRILL = { kind: "timed", timeLimitSeconds: 45 } as const;

describe(applyDrillRules, () => {
  it("leaves answers outside a drill as graded", () => {
    expect(
      applyDrillRules({ drill: null, durationMs: 90_000, isCorrect: true, misconception: null }),
    ).toStrictEqual({ isCorrect: true, timeLimitMs: null, trap: null });
  });

  it("counts an answer that took a timed drill's whole time box as wrong", () => {
    const answer = { drill: TIMED_DRILL, isCorrect: true, misconception: null };

    expect(applyDrillRules({ ...answer, durationMs: 44_999 })).toStrictEqual({
      isCorrect: true,
      timeLimitMs: 45_000,
      trap: null,
    });

    expect(applyDrillRules({ ...answer, durationMs: 45_000 }).isCorrect).toBe(false);
  });

  it("never assigns a trap to an unknown answer", () => {
    expect(
      applyDrillRules({
        dontKnow: true,
        drill: TRAP_DRILL,
        durationMs: 9000,
        isCorrect: false,
        misconception: TRAP,
      }),
    ).toMatchObject({ isCorrect: false, trap: null });
  });

  it("names the trap the learner fell for", () => {
    expect(
      applyDrillRules({
        drill: TRAP_DRILL,
        durationMs: 9000,
        isCorrect: false,
        misconception: "Picked the discount",
      }).trap,
    ).toBe("Picked the discount");
  });

  it("does not assign a trap to a correct answer even if grading carries a misconception", () => {
    expect(
      applyDrillRules({ drill: TRAP_DRILL, durationMs: 9000, isCorrect: true, misconception: TRAP })
        .trap,
    ).toBeNull();
  });

  it("does not invent a trap for a wrong answer with no matching misconception", () => {
    expect(
      applyDrillRules({
        drill: TRAP_DRILL,
        durationMs: 9000,
        isCorrect: false,
        misconception: null,
      }).trap,
    ).toBeNull();
  });
});
