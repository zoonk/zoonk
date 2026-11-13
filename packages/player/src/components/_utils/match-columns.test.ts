import { describe, expect, it } from "vitest";
import {
  buildLeftMatchItems,
  buildMatchAttempt,
  buildRightMatchItems,
  getActiveKeyboardSide,
  getEntryState,
  getPairIndex,
} from "./match-columns";

const left = buildLeftMatchItems([
  { left: "2", right: "two" },
  { left: "2", right: "dos" },
  { left: "3", right: "three" },
]);

const right = buildRightMatchItems(["dos", "three", "two"]);

describe("match columns", () => {
  it("records a pair in left-right order whichever column was tapped first", () => {
    const [firstTwo] = left;
    const [dos] = right;

    expect(buildMatchAttempt({ current: firstTwo!, selected: dos! })).toStrictEqual({
      leftId: "left:0",
      pair: { left: "2", right: "dos" },
      rightId: "right:0",
    });

    expect(buildMatchAttempt({ current: dos!, selected: firstTwo! })).toStrictEqual({
      leftId: "left:0",
      pair: { left: "2", right: "dos" },
      rightId: "right:0",
    });
  });

  it("locks only the buttons matched, not every button with the same label", () => {
    const [firstTwo, secondTwo, three] = left;
    const two = right[2];
    const matched = buildMatchAttempt({ current: firstTwo!, selected: two! });

    const states = [firstTwo, secondTwo, three, two].map((item) =>
      getEntryState({
        correctMatches: [matched],
        flashingMatch: null,
        item: item!,
        selected: three!,
      }),
    );

    expect(states).toStrictEqual(["right", "idle", "selected", "right"]);
  });

  it("numbers both sides of a pair by its left entry's place", () => {
    const [firstTwo, secondTwo] = left;
    const [dos, three] = right;
    const matched = buildMatchAttempt({ current: secondTwo!, selected: dos! });

    const pairs = [firstTwo, secondTwo, dos, three].map((item) =>
      getPairIndex({ correctMatches: [matched], item: item!, leftItems: left }),
    );

    expect(pairs).toStrictEqual([undefined, 1, 1, undefined]);
  });

  it("flashes only the two buttons of a wrong pair", () => {
    const [firstTwo, secondTwo] = left;
    const [dos, three] = right;
    const wrong = buildMatchAttempt({ current: secondTwo!, selected: three! });

    const states = [firstTwo, secondTwo, dos, three].map((item) =>
      getEntryState({ correctMatches: [], flashingMatch: wrong, item: item!, selected: null }),
    );

    expect(states).toStrictEqual(["idle", "wrong", "idle", "wrong"]);
  });

  it("points number keys at the column the next tap belongs to", () => {
    expect(getActiveKeyboardSide(null)).toBe("left");
    expect(getActiveKeyboardSide(left[0]!)).toBe("right");
    expect(getActiveKeyboardSide(right[0]!)).toBe("left");
  });
});
