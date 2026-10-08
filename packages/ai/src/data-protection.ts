import { type GatewayProviderOptions } from "@ai-sdk/gateway";
import { type ImageModelMiddleware, type LanguageModelMiddleware } from "ai";

type ProviderOptions = NonNullable<
  Parameters<
    NonNullable<LanguageModelMiddleware["transformParams"]>
  >[0]["params"]["providerOptions"]
>;

/**
 * No learner's data trains a model: the privacy policy says so, and it must hold for every call.
 * Our own OpenAI, Anthropic and Google keys are covered by those providers' API terms, which don't
 * train on API data. The gateway's filter covers the rest: calls billed to the gateway (Jev, the
 * DeepSeek and image fallbacks, the search tools) and any call it retries on its own credentials
 * only reach providers that don't train on prompts, and fail instead of reaching one that might.
 * It is free on every plan and isn't enforced on our own keys
 * (https://vercel.com/docs/ai-gateway/security-and-compliance/disallow-prompt-training).
 */
export const NO_PROMPT_TRAINING = { disallowPromptTraining: true } satisfies GatewayProviderOptions;

/** Adds the gateway's no-training filter to a call's provider options, keeping everything else. */
function withNoPromptTraining(options: ProviderOptions | undefined): ProviderOptions {
  return { ...options, gateway: { ...options?.gateway, ...NO_PROMPT_TRAINING } };
}

/** Every text call through the default provider, whichever task built its options. */
export const noPromptTrainingMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: withNoPromptTraining(params.providerOptions),
  }),
};

/** Every image call through the default provider. */
export const noPromptTrainingImageMiddleware: ImageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: withNoPromptTraining(params.providerOptions),
  }),
};
