import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { challengePlotFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { getPlotAxes } from "@zoonk/utils/plot-scale";
import { describe, expect, it } from "vitest";
import { listChallengePaths, walkChallenge } from "./challenge-graph";
import { renderChallengeMap } from "./render-challenge";

describe("challenge review rendering", () => {
  it("lists every route using the same graph the learner walks", () => {
    const content = challengeCaseFixture();
    const paths = listChallengePaths(content);
    expect(paths.length).toBeGreaterThan(1);

    for (const path of paths) {
      const walk = walkChallenge(
        content,
        path.steps.map((step) => step.choice.id),
      );

      expect(walk).toMatchObject({ ending: { id: path.endingId }, status: "ended" });
    }

    const rendered = renderChallengeMap({ ...content, summary: ["Check the evidence."] });
    expect(rendered.pathCount).toBe(paths.length);
    expect(rendered.text.match(/## Decision /gu)).toHaveLength(content.nodes.length);
    expect(rendered.text).toContain("Check the evidence.");
  });

  it("describes a control chart in the decision where the learner reads it", () => {
    const base = challengeCaseFixture();
    const visual = challengePlotFixture();
    const { x } = getPlotAxes(visual);

    const rendered = renderChallengeMap({
      ...base,
      nodes: base.nodes.map((node) => (node.id === base.startNodeId ? { ...node, visual } : node)),
      summary: [],
    });

    expect(rendered.text).toContain(
      [
        "  Chart: Pressure over time",
        "  X axis: Time (s)",
        "  Y axis: Pressure (kPa)",
        `  X ticks (at most these): ${x.ticks.join(", ")}`,
        "  Y ticks: 25, 30, 35, 40",
        '  Series "Scan A" (lineWithPoints): (10, 27), "Valley" (11, 25), (20, 30)',
        '  Horizontal reference "Control limit": y = 40',
        "  Only the ticks, labels and marks are visible to the learner.",
        "  Prompt:",
      ].join("\n"),
    );
  });

  it("shows which values a category chart can print beside its marks", () => {
    const base = challengeCaseFixture();

    const rendered = renderChallengeMap({
      ...base,
      nodes: base.nodes.map((node) => ({
        ...node,
        visual: {
          axisStart: 9,
          categories: ["Mon", "Tue"],
          categoryLabel: "Day",
          chart: "line",
          kind: "chart",
          series: [{ name: "Fill rate", values: [9, 11] }],
          source: null,
          title: "Daily fill rate",
          unit: "%",
          valueLabel: "Fill rate",
        },
      })),
      summary: [],
    });

    expect(rendered.text).toContain("Value ticks: 9, 10, 11");
    expect(rendered.text).toContain("Value labels when they fit: 9%, 11%");
  });

  it("clamps meters at each choice before applying the next effect", () => {
    const base = challengeCaseFixture();

    const content = {
      ...base,
      meters: [{ goodWhen: "high" as const, id: "evidence", label: "Evidence", start: 90 }],
      nodes: base.nodes.map((node) => ({
        ...node,
        choices: node.choices.map((choice) => ({
          ...choice,
          effects: [{ change: node.id === base.startNodeId ? 50 : -50, meter: "evidence" }],
        })),
      })),
    };

    const rendered = renderChallengeMap({ ...content, summary: [] });
    expect(rendered.text).toContain("evidence 50");
    expect(rendered.text).not.toContain("evidence 90");
  });
});
