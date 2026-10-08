import { describe, expect, it } from "vitest";
import { type SessionItem, parseSessionItem } from "../sessions/_utils/session-items";
import { applyDrillRules } from "./drill-answer";

const TRAP = "Adds the discount to the price";

function toItem(format: SessionItem["format"], content: object): SessionItem {
  const item = parseSessionItem({ content, format, id: "item", language: "en", skillId: "skill" });

  if (!item) {
    throw new Error(`Not a session item: ${format}`);
  }

  return item;
}

const choice = toItem("multipleChoice", {
  context: null,
  options: [
    { isCorrect: true, misconception: null, reason: "Right.", text: "R$ 102" },
    { isCorrect: false, misconception: null, reason: "No.", text: "R$ 100" },
    { isCorrect: false, misconception: TRAP, reason: "No.", text: "R$ 138" },
  ],
  question: "How much do you pay?",
});

const statement = toItem("trueFalse", {
  context: null,
  isTrue: false,
  misconception: TRAP,
  reason: "You pay less.",
  statement: "You pay R$ 138.",
});

const pairs = toItem("matchPairs", {
  pairs: [
    { left: "10%", right: "0.1" },
    { left: "50%", right: "0.5" },
  ],
  question: "Match them.",
  reason: "Percent means per hundred.",
});

const TRAP_DRILL = { kind: "spotTheTrap", timeLimitSeconds: null } as const;
const TIMED_DRILL = { kind: "timed", timeLimitSeconds: 45 } as const;

describe(applyDrillRules, () => {
  it("leaves answers outside a drill as graded", () => {
    expect(
      applyDrillRules({
        drill: null,
        durationMs: 90_000,
        isCorrect: true,
        item: choice,
        misconception: null,
      }),
    ).toStrictEqual({ isCorrect: true, timeLimitMs: null, trap: null });
  });

  it("counts an answer that took a timed drill's whole time box as wrong", () => {
    const answer = { drill: TIMED_DRILL, isCorrect: true, item: choice, misconception: null };

    expect(applyDrillRules({ ...answer, durationMs: 44_999 })).toStrictEqual({
      isCorrect: true,
      timeLimitMs: 45_000,
      trap: null,
    });

    expect(applyDrillRules({ ...answer, durationMs: 45_000 }).isCorrect).toBe(false);
  });

  it("names the trap the learner fell for", () => {
    expect(
      applyDrillRules({
        drill: TRAP_DRILL,
        durationMs: 9000,
        isCorrect: false,
        item: choice,
        misconception: "Picked the discount",
      }).trap,
    ).toBe("Picked the discount");
  });

  it("names the trap a question sets even after a right answer", () => {
    const right = { drill: TRAP_DRILL, durationMs: 9000, isCorrect: true, misconception: null };

    expect(applyDrillRules({ ...right, item: choice }).trap).toBe(TRAP);
    expect(applyDrillRules({ ...right, item: statement }).trap).toBe(TRAP);
    expect(applyDrillRules({ ...right, item: pairs }).trap).toBeNull();
  });
});
