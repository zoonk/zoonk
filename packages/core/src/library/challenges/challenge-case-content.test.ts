import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { describe, expect, it } from "vitest";
import { type PlotVisual, safeParseStepContent } from "../steps/contract/step-contract";
import { checkWrittenChallenge } from "./challenge-case-content";

type WrittenCase = ReturnType<typeof writtenChallengeCaseFixture>;

function withStrongestFirst(written: WrittenCase): WrittenCase {
  return {
    ...written,
    nodes: written.nodes.map((node) => ({
      ...node,
      choices: node.choices.toSorted((first, second) =>
        first.quality === "strong" ? -1 : Number(second.quality === "strong"),
      ),
    })),
  };
}

function choiceIdsByNode(written: WrittenCase): string[][] {
  const { content } = checkWrittenChallenge({ variant: "work", written });
  return content?.nodes.map((node) => node.choices.map((choice) => choice.id)) ?? [];
}

describe(checkWrittenChallenge, () => {
  it("round-trips a decision's plot and leaves other decisions without a visual", () => {
    const written = writtenChallengeCaseFixture();

    const visual: PlotVisual = {
      kind: "plot",
      references: [{ label: "Limit", y: 12 }],
      series: [
        {
          mark: "lineWithPoints",
          name: "Line A",
          points: [
            { label: null, x: 1, y: 8 },
            { label: "Peak", x: 6, y: 11 },
          ],
        },
      ],
      source: null,
      title: "Pressure over time",
      xLabel: "Time",
      xUnit: "s",
      yLabel: "Pressure",
      yUnit: "kPa",
    };

    const { content } = checkWrittenChallenge({
      variant: "work",
      written: {
        ...written,
        nodes: written.nodes.map((node) =>
          node.id === written.startNodeId ? { ...node, visual } : node,
        ),
      },
    });

    const payload = JSON.stringify(content);
    const restored = safeParseStepContent("challenge", JSON.parse(payload));

    expect(restored.success && restored.data.nodes.map((node) => node.visual)).toStrictEqual(
      written.nodes.map((node) => (node.id === written.startNodeId ? visual : undefined)),
    );
  });

  it("doesn't keep the strongest choice first in every decision", () => {
    const written = withStrongestFirst(writtenChallengeCaseFixture());
    const { content } = checkWrittenChallenge({ variant: "work", written });

    expect(written.nodes.every((node) => node.choices[0]?.quality === "strong")).toBe(true);

    const firstQualities = content?.nodes.map((node) => node.choices[0]?.quality) ?? [];

    expect(firstQualities.length).toBeGreaterThan(1);
    expect(firstQualities.every((quality) => quality === "strong")).toBe(false);
  });

  it("keeps a case whose lists run past their targets", () => {
    const written = writtenChallengeCaseFixture();
    const [firstNode, ...otherNodes] = written.nodes;
    const [firstChoice] = firstNode?.choices ?? [];

    if (!firstNode || !firstChoice) {
      throw new Error("The fixture needs a decision with a choice");
    }

    const colleagues = Array.from({ length: 5 }, (_, index) => ({
      ai: false,
      expertise: "Knows the numbers",
      id: `colleague-${index}`,
      role: "Analyst",
    }));

    const extraChoices = Array.from({ length: 3 }, (_, index) => ({
      ...firstChoice,
      id: `extra-${index}`,
      quality: "weak" as const,
    }));

    const long: WrittenCase = {
      ...written,
      nodes: [{ ...firstNode, choices: [...firstNode.choices, ...extraChoices] }, ...otherNodes],
      team: [...written.team, ...colleagues],
    };

    expect(checkWrittenChallenge({ variant: "work", written: long }).problems).toStrictEqual([]);
  });

  it("keeps every choice and the same order on every check", () => {
    const written = writtenChallengeCaseFixture();
    const ids = choiceIdsByNode(written);

    expect(ids).toStrictEqual(choiceIdsByNode(written));

    expect(ids.map((choices) => choices.toSorted())).toStrictEqual(
      written.nodes.map((node) => node.choices.map((choice) => choice.id).toSorted()),
    );
  });

  it("rejects a metric drawn over several lines, on an opening or a later panel", () => {
    const written = writtenChallengeCaseFixture();
    const [panel] = written.panels;
    const jumped = written.nodes.flatMap((node) => node.choices).find((choice) => choice.timeJump);

    if (!panel || !jumped?.timeJump?.panel) {
      throw new Error("The fixture needs an opening panel and a time jump with a panel");
    }

    const plot = {
      label: "Dose vs. response",
      note: null,
      value: "y |   *\n  | *   *\n  +------ x",
    };

    const table = { label: "Week\nSales", note: null, value: "120" };

    const drawn: WrittenCase = {
      ...written,
      nodes: written.nodes.map((node) => ({
        ...node,
        choices: node.choices.map((choice) =>
          choice === jumped && choice.timeJump?.panel
            ? {
                ...choice,
                timeJump: {
                  ...choice.timeJump,
                  panel: { ...choice.timeJump.panel, metrics: [table] },
                },
              }
            : choice,
        ),
      })),
      panels: [{ ...panel, metrics: [plot] }],
    };

    const checked = checkWrittenChallenge({ variant: "work", written: drawn });

    expect(checked.content).toBeNull();

    expect(checked.problems).toStrictEqual([
      expect.stringContaining('"Dose vs. response" runs over several lines'),
      expect.stringContaining('"Week\nSales" runs over several lines'),
    ]);
  });
});
