import { logError } from "@zoonk/utils/logger";
import { StreamProviderError } from "ai";
import { describe, expect, it, vi } from "vitest";
import { answerStreamOptions } from "./answer-stream";

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

describe(answerStreamOptions, () => {
  it("logs what failed without the provider's message", () => {
    const error = new StreamProviderError({
      data: { prompt: "My name is Ana" },
      message: "Overloaded while reading: My name is Ana",
      statusCode: 503,
    });

    answerStreamOptions("goal-tutor").onError({ error });

    expect(logError).toHaveBeenCalledExactlyOnceWith("[AI Answer Stream Error]", {
      code: undefined,
      isRetryable: true,
      name: "AI_StreamProviderError",
      statusCode: 503,
      task: "goal-tutor",
    });
  });
});
