import { streamText } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { vi } from "vitest";

const USAGE = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 10, total: 10 },
};

/** What OpenAI sends when it's overloaded after the response has started. */
const overloaded = {
  stream: convertArrayToReadableStream([
    {
      error: {
        message: "Our servers are currently overloaded. Please try again later.",
        status: 503,
      },
      type: "error" as const,
    },
  ]),
};

function answered(answer: string) {
  return {
    stream: convertArrayToReadableStream([
      { id: "answer", type: "text-start" as const },
      { delta: answer, id: "answer", type: "text-delta" as const },
      { id: "answer", type: "text-end" as const },
      {
        finishReason: { raw: "stop", unified: "stop" as const },
        type: "finish" as const,
        usage: USAGE,
      },
    ]),
  };
}

/**
 * Runs the real `streamText` once with a model whose first stream fails with a 503 after it started
 * and whose next one answers `answer`. The test file mocks `ai`'s `streamText` with `vi.fn()`.
 */
export async function streamOnceAfterOverload(answer: string): Promise<void> {
  const model = new MockLanguageModelV4({ doStream: [overloaded, answered(answer)] });

  const { streamText: actualStreamText } = await vi.importActual<{ streamText: typeof streamText }>(
    "ai",
  );

  vi.mocked(streamText).mockImplementationOnce((options) =>
    actualStreamText({ ...options, model }),
  );
}
