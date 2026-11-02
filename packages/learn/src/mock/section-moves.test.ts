import { describe, expect, it } from "vitest";
import { getSectionMoves } from "./section-moves";

const navigation = { answerChanges: null, forwardOnly: true, itemSeconds: 3, mustAnswer: true };

function moves(answered: boolean) {
  const input = {
    answered,
    changed: [],
    changesLeft: null,
    navigation,
    position: 0,
    reached: 0,
    total: 3,
  };

  return getSectionMoves(input);
}

describe("mandatory mock answers", () => {
  it("keeps a blank question open and blocks the next question", () => {
    expect(moves(false).canOpen(0)).toBe(true);
    expect(moves(false).canOpen(1)).toBe(false);
  });

  it("opens the next question after an answer, but never skips ahead", () => {
    expect(moves(true).canOpen(1)).toBe(true);
    expect(moves(true).canOpen(2)).toBe(false);
  });

  it("also requires an answer when the section moves freely", () => {
    const input = {
      answered: false,
      changed: [],
      changesLeft: null,
      navigation: { ...navigation, forwardOnly: false },
      position: 1,
      reached: 1,
      total: 3,
    };

    const result = getSectionMoves(input);
    expect(result.canOpen(1)).toBe(true);
    expect(result.canOpen(0)).toBe(false);
    expect(result.canOpen(2)).toBe(false);
  });

  it("a clock timeout may advance past a blank, but only to the immediate next question", () => {
    const result = moves(false);
    expect(result.canOpenAfterTimeout(1)).toBe(true);
    expect(result.canOpenAfterTimeout(0)).toBe(false);
    expect(result.canOpenAfterTimeout(2)).toBe(false);
  });

  it("navigation never opens a question outside the section", () => {
    expect(moves(true).canOpen(-1)).toBe(false);
    expect(moves(true).canOpen(3)).toBe(false);
  });
});

describe("reviewing timed-out mandatory questions", () => {
  it("can leave a previously timed-out blank even when no review changes remain", () => {
    const result = getSectionMoves({
      answered: false,
      changed: [],
      changesLeft: 0,
      navigation: { ...navigation, answerChanges: 1 },
      position: 0,
      reached: 4,
      total: 5,
    });

    expect(result.canChange(0)).toBe(false);
    expect(result.canAdvance).toBe(true);
    expect(result.canOpen(1)).toBe(true);
    expect(result.canOpen(4)).toBe(true);
  });

  it("still requires an answer to the current last question", () => {
    const result = getSectionMoves({
      answered: false,
      changed: [],
      changesLeft: 1,
      navigation: { ...navigation, answerChanges: 1 },
      position: 4,
      reached: 4,
      total: 5,
    });

    expect(result.canAdvance).toBe(false);
    expect(result.canOpen(3)).toBe(false);
  });
});
