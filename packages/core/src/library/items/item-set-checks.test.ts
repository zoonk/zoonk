import { describe, expect, it } from "vitest";
import { writtenItemSet } from "./_test-utils/generated-items";
import { checkWrittenItemSet, repairWrittenItemSet } from "./item-set-checks";

describe(repairWrittenItemSet, () => {
  it("takes em dashes out of the stimulus and calls a set with a chart a chart set", () => {
    const visual = {
      axisStart: null,
      categories: ["2024", "2025"],
      categoryLabel: "Year",
      chart: "bar" as const,
      kind: "chart" as const,
      series: [{ name: "Visits", values: [300, 400] }],
      source: null,
      title: "Library visits",
      unit: null,
      valueLabel: "Visits",
    };

    const repaired = repairWrittenItemSet(
      writtenItemSet({ text: "Visits rose — mostly families.", title: "Sundays — a test", visual }),
    );

    expect(repaired).toMatchObject({
      kind: "chart",
      text: "Visits rose, mostly families.",
      title: "Sundays, a test",
    });
  });
});

describe(checkWrittenItemSet, () => {
  it("passes a set whose questions find their evidence in the passage", () => {
    expect(checkWrittenItemSet({ set: writtenItemSet(), skillCount: 2 })).toStrictEqual({
      questions: [[], [], []],
      set: [],
    });
  });

  it("rejects a question on a skill not asked for, or whose evidence the passage doesn't hold", () => {
    const set = writtenItemSet();
    const [first, second, third] = set.questions;

    const check = checkWrittenItemSet({
      set: {
        ...set,
        questions: [{ ...first!, skill: 3 }, { ...second!, evidence: "Visits doubled." }, third!],
      },
      skillCount: 2,
    });

    expect(check).toStrictEqual({
      questions: [
        ["Tests skill 3, which isn't one of the 2 skills."],
        ["Its evidence isn't in the stimulus."],
        [],
      ],
      set: ["Has 1 askable questions, fewer than 2."],
    });
  });

  it("rejects a stimulus too short to need, or a chart set without its chart", () => {
    expect(
      checkWrittenItemSet({
        set: writtenItemSet({ text: "Visits rose by a third. Weekday visits stayed the same." }),
        skillCount: 2,
      }).set,
    ).toContain("The text has 10 words, fewer than 90.");

    expect(
      checkWrittenItemSet({ set: writtenItemSet({ kind: "chart" }), skillCount: 2 }).set,
    ).toContain("A chart set has no chart.");
  });
});
