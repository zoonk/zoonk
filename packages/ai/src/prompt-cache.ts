import { type LanguageModelMiddleware } from "ai";

type TransformParams = NonNullable<LanguageModelMiddleware["transformParams"]>;
type CallParams = Parameters<TransformParams>[0]["params"];
type CallPrompt = CallParams["prompt"];
type ProviderOptions = NonNullable<CallParams["providerOptions"]>;

/**
 * Anthropic caches a prompt only up to a marked block, and keeps it for five minutes: a cache
 * write costs 1.25x the input price once, then every read 0.05x on Opus 5.5.
 */
const ANTHROPIC_MARKER = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

/**
 * OpenAI (GPT-5.6 and later) caches on its own up to the latest message, and bills that write at
 * 1.25x the input price, so a one-off call paid the premium on its per-call text that no other
 * call reads: lesson specs wrote 67% of their input for 33% read (7 Oct 2026). In explicit mode
 * only the marked system prompt is written, once per 30 minutes; the rest is billed at the plain
 * rate. Through the gateway, a 3,781-token call with a 2,197-token system prompt wrote 1,581 tokens
 * of per-call text every time in implicit mode and none in explicit mode, reading the same 2,197.
 */
const OPENAI_BREAKPOINT = { openai: { promptCacheBreakpoint: { mode: "explicit" } } } as const;
const OPENAI_EXPLICIT_MODE = { mode: "explicit" } as const;

/**
 * Google gets no marker: through the AI Gateway, a Google call whose system prompt carries the
 * Anthropic one reads nothing from Google's implicit cache (the buddy's request read 0 of its
 * 15,443 input tokens with the marker and 12,249 without it, 7 Oct 2026).
 */
function getMarker(modelId: string): typeof ANTHROPIC_MARKER | typeof OPENAI_BREAKPOINT | null {
  if (modelId.startsWith("anthropic/")) {
    return ANTHROPIC_MARKER;
  }

  return modelId.startsWith("openai/") ? OPENAI_BREAKPOINT : null;
}

/** The index of the last of the leading system messages, or -1 when the prompt has none. */
function findLastSystemMessage(prompt: CallPrompt): number {
  const leading = prompt.findIndex((message) => message.role !== "system");
  return (leading === -1 ? prompt.length : leading) - 1;
}

function hasOpenAiBreakpoint(options: ProviderOptions | undefined): boolean {
  return options?.openai?.promptCacheBreakpoint !== undefined;
}

/**
 * A conversation that marks its own cache points (the buddy marks the learner's message, so the
 * next message reads the conversation up to it) keeps OpenAI's implicit mode, which also caches
 * the latest message for the next tool step.
 */
function marksOwnCachePoints(prompt: CallPrompt): boolean {
  return prompt.some(
    (message) =>
      hasOpenAiBreakpoint(message.providerOptions) ||
      (Array.isArray(message.content) &&
        message.content.some((part) => hasOpenAiBreakpoint(part.providerOptions))),
  );
}

/**
 * Marks the end of the leading system messages, the part every call of a task repeats word for
 * word, so the calls a task makes within the cache's lifetime (a goal build's outlines, a
 * session's lesson checks) read it from the cache. Only that stable prefix is marked: a marker on
 * the per-call text after it would pay the cache write's premium on text that's never read again.
 */
function markSystemPrompt({
  marker,
  prompt,
}: {
  marker: ProviderOptions;
  prompt: CallPrompt;
}): CallPrompt {
  const lastSystem = findLastSystemMessage(prompt);

  return prompt.map((message, index) =>
    index === lastSystem
      ? { ...message, providerOptions: { ...message.providerOptions, ...marker } }
      : message,
  );
}

/** OpenAI caches only at marked breakpoints in explicit mode, which the whole call opts into. */
function withExplicitOpenAiCache(options: CallParams["providerOptions"]): ProviderOptions {
  return { ...options, openai: { ...options?.openai, promptCacheOptions: OPENAI_EXPLICIT_MODE } };
}

/**
 * Gives every Anthropic and OpenAI call through the default provider a cacheable system prompt, so
 * each task's prompt is cached without a task opting in. Tasks keep their stable instructions in
 * the system prompt and put what changes per call after it.
 */
export const promptCacheMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ model, params }) => {
    const marker = getMarker(model.modelId);

    if (!marker || findLastSystemMessage(params.prompt) < 0) {
      return params;
    }

    if (marker === ANTHROPIC_MARKER) {
      return { ...params, prompt: markSystemPrompt({ marker, prompt: params.prompt }) };
    }

    if (marksOwnCachePoints(params.prompt)) {
      return params;
    }

    return {
      ...params,
      prompt: markSystemPrompt({ marker, prompt: params.prompt }),
      providerOptions: withExplicitOpenAiCache(params.providerOptions),
    };
  },
};
