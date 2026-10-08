import { type EvaluationRun, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

/** Logs a shared Jev verdict (a Library reuse decision unless `task` says otherwise). */
export async function evaluationRunFixture(
  attrs: FixtureAttrs<EvaluationRun, "answers" | "input"> = {},
) {
  return prisma.evaluationRun.create({
    data: {
      answers: { reuse: { probability: 0.82, type: "boolean" } },
      contentScope: "shared",
      inputHash: `test-hash-${crypto.randomUUID()}`,
      latencyMs: 180,
      model: "typesafe-ai/jev",
      promptVersion: "test-prompt",
      requestedModel: "typesafe-ai/jev",
      runId: crypto.randomUUID(),
      task: "library-identity-decision",
      ...attrs,
    },
  });
}
