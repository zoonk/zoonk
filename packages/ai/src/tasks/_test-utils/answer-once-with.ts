import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { vi } from "vitest";

/** The test file mocks `ai`'s `generateText` with `vi.fn()`. */
async function generateOnceWith({
  content,
  finishReason,
}: {
  content: { text: string; type: "text" }[];
  finishReason: "content-filter" | "error" | "stop";
}): Promise<void> {
  const model = new MockLanguageModelV4({
    doGenerate: {
      content,
      finishReason: { raw: finishReason, unified: finishReason },
      usage: {
        inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
        outputTokens: { reasoning: 0, text: 10, total: 10 },
      },
      warnings: [],
    },
  });

  const { generateText: actualGenerateText } = await vi.importActual<{
    generateText: typeof generateText;
  }>("ai");

  vi.mocked(generateText).mockImplementationOnce((options) =>
    actualGenerateText({ ...options, model }),
  );
}

/**
 * Runs the real `generateText`, answer parsing included, once with a model that answers `answer`
 * as text. The test file mocks `ai`'s `generateText` with `vi.fn()`.
 */
export async function answerOnceWith(answer: unknown): Promise<void> {
  await generateOnceWith({
    content: [{ text: JSON.stringify(answer), type: "text" }],
    finishReason: "stop",
  });
}

/** Like `answerOnceWith`, with an answer that has no text and stopped for `finishReason`. */
export async function answerEmptyOnce(finishReason: "content-filter" | "error"): Promise<void> {
  await generateOnceWith({ content: [], finishReason });
}

/** Like `answerOnceWith`, with an answer the provider failed partway through. */
export async function answerCutOffOnce(): Promise<void> {
  await generateOnceWith({ content: [{ text: '{"', type: "text" }], finishReason: "error" });
}
