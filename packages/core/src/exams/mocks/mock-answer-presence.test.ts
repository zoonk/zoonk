import { describe, expect, it } from "vitest";
import { isMockAnswerPresent } from "./mock-answer-presence";

describe(isMockAnswerPresent, () => {
  it.each([null, undefined, { text: "" }, { text: " \n\t " }])("leaves %j unanswered", (answer) => {
    expect(isMockAnswerPresent(answer)).toBe(false);
  });

  it.each([
    { text: "  An answer  " },
    { number: 0 },
    { isTrue: false },
    { selectedIndex: 0 },
    { selectedIndexes: [0] },
  ])("counts %j as answered", (answer) => {
    expect(isMockAnswerPresent(answer)).toBe(true);
  });
});
