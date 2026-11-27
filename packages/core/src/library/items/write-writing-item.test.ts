import { describe, expect, it } from "vitest";
import { keyAspects } from "./write-writing-item";

const citation = { passage: "", sourceId: "notice" };

function item(steps: string[] | null) {
  return { criterionId: "q1", description: "Relates the oil shock to the plan", points: 2, steps };
}

describe(keyAspects, () => {
  it("splits a pointed aspect's points evenly across its steps, ending at its points", () => {
    const [aspect] = keyAspects({
      aspects: [item(["Missing", "Mentioned", "Partly treated", "Fully treated"])],
      grading: { criteria: [{ citation, id: "q1", points: 2, text: "Item 1" }] },
    });

    expect(aspect).toStrictEqual({
      awards: [
        { points: 0, text: "Missing" },
        { points: 0.67, text: "Mentioned" },
        { points: 1.33, text: "Partly treated" },
        { points: 2, text: "Fully treated" },
      ],
      criterionId: "q1",
      description: "Relates the oil shock to the plan",
      points: 2,
    });
  });

  it("keeps an aspect without steps whole, and drops points and steps under a board scale", () => {
    const scale = [
      { citation, points: 0, text: "None" },
      { citation, points: 2, text: "Full" },
    ];

    const [whole, scaled] = keyAspects({
      aspects: [item(null), { ...item(["Missing", "Made"]), criterionId: "q2" }],
      grading: {
        criteria: [
          { citation, id: "q1", points: 2, text: "Item 1" },
          { awards: scale, citation, id: "q2", points: 2, text: "Item 2" },
        ],
      },
    });

    expect(whole).toStrictEqual({
      criterionId: "q1",
      description: "Relates the oil shock to the plan",
      points: 2,
    });

    expect(scaled).toMatchObject({ criterionId: "q2", points: null });
    expect(scaled).not.toHaveProperty("awards");
  });
});
