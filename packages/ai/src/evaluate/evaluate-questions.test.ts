import { experimental_decide } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateQuestions } from "./evaluate-questions";
import { EvaluationTimeoutError } from "./evaluation-timeout";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

// Model calls are external: each test says how the provider answers.
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

/** The deadline is a platform timer: this one has run out, as a busy provider makes it. */
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

  it("keeps any other failure as the provider reported it", async () => {
    const refused = new Error("The provider refused the request");
    vi.mocked(experimental_decide).mockRejectedValue(refused);

    await expect(evaluateQuestions(evaluation)).rejects.toBe(refused);
  });
});
