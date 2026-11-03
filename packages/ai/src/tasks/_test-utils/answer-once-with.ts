import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { vi } from "vitest";

/**
 * Runs the real `generateText`, answer parsing included, once with a model that answers `answer`
 * as text. The test file mocks `ai`'s `generateText` with `vi.fn()`.
 */
export async function answerOnceWith(answer: unknown): Promise<void> {
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [{ text: JSON.stringify(answer), type: "text" }],
      finishReason: { raw: "end_turn", unified: "stop" },
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
