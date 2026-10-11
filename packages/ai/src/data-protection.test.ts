import { describe, expect, it } from "vitest";
import {
  type PromptTrainingInput,
  noPromptTrainingImageMiddleware,
  noPromptTrainingMiddleware,
  runUnderPromptTrainingRule,
} from "./data-protection";

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

async function transformImage() {
  const params = await noPromptTrainingImageMiddleware.transformParams?.({
    model: { modelId: "openai/gpt-image-2.5-flare" } as Parameters<ImageTransform>[0]["model"],
    params: {
      prompt: "A volcano",
      providerOptions: { openai: { quality: "low" } },
    } as unknown as ImageParams,
  });

  return params?.providerOptions;
}

/** The decision a run hands its task, from the call's scope and the task's input. */
function decide(input: PromptTrainingInput & { contentScope?: "personal" | "shared" }) {
  return runUnderPromptTrainingRule({ ...input, generate: async (rule) => rule.promptTraining });
}

describe("the prompt-training rule", () => {
  it("allows training only for a Library task run for shared content", async () => {
    await expect(decide({ contentScope: "shared", libraryInput: true })).resolves.toBe(true);
  });

  it("keeps content made for one learner away from providers that train", async () => {
    await expect(decide({ contentScope: "personal", libraryInput: true })).resolves.toBe(false);
  });

  it("keeps a learner's own input away from them, even when its result is shared", async () => {
    await expect(decide({ contentScope: "shared" })).resolves.toBe(false);
    await expect(decide({ contentScope: "shared", libraryInput: false })).resolves.toBe(false);
  });

  it("keeps a call that doesn't say its scope away from them", async () => {
    await expect(decide({ libraryInput: true })).resolves.toBe(false);
    await expect(decide({})).resolves.toBe(false);
  });
});

describe("the no-training middlewares", () => {
  it("add the gateway's no-training filter to a call outside any run and keep its options", async () => {
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

    await expect(transformImage()).resolves.toStrictEqual({
      gateway: { disallowPromptTraining: true },
      openai: { quality: "low" },
    });
  });

  it("filter a learner's call, and its task can't turn the filter off", async () => {
    const options = await runUnderPromptTrainingRule({
      contentScope: "personal",
      generate: () => transformText({ gateway: { disallowPromptTraining: false } }),
      libraryInput: true,
    });

    expect(options).toStrictEqual({ gateway: { disallowPromptTraining: true } });
  });

  it("leave a shared Library call's options as they are", async () => {
    const [text, image] = await runUnderPromptTrainingRule({
      contentScope: "shared",
      generate: () => Promise.all([transformText({ openai: { store: false } }), transformImage()]),
      libraryInput: true,
    });

    expect(text).toStrictEqual({ openai: { store: false } });
    expect(image).toStrictEqual({ openai: { quality: "low" } });
  });

  it("filter a learner's call that a shared run started, as in a nested task", async () => {
    const options = await runUnderPromptTrainingRule({
      contentScope: "shared",
      generate: () =>
        runUnderPromptTrainingRule({
          contentScope: "personal",
          generate: () => transformText(),
          libraryInput: true,
        }),
      libraryInput: true,
    });

    expect(options).toStrictEqual({ gateway: { disallowPromptTraining: true } });
  });
});
