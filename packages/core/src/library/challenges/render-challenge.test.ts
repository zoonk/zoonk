import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { challengePlotFixture } from "@zoonk/testing/fixtures/challenge-written-case";
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
        '  X tick labels (at most these): "10" "12" "14" "16" "18" "20"',
        '  Y tick labels: "25" "30" "35" "40"',
        '  Series "Scan A" (lineWithPoints): (10, 27), "Valley" (11, 25), (20, 30)',
        '  Horizontal reference "Control limit": y = 40',
        "  Only the ticks, labels and marks are visible to the learner.",
        "  Prompt:",
      ].join("\n"),
    );
  });

  it("prints the tick labels a learner reads, so ticks that differ never read the same", () => {
    const base = challengeCaseFixture();

    const visual = {
      ...challengePlotFixture(),
      references: [],
      series: [
        {
          mark: "points" as const,
          name: "Visitors",
          points: [10_000, 10_150, 10_400].map((value) => ({ label: null, x: 1, y: value })),
        },
      ],
    };

    const rendered = renderChallengeMap({
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, visual })),
      summary: [],
    });

    expect(rendered.text).toContain('Y tick labels: "10K" "10.1K" "10.2K" "10.3K" "10.4K"');
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

    expect(rendered.text).toContain("Value axis: Fill rate (%)");
    expect(rendered.text).toContain('Value tick labels (at most these): "9" "10" "11"');
    expect(rendered.text).toContain("Value labels when they fit: 9, 11");
  });

  it("keeps a category chart's currency on each number and the rest of its unit in the title", () => {
    const base = challengeCaseFixture();

    const rendered = renderChallengeMap({
      ...base,
      nodes: base.nodes.map((node) => ({
        ...node,
        visual: {
          axisStart: 0,
          categories: ["Before", "After"],
          categoryLabel: "Plan",
          chart: "bar",
          kind: "chart",
          series: [{ name: "Pay", values: [12.5, 20] }],
          source: null,
          title: "Hourly pay",
          unit: "R$ per hour",
          valueLabel: "Pay",
        },
      })),
      summary: [],
    });

    expect(rendered.text).toContain("Value axis: Pay (per hour)");
    expect(rendered.text).toContain('"R$20"');
    expect(rendered.text).toContain("Value labels when they fit: R$12.50, R$20");
  });

  it("prints a category chart's tick labels the way a learner's screen does", () => {
    const base = challengeCaseFixture();

    const rendered = renderChallengeMap({
      ...base,
      nodes: base.nodes.map((node) => ({
        ...node,
        visual: {
          axisStart: 10_000,
          categories: ["May", "June", "July"],
          categoryLabel: "Month",
          chart: "line",
          kind: "chart",
          series: [{ name: "Visitors", values: [10_050, 10_200, 10_380] }],
          source: null,
          title: "Visitors",
          unit: null,
          valueLabel: "Visitors",
        },
      })),
      summary: [],
    });

    expect(rendered.text).toContain(
      'Value tick labels (at most these): "10K" "10.1K" "10.2K" "10.3K" "10.4K"',
    );
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
