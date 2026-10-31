import { describe, expect, it } from "vitest";
import { getPickCredit, getPickOutcome } from "./partial-credit";

const THREE_OF_FOUR = { correct: 3, options: 4 };

describe(getPickCredit, () => {
  it("gives a question only to every right option and nothing else, by default", () => {
    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 3, wrong: 0 }, rule: "allOrNothing" }),
    ).toBe(1);

    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 2, wrong: 0 }, rule: "allOrNothing" }),
    ).toBe(0);
  });

  it("gives each right pick its share of the right options while no wrong one is picked", () => {
    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 2, wrong: 0 }, rule: "perRightPick" }),
    ).toBeCloseTo(2 / 3);

    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 2, wrong: 1 }, rule: "perRightPick" }),
    ).toBe(0);
  });

  it("gives each right pick one option's share, and all of them the whole question, as JEE Advanced", () => {
    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 2, wrong: 0 }, rule: "perOption" }),
    ).toBe(0.5);

    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 3, wrong: 0 }, rule: "perOption" }),
    ).toBe(1);

    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 3, wrong: 1 }, rule: "perOption" }),
    ).toBe(0);
  });

  it("takes a share away for each wrong pick, never below nothing", () => {
    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 3, wrong: 1 }, rule: "plusMinus" }),
    ).toBeCloseTo(2 / 3);

    expect(
      getPickCredit({ picks: { ...THREE_OF_FOUR, right: 1, wrong: 1 }, rule: "plusMinus" }),
    ).toBe(0);
  });
});

describe(getPickOutcome, () => {
  it("reads the whole question as right, a share as partly right, nothing as wrong", () => {
    expect(getPickOutcome({ answered: true, credit: 1 })).toBe("right");
    expect(getPickOutcome({ answered: true, credit: 0.5 })).toBe("partial");
    expect(getPickOutcome({ answered: true, credit: 0 })).toBe("wrong");
    expect(getPickOutcome({ answered: false, credit: 0 })).toBe("blank");
  });
});
