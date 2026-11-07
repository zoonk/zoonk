import { APICallError, Output, generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { failFilteredAnswer, failUnfinishedAnswer } from "./filtered-answer";

function answer({
  finishReason,
  text,
}: {
  finishReason: "content-filter" | "error" | "length" | "stop";
  text: string;
}) {
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: text ? [{ text, type: "text" }] : [],
      finishReason: { raw: finishReason, unified: finishReason },
      usage: {
        inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
        outputTokens: { reasoning: 0, text: 10, total: 10 },
      },
      warnings: [],
    },
  });

  return failUnfinishedAnswer(
    generateText({
      model,
      output: Output.object({ schema: z.object({ releases: z.array(z.string()) }) }),
      prompt: "Read the releases.",
    }),
  );
}

describe(failUnfinishedAnswer, () => {
  it.each(["stop", "content-filter", "length"] as const)(
    "keeps output the schema can't accept after a %s finish as the failure no retry fixes",
    async (finishReason) => {
      await expect(answer({ finishReason, text: '{"releases": 1}' })).rejects.toMatchObject({
        finishReason,
        name: "AI_NoObjectGeneratedError",
      });
    },
  );

  it("fails an answer the provider cut off as an ordinary error, which a retry can fix", async () => {
    const failed = answer({ finishReason: "error", text: '{"releases":' });

    await expect(failed).rejects.toMatchObject({ name: "Error" });
    await expect(failed).rejects.not.toHaveProperty("cause");
  });

  it("fails an answer the provider failed as an ordinary error, even when its output passes", async () => {
    const failed = answer({ finishReason: "error", text: '{"releases": []}' });

    await expect(failed).rejects.toMatchObject({ name: "Error" });
    await expect(failed).rejects.not.toHaveProperty("cause");
  });

  it("leaves any other failure as it is", async () => {
    const outage = new APICallError({
      message: "Gateway timeout",
      requestBodyValues: {},
      url: "https://gateway.test",
    });

    await expect(failUnfinishedAnswer(Promise.reject(outage))).rejects.toBe(outage);
  });

  it("keeps an answer that passes", async () => {
    await expect(
      answer({ finishReason: "stop", text: '{"releases": ["1.0"]}' }),
    ).resolves.toMatchObject({ output: { releases: ["1.0"] } });
  });
});

describe(failFilteredAnswer, () => {
  it.each(["content-filter", "length"] as const)(
    "fails an empty answer that ended for %s as the failure no retry fixes",
    async (finishReason) => {
      const result = await answer({ finishReason, text: "" });

      expect(() => failFilteredAnswer(result)).toThrow(
        expect.objectContaining({ finishReason, name: "AI_NoObjectGeneratedError" }),
      );
    },
  );
});
