import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
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
