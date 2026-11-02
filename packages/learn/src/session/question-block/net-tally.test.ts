import { describe, expect, it } from "vitest";
import { getNetTally } from "./net-tally";

const BLANK = { dontKnow: true } as const;
const TRUE = { isTrue: true } as const;

describe(getNetTally, () => {
  it("counts this visit's blanks as neither right nor wrong", () => {
    const tally = getNetTally({
      answers: {
        first: { answer: TRUE, blank: false, isCorrect: true },
        second: { answer: BLANK, blank: true, isCorrect: false },
        third: { answer: TRUE, blank: false, isCorrect: false },
      },
      questions: ["first", "second", "third", "fourth"].map((itemId) => ({
        answered: null,
        itemId,
      })),
    });

    expect(tally).toStrictEqual({ blank: 1, right: 1, wrong: 1 });
  });

  it("keeps an earlier visit's blanks out of the wrong answers after a reload", () => {
    const tally = getNetTally({
      answers: { third: { answer: TRUE, blank: false, isCorrect: true } },
      questions: [
        { answered: { blank: false, isCorrect: true }, itemId: "first" },
        { answered: { blank: true, isCorrect: false }, itemId: "second" },
        { answered: null, itemId: "third" },
        { answered: { blank: false, isCorrect: false }, itemId: "fourth" },
      ],
    });

    expect(tally).toStrictEqual({ blank: 1, right: 2, wrong: 1 });
  });
});
