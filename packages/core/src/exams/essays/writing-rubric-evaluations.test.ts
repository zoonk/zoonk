import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { describe, expect, it } from "vitest";
import { passedWritingEvaluations } from "./_utils/writing-rubric-evaluations";

function findOutdatedEvaluations(registry: typeof passedWritingEvaluations) {
  return Object.entries(registry)
    .filter(([, { kind, model, promptRevision }]) => {
      const grader = getWritingGrader(kind);
      return model !== grader.model || promptRevision !== grader.promptVersion;
    })
    .map(([fingerprint]) => fingerprint);
}

describe("passed writing evaluations", () => {
  it("requires a fresh evaluation when the default grader's model or prompt changes", () => {
    expect(findOutdatedEvaluations(passedWritingEvaluations)).toStrictEqual([]);
  });

  it("accepts a current entry and flags changes to either part of the grader identity", () => {
    const kind = "points";
    const grader = getWritingGrader(kind);

    const evaluation = {
      arithmetic: { rounding: null, zeroRules: [] },
      corpus: "fixture",
      kind,
      model: grader.model,
      promptRevision: grader.promptVersion,
    } as const;

    expect(
      findOutdatedEvaluations({
        current: evaluation,
        oldModel: { ...evaluation, model: "old-model" },
        oldPrompt: { ...evaluation, promptRevision: "old-revision" },
      }),
    ).toStrictEqual(["oldModel", "oldPrompt"]);
  });
});
