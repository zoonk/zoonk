import { describe, expect, it } from "vitest";
import { promptCacheMiddleware } from "./prompt-cache";

const CACHED = { anthropic: { cacheControl: { type: "ephemeral" } } };
const OPENAI_BREAKPOINT = { openai: { promptCacheBreakpoint: { mode: "explicit" } } };
const ANTHROPIC_MODEL = "anthropic/claude-sonnet-5.5";
const OPENAI_MODEL = "openai/gpt-6-sol";

const userMessage = {
  content: [{ text: "Photosynthesis", type: "text" as const }],
  role: "user" as const,
};

type TransformParams = NonNullable<typeof promptCacheMiddleware.transformParams>;
type CallParams = Parameters<TransformParams>[0]["params"];

async function transformCall({
  modelId = ANTHROPIC_MODEL,
  prompt,
  providerOptions,
}: {
  modelId?: string;
  prompt: CallParams["prompt"];
  providerOptions?: CallParams["providerOptions"];
}) {
  return promptCacheMiddleware.transformParams?.({
    model: { modelId } as Parameters<TransformParams>[0]["model"],
    params: { prompt, providerOptions } as CallParams,
    type: "generate",
  });
}

async function transform(prompt: CallParams["prompt"], modelId = ANTHROPIC_MODEL) {
  const params = await transformCall({ modelId, prompt });
  return params?.prompt;
}

describe("the system prompt cache middleware", () => {
  it("marks the end of the system prompt and leaves the per-call text unmarked", async () => {
    await expect(
      transform([{ content: "You write short lessons.", role: "system" }, userMessage]),
    ).resolves.toStrictEqual([
      { content: "You write short lessons.", providerOptions: CACHED, role: "system" },
      userMessage,
    ]);
  });

  it("marks only the last of several leading system messages, keeping their own options", async () => {
    const marked = await transform([
      { content: "Rules", role: "system" },
      { content: "Examples", providerOptions: { openai: { store: false } }, role: "system" },
      userMessage,
      { content: "A system note mid-conversation", role: "system" },
    ]);

    expect(marked?.[0]).toStrictEqual({ content: "Rules", role: "system" });

    expect(marked?.[1]).toStrictEqual({
      content: "Examples",
      providerOptions: { openai: { store: false }, ...CACHED },
      role: "system",
    });

    expect(marked?.[3]).toStrictEqual({
      content: "A system note mid-conversation",
      role: "system",
    });
  });

  it("leaves a prompt without a system prompt as it is", async () => {
    await expect(transform([userMessage])).resolves.toStrictEqual([userMessage]);
  });

  it("leaves a Google model's prompt unmarked, since a marker turns its implicit cache off", async () => {
    const prompt: CallParams["prompt"] = [
      { content: "You write short lessons.", role: "system" },
      userMessage,
    ];

    await expect(transform(prompt, "google/gemini-3.8-flash")).resolves.toStrictEqual(prompt);
  });

  it("caches only an OpenAI model's system prompt, so per-call text skips the cache write's premium", async () => {
    const params = await transformCall({
      modelId: OPENAI_MODEL,
      prompt: [{ content: "You write short lessons.", role: "system" }, userMessage],
      providerOptions: { gateway: { models: [] }, openai: { store: false } },
    });

    expect(params?.prompt).toStrictEqual([
      { content: "You write short lessons.", providerOptions: OPENAI_BREAKPOINT, role: "system" },
      userMessage,
    ]);

    expect(params?.providerOptions).toStrictEqual({
      gateway: { models: [] },
      openai: { promptCacheOptions: { mode: "explicit" }, store: false },
    });
  });

  it("keeps the cache points an OpenAI conversation marks itself", async () => {
    const prompt: CallParams["prompt"] = [
      { content: "You are a study buddy.", role: "system" },
      { content: [{ providerOptions: OPENAI_BREAKPOINT, text: "Hi", type: "text" }], role: "user" },
    ];

    await expect(transformCall({ modelId: OPENAI_MODEL, prompt })).resolves.toStrictEqual({
      prompt,
      providerOptions: undefined,
    });
  });
});
