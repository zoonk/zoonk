import { AsyncLocalStorage } from "node:async_hooks";
import { type GatewayProviderOptions } from "@ai-sdk/gateway";
import { type ImageModelMiddleware, type LanguageModelMiddleware } from "ai";
import { type AiGenerationContext } from "./provenance/ai-generation-event";

type ProviderOptions = NonNullable<
  Parameters<
    NonNullable<LanguageModelMiddleware["transformParams"]>
  >[0]["params"]["providerOptions"]
>;

/**
 * A learner's data never trains a model: the privacy policy says so. Our own OpenAI, Anthropic and
 * Google keys are covered by those providers' API terms, which don't train on API data. This
 * filter covers the rest of a learner's calls: calls billed to the gateway (Jev, the DeepSeek and
 * image fallbacks, the search tools) and any call it retries on its own credentials only reach
 * providers that don't train on prompts, and fail instead of reaching one that might. Shared
 * Library content goes without it (`allowsPromptTraining`). It is free on every plan and isn't
 * enforced on our own keys
 * (https://vercel.com/docs/ai-gateway/security-and-compliance/disallow-prompt-training).
 */
export const NO_PROMPT_TRAINING = { disallowPromptTraining: true } satisfies GatewayProviderOptions;

export type PromptTrainingInput = {
  /**
   * The task's prompt holds only Library content and public documents, never a learner's words,
   * answers, voice, files or memory.
   */
  libraryInput?: boolean;
};

/**
 * Whether a call may reach providers that can learn from what it sends. Only shared Library
 * content may: Library lessons, their pictures, outlines and item banks hold no one's personal
 * data, so providers may learn from them, and Black Forest Labs and Recraft can draw their
 * pictures when OpenAI's models refuse. That takes a task built from the Library alone
 * (`libraryInput`) run for content every learner shares (`contentScope`). Anything else keeps the
 * filter, including a call that doesn't say its scope: content made for one learner, the buddy,
 * grading, goals in the learner's words and readings of their uploads.
 */
function allowsPromptTraining({
  contentScope,
  libraryInput = false,
}: PromptTrainingInput & { contentScope?: AiGenerationContext["contentScope"] }): boolean {
  return libraryInput && contentScope === "shared";
}

/** The decision of the task run a call belongs to; calls outside a run keep the filter. */
const promptTrainingAllowed = new AsyncLocalStorage<boolean>();

/**
 * Runs a task's model calls under its `allowsPromptTraining` decision, which the middlewares below
 * read. `generate` gets the decision too, for choices it changes, such as an image's fallbacks.
 */
export function runUnderPromptTrainingRule<T>({
  contentScope,
  generate,
  libraryInput,
}: PromptTrainingInput & {
  contentScope?: AiGenerationContext["contentScope"];
  generate: (rule: { promptTraining: boolean }) => Promise<T>;
}): Promise<T> {
  const promptTraining = allowsPromptTraining({ contentScope, libraryInput });

  return promptTrainingAllowed.run(promptTraining, () => generate({ promptTraining }));
}

/** Adds the gateway's no-training filter to a call's options unless its run allows training. */
function withPromptTrainingRule(options: ProviderOptions | undefined): ProviderOptions {
  if (promptTrainingAllowed.getStore() === true) {
    return { ...options };
  }

  return { ...options, gateway: { ...options?.gateway, ...NO_PROMPT_TRAINING } };
}

/** Every text call through the default provider, whichever task built its options. */
export const noPromptTrainingMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: withPromptTrainingRule(params.providerOptions),
  }),
};

/** Every image call through the default provider. */
export const noPromptTrainingImageMiddleware: ImageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: withPromptTrainingRule(params.providerOptions),
  }),
};
