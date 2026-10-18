import { describe, expect, it } from "vitest";
import { getFormatShares } from "./format-shares";

const count = (value: number) => ({ per: "section" as const, unit: "questions" as const, value });
const percent = (value: number) => ({ per: "section" as const, unit: "percent" as const, value });

describe(getFormatShares, () => {
  it("works out each objective format's share from the questions counted for every format", () => {
    // JEE Advanced Paper 1: four sections of four questions in each subject.
    expect(
      getFormatShares([
        { count: count(4), kind: "multipleChoice" },
        { count: count(4), kind: "multipleChoice" },
        { count: count(4), kind: "numeric" },
        { count: count(4), kind: "multipleChoice" },
      ]),
    ).toStrictEqual([0.25, 0.25, 0.25, 0.25]);

    // JEE Main: 20 multiple-choice and 5 numeric questions in each subject, beside an essay.
    expect(
      getFormatShares([
        { count: { per: "subject", unit: "questions", value: 20 }, kind: "multipleChoice" },
        { count: { per: "subject", unit: "questions", value: 5 }, kind: "numeric" },
        { count: null, kind: "essay" },
      ]),
    ).toStrictEqual([0.8, 0.2, null]);
  });

  it("reads a percent as a share of the questions, even when the percents leave some out", () => {
    expect(
      getFormatShares([
        { count: percent(75), kind: "multipleChoice" },
        { count: percent(25), kind: "numeric" },
      ]),
    ).toStrictEqual([0.75, 0.25]);

    expect(getFormatShares([{ count: percent(75), kind: "multipleChoice" }])).toStrictEqual([0.75]);
  });

  it("gives no share when an objective format has no count or counts differ in part or unit", () => {
    const subject = { per: "subject" as const, unit: "questions" as const, value: 20 };

    expect(
      getFormatShares([
        { count: subject, kind: "multipleChoice" },
        { count: null, kind: "trueFalse" },
      ]),
    ).toStrictEqual([null, null]);

    expect(
      getFormatShares([
        { count: subject, kind: "multipleChoice" },
        { count: { ...subject, per: "paper", value: 5 }, kind: "numeric" },
      ]),
    ).toStrictEqual([null, null]);

    expect(
      getFormatShares([
        { count: subject, kind: "multipleChoice" },
        { count: { ...subject, unit: "percent", value: 25 }, kind: "numeric" },
      ]),
    ).toStrictEqual([null, null]);

    expect(
      getFormatShares([
        { count: subject, kind: "multipleChoice" },
        { count: { ...subject, value: 0 }, kind: "numeric" },
      ]),
    ).toStrictEqual([null, null]);
  });
});
