import { describe, expect, it } from "vitest";
import {
  buildLeftMatchItems,
  buildMatchAttempt,
  buildRightMatchItems,
  getActiveKeyboardSide,
  getItemVisualState,
} from "./match-columns";

/** Two pairs share the left label "2", as authored content may. */
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
      getItemVisualState({
        correctMatches: [matched],
        flashingMatch: null,
        item: item!,
        selected: three!,
      }),
    );

    expect(states).toStrictEqual(["correct", "idle", "selected", "correct"]);
  });

  it("flashes only the two buttons of a wrong pair", () => {
    const [firstTwo, secondTwo] = left;
    const [dos, three] = right;
    const wrong = buildMatchAttempt({ current: secondTwo!, selected: three! });

    const states = [firstTwo, secondTwo, dos, three].map((item) =>
      getItemVisualState({ correctMatches: [], flashingMatch: wrong, item: item!, selected: null }),
    );

    expect(states).toStrictEqual(["idle", "incorrectFlash", "idle", "incorrectFlash"]);
  });

  it("points number keys at the column the next tap belongs to", () => {
    expect(getActiveKeyboardSide(null)).toBe("left");
    expect(getActiveKeyboardSide(left[0]!)).toBe("right");
    expect(getActiveKeyboardSide(right[0]!)).toBe("left");
  });
});
