import { type WrittenItemSet } from "@zoonk/ai/tasks/items/write-set";
import { challengePlotFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { describe, expect, it } from "vitest";
import { writtenItemSet } from "./_test-utils/generated-items";
import { checkWrittenItemSet, repairWrittenItemSet } from "./item-set-checks";

const CHART = {
  axisStart: null,
  categories: ["2024", "2025"],
  categoryLabel: "Year",
  chart: "bar" as const,
  kind: "chart" as const,
  series: [{ name: "Main branch", values: [300, 400] }],
  source: null,
  title: "Library visits",
  unit: null,
  valueLabel: "Visits",
};

function checkVisualEvidence(visual: WrittenItemSet["visual"], evidence: string[]) {
  const set = writtenItemSet({ kind: "chart", text: "", visual });
  const [first] = set.questions;

  return checkWrittenItemSet({
    set: { ...set, questions: evidence.map((quote) => ({ ...first!, evidence: quote })) },
    skillCount: 2,
  });
}

describe(repairWrittenItemSet, () => {
  it("takes em dashes out of the stimulus and calls a set with a chart a chart set", () => {
    const repaired = repairWrittenItemSet(
      writtenItemSet({
        text: "Visits rose — mostly families.",
        title: "Sundays — a test",
        visual: CHART,
      }),
    );

    expect(repaired).toMatchObject({
      kind: "chart",
      text: "Visits rose, mostly families.",
      title: "Sundays, a test",
    });
  });

  it("repairs each question's evidence as it repairs the stimulus, so a faithful quote still matches", () => {
    const set = writtenItemSet();
    const [first, second, third] = set.questions;

    const repaired = repairWrittenItemSet({
      ...set,
      questions: [
        { ...first!, evidence: "The town has 10^3 readers — most of them families." },
        { ...second!, evidence: "10^3 readers" },
        third!,
      ],
      text: `${set.text} The town has 10^3 readers — most of them families.`,
    });

    expect(repaired.questions.map((question) => question.evidence)).toStrictEqual([
      "The town has $10^{3}$ readers, most of them families.",
      "$10^{3}$ readers",
      third!.evidence,
    ]);

    expect(checkWrittenItemSet({ set: repaired, skillCount: 2 })).toStrictEqual({
      questions: [[], [], []],
      set: [],
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

  it("uses the labels a one-series plot actually shows as evidence", () => {
    const check = checkVisualEvidence(challengePlotFixture(), [
      "Valley",
      "Control limit",
      "Time",
      "Pressure",
      "Pressure over time",
      "Scan A",
      "An unmarked peak",
    ]);

    expect(check).toStrictEqual({
      questions: [
        [],
        [],
        [],
        [],
        [],
        ["Its evidence isn't in the stimulus."],
        ["Its evidence isn't in the stimulus."],
      ],
      set: [],
    });
  });

  it("uses the labels a one-series category chart actually shows as evidence", () => {
    const check = checkVisualEvidence(CHART, [
      "2025",
      "Year",
      "Visits",
      "Library visits",
      "Main branch",
      "2025, Main branch",
    ]);

    expect(check).toStrictEqual({
      questions: [
        [],
        [],
        [],
        [],
        ["Its evidence isn't in the stimulus."],
        ["Its evidence isn't in the stimulus."],
      ],
      set: [],
    });
  });

  it("uses series names when both series appear in the legend", () => {
    const plot = challengePlotFixture();
    const [firstChartSeries] = CHART.series;

    const twoSeriesPlot = {
      ...plot,
      series: [
        ...plot.series,
        { mark: "points" as const, name: "Scan B", points: [{ label: null, x: 10, y: 30 }] },
      ],
    };

    const twoSeriesChart = {
      ...CHART,
      series: [...CHART.series, { ...firstChartSeries!, name: "West branch" }],
    };

    expect(checkVisualEvidence(twoSeriesPlot, ["Scan A", "Scan B"])).toStrictEqual({
      questions: [[], []],
      set: [],
    });

    expect(
      checkVisualEvidence(twoSeriesChart, ["Main branch", "West branch", "2025, Main branch"]),
    ).toStrictEqual({ questions: [[], [], []], set: [] });
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
