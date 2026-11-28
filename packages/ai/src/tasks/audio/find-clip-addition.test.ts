import { format } from "node:util";
import { NoObjectGeneratedError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findClipAddition } from "./find-clip-addition";

const { checkClipEndingMock, logErrorMock } = vi.hoisted(() => ({
  checkClipEndingMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("./check-clip-ending", () => ({ checkClipEnding: checkClipEndingMock }));

vi.mock("@zoonk/utils/logger", () => ({ logError: logErrorMock }));

const audio = new Uint8Array([1, 2, 3]);

describe(findClipAddition, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkClipEndingMock.mockResolvedValue({ data: { added: "speech", heard: "vivo in ca" } });
  });

  it.each([
    ["an open phrase", "vivo in"],
    ["a phrase trailing off with an ellipsis", "Vivo in…"],
    ["a phrase trailing off with three dots", "Vivo in..."],
    ["an open phrase in quotes", "« vivo in »"],
  ])("checks %s", async (_, text) => {
    await expect(findClipAddition({ audio, language: "it", text })).resolves.toBe("speech");
  });

  it.each([
    ["a sentence", "Vivo in Italia."],
    ["a question", "Hola, ¿qué tal?"],
    ["a sentence in a script with its own full stop", "यह मेरा घर है।"],
    ["a sentence in Japanese quotes", "「ありがとう。」"],
    ["a sentence in French quotes", "« Fin. »"],
    ["a sentence in parentheses", "(Fin.)"],
  ])("never checks %s", async (_, text) => {
    await expect(findClipAddition({ audio, language: "it", text })).resolves.toBeNull();
    expect(checkClipEndingMock).not.toHaveBeenCalled();
  });

  it("keeps the clip when the check's answer can't be read, logging none of it", async () => {
    checkClipEndingMock.mockRejectedValue(
      new NoObjectGeneratedError({
        finishReason: "stop",
        response: { id: "1", modelId: "gemini", timestamp: new Date() },
        text: '{"heard":"vivo in casa mia","added":"uncertain"}',
        usage: {
          inputTokenDetails: {
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
            noCacheTokens: undefined,
          },
          inputTokens: 1,
          outputTokenDetails: { reasoningTokens: undefined, textTokens: undefined },
          outputTokens: 1,
          totalTokens: 2,
        },
      }),
    );

    await expect(findClipAddition({ audio, language: "it", text: "vivo in" })).resolves.toBeNull();

    expect(logErrorMock).toHaveBeenCalledOnce();

    const [args = []] = logErrorMock.mock.calls;

    expect(format(...args)).not.toContain("vivo in");
  });
});
