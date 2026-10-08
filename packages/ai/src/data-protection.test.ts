import { describe, expect, it } from "vitest";
import { noPromptTrainingImageMiddleware, noPromptTrainingMiddleware } from "./data-protection";

type TextTransform = NonNullable<typeof noPromptTrainingMiddleware.transformParams>;
type TextParams = Parameters<TextTransform>[0]["params"];
type ImageTransform = NonNullable<typeof noPromptTrainingImageMiddleware.transformParams>;
type ImageParams = Parameters<ImageTransform>[0]["params"];

async function transformText(providerOptions?: TextParams["providerOptions"]) {
  const params = await noPromptTrainingMiddleware.transformParams?.({
    model: { modelId: "deepseek/deepseek-v4-flash" } as Parameters<TextTransform>[0]["model"],
    params: { prompt: [], providerOptions } as TextParams,
    type: "generate",
  });

  return params?.providerOptions;
}

describe("the no-training middlewares", () => {
  it("add the gateway's no-training filter to every text call and keep its other options", async () => {
    await expect(
      transformText({
        gateway: { models: ["google/gemini-3.8-flash"], serviceTier: "flex" },
        openai: { store: false },
      }),
    ).resolves.toStrictEqual({
      gateway: {
        disallowPromptTraining: true,
        models: ["google/gemini-3.8-flash"],
        serviceTier: "flex",
      },
      openai: { store: false },
    });
  });

  it("filter a call with no options of its own, and a task can't turn the filter off", async () => {
    await expect(transformText()).resolves.toStrictEqual({
      gateway: { disallowPromptTraining: true },
    });

    await expect(
      transformText({ gateway: { disallowPromptTraining: false } }),
    ).resolves.toStrictEqual({ gateway: { disallowPromptTraining: true } });
  });

  it("filter every image call", async () => {
    const params = await noPromptTrainingImageMiddleware.transformParams?.({
      model: { modelId: "openai/gpt-image-2.5-flare" } as Parameters<ImageTransform>[0]["model"],
      params: {
        prompt: "A volcano",
        providerOptions: { openai: { quality: "low" } },
      } as unknown as ImageParams,
    });

    expect(params?.providerOptions).toStrictEqual({
      gateway: { disallowPromptTraining: true },
      openai: { quality: "low" },
    });
  });
});
