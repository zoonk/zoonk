import { experimental_decide } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blockTestGatewayFetch } from "../_utils/block-test-gateway-fetch";
import { evaluateQuestions } from "./evaluate-questions";
import { EvaluationTimeoutError } from "./evaluation-timeout";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  experimental_decide: vi.fn(),
}));

const evaluation = {
  fallbackModel: "openai/gpt-6-luna",
  input: { REQUEST: "Calculate a percentage" },
  questions: { same: { instructions: "Is it the same skill?", type: "boolean" } },
  task: "library-identity-decision",
} as const;

function expireDeadlines() {
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
    AbortSignal.abort(new DOMException("The operation timed out.", "TimeoutError")),
  );
}

describe(evaluateQuestions, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports a deadline that ran out while the model's retries waited as a timeout, after trying the fallback", async () => {
    expireDeadlines();

    // The AI SDK ends a retry's wait with an AbortError when the call's signal aborts.
    vi.mocked(experimental_decide).mockRejectedValue(
      new DOMException("Delay was aborted", "AbortError"),
    );

    const thrown = await evaluateQuestions(evaluation).catch((error: unknown) => error);

    // A workflow step never retries an AbortError; a timeout is retried once the provider recovers.
    expect(thrown).toBeInstanceOf(EvaluationTimeoutError);
    expect(experimental_decide).toHaveBeenCalledTimes(2);
  });

  it("doesn't rerun a call the test kill switch blocked on the fallback, which it blocks too", async () => {
    const blocked = await blockTestGatewayFetch("https://ai-gateway.test").catch(
      (error: unknown) => error,
    );

    vi.mocked(experimental_decide).mockRejectedValue(blocked);

    await expect(evaluateQuestions(evaluation)).rejects.toBe(blocked);
    expect(experimental_decide).toHaveBeenCalledOnce();
  });

  it("keeps any other failure as the provider reported it", async () => {
    const refused = new Error("The provider refused the request");
    vi.mocked(experimental_decide).mockRejectedValue(refused);

    await expect(evaluateQuestions(evaluation)).rejects.toBe(refused);
  });
});
