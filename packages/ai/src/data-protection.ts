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
 * The privacy policy promises a learner's data never trains a model. Our own provider keys are
 * covered by their API terms; this filter covers calls billed to the gateway and isn't enforced on
 * our keys (https://vercel.com/docs/ai-gateway/security-and-compliance/disallow-prompt-training).
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
 * Only a task built from the Library alone (`libraryInput`) run for content every learner shares
 * (`contentScope`) may reach providers that train on prompts. Anything else keeps the filter,
 * including a call that doesn't say its scope.
 */
function allowsPromptTraining({
  contentScope,
  libraryInput = false,
}: PromptTrainingInput & { contentScope?: AiGenerationContext["contentScope"] }): boolean {
  return libraryInput && contentScope === "shared";
}

/** Calls outside a run keep the filter. */
const promptTrainingAllowed = new AsyncLocalStorage<boolean>();

/** `generate` gets the decision too, for choices it changes, such as an image's fallbacks. */
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

function withPromptTrainingRule(options: ProviderOptions | undefined): ProviderOptions {
  if (promptTrainingAllowed.getStore() === true) {
    return { ...options };
  }

  return { ...options, gateway: { ...options?.gateway, ...NO_PROMPT_TRAINING } };
}

export const noPromptTrainingMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: withPromptTrainingRule(params.providerOptions),
  }),
};

export const noPromptTrainingImageMiddleware: ImageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: withPromptTrainingRule(params.providerOptions),
  }),
};
