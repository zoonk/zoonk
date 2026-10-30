import { classifyQuestionGenerality } from "@zoonk/ai/tasks/explain/question-generality";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { readStreamToEnd } from "../_test-utils/read-run-stream";
import { explainQuestionWorkflow } from "./explain-question-workflow";

vi.mock("@zoonk/ai/tasks/explain/question-generality", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  classifyQuestionGenerality: vi.fn(),
}));

describe(explainQuestionWorkflow, () => {
  it("retries a failing step three times, then ends the run's stream with the failure", async () => {
    vi.mocked(classifyQuestionGenerality).mockRejectedValue(new Error("The model is down"));

    const question = `why is the sky blue? ${crypto.randomUUID()}`;
    const user = await userFixture();

    const goal = await goalFixture({
      details: { question },
      kind: "explain",
      prompt: question,
      userId: user.id,
    });

    const run = await start(explainQuestionWorkflow, [{ goalId: goal.id }]);

    await expect(run.returnValue).rejects.toThrow("The model is down");
    expect(classifyQuestionGenerality).toHaveBeenCalledTimes(4);

    const stream = await readStreamToEnd(run);
    const lastEvent = stream?.trim().split("\n\n").at(-1);

    expect(lastEvent).toStrictEqual(expect.stringContaining(`"reason":"aiGenerationFailed"`));
    expect(lastEvent).toStrictEqual(expect.stringContaining(`"step":"${WORKFLOW_ERROR_STEP}"`));
  });
});
