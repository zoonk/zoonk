import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { describe, expect, it } from "vitest";
import { discountMath, discountQuestion } from "../../library/items/_test-utils/math-problems";
import {
  describeEarlierAnswer,
  gradeSessionAnswer,
  parseSessionItem,
  readRecordedAnswer,
  toSessionQuestion,
} from "./session-items";

const blockId = "0199a0b1-0000-7000-8000-00000000b10c";

const matchItem = {
  content: {
    pairs: [
      { left: "20% off", right: "Pay 80%" },
      { left: "Buy 3, pay 2", right: "About 33% off" },
      { left: "Up 10%, down 10%", right: "1% less" },
    ],
    question: "Match each deal to what you really pay.",
    reason: "A discount is part of the price.",
  },
  format: "matchPairs" as const,
  id: "0199a0b1-0000-7000-8000-000000000001",
  language: "en",
  skillId: "skill",
};

describe(toSessionQuestion, () => {
  it("shuffles the right column the same way every time, never in the pairs' order", () => {
    const item = parseSessionItem(matchItem);

    if (!item) {
      throw new Error("The match item should parse");
    }

    const first = toSessionQuestion({ blockId, item });

    expect(first.left).toStrictEqual(["20% off", "Buy 3, pay 2", "Up 10%, down 10%"]);
    expect(first.right).not.toStrictEqual(["Pay 80%", "About 33% off", "1% less"]);
    expect(toSessionQuestion({ blockId, item }).right).toStrictEqual(first.right);
  });
});

describe(gradeSessionAnswer, () => {
  it("grades matches against the order the learner saw", () => {
    const item = parseSessionItem(matchItem);

    if (!item) {
      throw new Error("The match item should parse");
    }

    const right = toSessionQuestion({ blockId, item }).right ?? [];
    const matches = matchItem.content.pairs.map((pair) => right.indexOf(pair.right));

    expect(gradeSessionAnswer({ answer: { matches }, blockId, item })).toMatchObject({
      correctAnswer: { matches },
      explanation: "A discount is part of the price.",
      isCorrect: true,
    });

    const wrong = gradeSessionAnswer({ answer: { matches: matches.toReversed() }, blockId, item });

    expect(wrong.isCorrect).toBe(false);

    expect(wrong.snapshot.correctAnswer).toBe(
      "20% off → Pay 80%; Buy 3, pay 2 → About 33% off; Up 10%, down 10% → 1% less",
    );
  });

  it("counts an answer meant for another format as wrong", () => {
    const item = parseSessionItem(matchItem);

    if (!item) {
      throw new Error("The match item should parse");
    }

    expect(gradeSessionAnswer({ answer: { selectedIndex: 0 }, blockId, item }).isCorrect).toBe(
      false,
    );
  });
});

const mathItem = {
  content: { context: null, math: discountMath, question: discountQuestion },
  format: "numeric" as const,
  id: "0199a0b1-0000-7000-8000-000000000002",
  language: "en",
  skillId: "skill",
};

function parseMath() {
  const item = parseSessionItem(mathItem);

  if (item?.format !== "numeric") {
    throw new Error("The math item should parse");
  }

  return item;
}

/** Numbers as questions and answers show them, without floating-point noise. */
function shown(value: number): string {
  return String(Number(value.toFixed(4)));
}

/** An amount in reais as an English answer writes it. */
function shownMoney(value: number): string {
  return formatMathAnswer({ language: "en", unit: "R$", value });
}

/** The price and the discount the question shows, and what the learner pays. */
function readNumbers(question: string) {
  const [price = 0, discount = 0] = (question.match(/\d+(?:\.\d+)?/gu) ?? []).map(Number);
  return { discount, paid: price * (1 - discount / 100), price, saved: (price * discount) / 100 };
}

describe("math problems in a block", () => {
  it("shows the same numbers on every visit to a block and new ones in other blocks", () => {
    const item = parseMath();
    const first = toSessionQuestion({ blockId, item });

    const others = ["b1", "b2", "b3"].map(
      (otherBlockId) => toSessionQuestion({ blockId: otherBlockId, item }).question,
    );

    expect(toSessionQuestion({ blockId, item })).toStrictEqual(first);
    expect(others.some((question) => question !== first.question)).toBe(true);
    expect(first.question).toMatch(/^A shirt costs \d+ and is \d+% off\./u);
    expect(first.unit).toStrictEqual({ position: "prefix", symbol: "R$" });
  });

  it("grades against the block's numbers with the worked steps", () => {
    const item = parseMath();

    const { discount, paid, price, saved } = readNumbers(
      toSessionQuestion({ blockId, item }).question,
    );

    const graded = gradeSessionAnswer({ answer: { number: paid }, blockId, item });

    expect(graded).toMatchObject({
      correctAnswer: { number: paid },
      explanation: null,
      isCorrect: true,
      recorded: { number: paid, values: { discount, price } },
    });

    expect(graded.workedSteps).toStrictEqual([
      `${discount}% of ${price} is ${shown(saved)}.`,
      `Subtract it: you pay ${shown(paid)}.`,
    ]);
  });

  it("explains the common mistake a wrong number matches", () => {
    const item = parseMath();
    const { paid, saved } = readNumbers(toSessionQuestion({ blockId, item }).question);
    const graded = gradeSessionAnswer({ answer: { number: saved }, blockId, item });

    expect(graded).toMatchObject({
      explanation: "That's how much you save, not what you pay.",
      isCorrect: false,
      snapshot: {
        answer: shownMoney(saved),
        correctAnswer: shownMoney(paid),
        format: "numeric",
        misconception: "Computes the discount instead of the price paid",
      },
    });

    expect(gradeSessionAnswer({ answer: { selectedIndex: 0 }, blockId, item })).toMatchObject({
      isCorrect: false,
      snapshot: { answer: null },
    });
  });

  it("reads an earlier answer as text only when it had the same numbers", () => {
    const item = parseMath();
    const { discount, paid, price } = readNumbers(toSessionQuestion({ blockId, item }).question);
    const recorded = { number: paid, values: { discount, price } };

    expect(describeEarlierAnswer({ answer: recorded, blockId, item })).toBe(shownMoney(paid));

    expect(
      describeEarlierAnswer({
        answer: { ...recorded, values: { discount, price: price + 10 } },
        blockId,
        item,
      }),
    ).toBeNull();

    expect(readRecordedAnswer(recorded)).toStrictEqual({ number: paid });
    expect(readRecordedAnswer({ selectedIndex: 1 })).toStrictEqual({ selectedIndex: 1 });
    expect(readRecordedAnswer({ number: "12" })).toBeNull();
  });
});
