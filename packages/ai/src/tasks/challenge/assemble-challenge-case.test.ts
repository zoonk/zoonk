import { describe, expect, it } from "vitest";
import { assembleChallengeCase, draftEmptyScript } from "./assemble-challenge-case";
import { challengePlanFixture } from "./challenge-plan-fixture";

describe(assembleChallengeCase, () => {
  it("joins the script to the plan by id and keeps the plan's graph", () => {
    const plan = challengePlanFixture();
    const script = draftEmptyScript(plan);

    const reordered = {
      ...script,
      decisions: script.decisions
        .toReversed()
        .map((decision) => ({ ...decision, choices: decision.choices.toReversed() })),
    };

    const { missing, written } = assembleChallengeCase({ plan, script: reordered });

    expect(missing).toStrictEqual([]);
    expect(written.startNodeId).toBe("start");

    expect(
      written.nodes.map((node) => [
        node.id,
        node.choices.map((choice) => [choice.id, choice.quality, choice.next]),
      ]),
    ).toStrictEqual([
      [
        "start",
        [
          ["check", "strong", "report"],
          ["skip", "weak", "report"],
        ],
      ],
      [
        "report",
        [
          ["plain", "strong", "sent"],
          ["short", "fair", "unclear"],
        ],
      ],
    ]);
  });

  it("gives a time jump only to the choices the plan lets time pass on", () => {
    const plan = challengePlanFixture();
    const script = draftEmptyScript(plan);

    const panel = {
      metrics: [{ label: "Result", note: null, value: "p = 0.21" }],
      note: null,
      title: null,
    };

    const { written } = assembleChallengeCase({
      plan,
      script: {
        ...script,
        decisions: script.decisions.map((decision) => ({
          ...decision,
          choices: decision.choices.map((choice) => ({ ...choice, panel })),
        })),
      },
    });

    const jumps = written.nodes.flatMap((node) =>
      node.choices.map((choice) => [choice.id, choice.timeJump]),
    );

    expect(jumps).toStrictEqual([
      ["check", { label: "One hour later", panel }],
      ["skip", null],
      ["plain", null],
      ["short", null],
    ]);
  });

  it("reports what the script left out and drops what the plan doesn't have", () => {
    const plan = challengePlanFixture();
    const script = draftEmptyScript(plan);
    const [first] = script.decisions;

    if (!first) {
      throw new Error("The fixture needs a decision");
    }

    const { missing, written } = assembleChallengeCase({
      plan,
      script: {
        ...script,
        decisions: [
          {
            ...first,
            choices: first.choices
              .filter((choice) => choice.id !== "skip")
              .map((choice) => ({
                ...choice,
                effects: [
                  { change: -10, meter: "risk" },
                  { change: 5, meter: "budget" },
                ],
              })),
          },
        ],
        endings: script.endings.filter((ending) => ending.id !== "unclear"),
      },
    });

    expect(missing).toStrictEqual(['choice "start.skip"', 'decision "report"', 'ending "unclear"']);
    expect(written.nodes[0]?.choices[0]?.effects).toStrictEqual([{ change: -10, meter: "risk" }]);
  });
});
