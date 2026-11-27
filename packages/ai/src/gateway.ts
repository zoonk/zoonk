import { GatewayInvalidRequestError, createGateway } from "@ai-sdk/gateway";
// By package name, not path, so the API's E2E build can swap the kill switch (its next.config.ts).
import { blockTestGatewayFetch } from "@zoonk/ai/block-test-gateway-fetch";
import { wrapProvider } from "ai";
import { isTestEnvironment } from "./_utils/is-test-environment";
import { NO_AI_SPEND_MESSAGE, isAiSpendDisabled } from "./_utils/no-ai-spend";
import { noPromptTrainingImageMiddleware, noPromptTrainingMiddleware } from "./data-protection";
import { promptCacheMiddleware } from "./prompt-cache";
import { billedCallMiddleware } from "./provenance/billed-calls";

const isTest = isTestEnvironment();
const noAiSpend = isAiSpendDisabled();

function gatewayFetch() {
  if (noAiSpend) {
    return async () => {
      throw new GatewayInvalidRequestError({ message: NO_AI_SPEND_MESSAGE });
    };
  }

  return isTest ? blockTestGatewayFetch : undefined;
}

export const zoonkGateway = createGateway({
  apiKey: isTest || noAiSpend ? "disabled" : undefined,
  fetch: gatewayFetch(),
  headers: { "http-referer": "https://www.zoonk.com", "x-title": "Zoonk" },
});

/**
 * `wrapProvider` takes no speech or transcription middleware, so those calls pass
 * `NO_PROMPT_TRAINING` themselves.
 */
export const zoonkDefaultProvider = wrapProvider({
  imageModelMiddleware: noPromptTrainingImageMiddleware,
  languageModelMiddleware: [
    noPromptTrainingMiddleware,
    promptCacheMiddleware,
    billedCallMiddleware,
  ],
  provider: zoonkGateway,
});
