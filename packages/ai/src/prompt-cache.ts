import { type LanguageModelMiddleware } from "ai";

type TransformParams = NonNullable<LanguageModelMiddleware["transformParams"]>;
type CallParams = Parameters<TransformParams>[0]["params"];
type CallPrompt = CallParams["prompt"];
type ProviderOptions = NonNullable<CallParams["providerOptions"]>;

/** Anthropic caches a prompt only up to a marked block, and keeps it for five minutes. */
const ANTHROPIC_MARKER = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

/**
 * OpenAI's implicit cache writes up to the latest message at a premium, so one-off calls paid for
 * per-call text nobody reads again. In explicit mode only the marked system prompt is written.
 */
const OPENAI_BREAKPOINT = { openai: { promptCacheBreakpoint: { mode: "explicit" } } } as const;
const OPENAI_EXPLICIT_MODE = { mode: "explicit" } as const;

/**
 * Through the AI Gateway, a Google call whose system prompt carries the Anthropic marker reads
 * nothing from Google's implicit cache (7 Oct 2026).
 */
function getMarker(modelId: string): typeof ANTHROPIC_MARKER | typeof OPENAI_BREAKPOINT | null {
  if (modelId.startsWith("anthropic/")) {
    return ANTHROPIC_MARKER;
  }

  return modelId.startsWith("openai/") ? OPENAI_BREAKPOINT : null;
}

function findLastSystemMessage(prompt: CallPrompt): number {
  const leading = prompt.findIndex((message) => message.role !== "system");
  return (leading === -1 ? prompt.length : leading) - 1;
}

function hasOpenAiBreakpoint(options: ProviderOptions | undefined): boolean {
  return options?.openai?.promptCacheBreakpoint !== undefined;
}

/**
 * A conversation that marks its own cache points keeps OpenAI's implicit mode, which also caches
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
 * Only the leading system messages are marked: a marker on the per-call text after them would pay
 * the cache write's premium on text that's never read again.
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
