import { describe, expect, it } from "vitest";
import { rewriteStep } from "./essay-rewrite-step";

function grade(
  overrides: Partial<Parameters<typeof rewriteStep>[0]>,
): Parameters<typeof rewriteStep>[0] {
  return {
    criteria: [
      {
        comment: "",
        example: null,
        id: "c1",
        maxScore: 200,
        name: "Written norm",
        quote: null,
        score: 0,
      },
      { comment: "", example: null, id: "c2", maxScore: 200, name: "Theme", quote: null, score: 0 },
    ],
    enemInterventionElements: null,
    nextStep: null,
    range: { high: 0, low: 0 },
    total: { maxScore: 1000, score: 0 },
    zeroReason: null,
    ...overrides,
  };
}

describe(rewriteStep, () => {
  it("asks for the whole essay when it was too short to grade, though core names a criterion", () => {
    expect(
      rewriteStep(grade({ nextStep: { criterionId: "c2", text: "" }, zeroReason: "tooShort" })),
    ).toStrictEqual({ kind: "tooShort" });
  });

  it("names the criterion to work on next", () => {
    expect(
      rewriteStep(grade({ nextStep: { criterionId: "c1", text: "Check the commas." } })),
    ).toMatchObject({ criterion: { id: "c1" }, kind: "nextStep", text: "Check the commas." });
  });

  it("says every criterion has full marks when there's no next step", () => {
    expect(rewriteStep(grade({}))).toStrictEqual({ kind: "fullMarks" });
  });
});
