import {
  GatewayInvalidRequestError,
  type GatewayProviderSettings,
  createGateway,
} from "@ai-sdk/gateway";
import { wrapProvider } from "ai";
import { isTestEnvironment } from "./_utils/is-test-environment";
import { noPromptTrainingImageMiddleware, noPromptTrainingMiddleware } from "./data-protection";
import { promptCacheMiddleware } from "./prompt-cache";

const isTest = isTestEnvironment();

/**
 * Tests can exercise real server routes or integration code, so missed mocks
 * must fail before a provider request leaves the process and spends credits.
 * The Gateway SDK retries unknown fetch failures as 500s, so this uses a
 * non-retryable Gateway error to make the test kill switch fail immediately.
 */
const blockTestGatewayFetch: NonNullable<GatewayProviderSettings["fetch"]> = async () => {
  throw new GatewayInvalidRequestError({ message: "AI Gateway calls are disabled during tests." });
};

export const zoonkGateway = createGateway({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestGatewayFetch : undefined,
  headers: { "http-referer": "https://www.zoonk.com", "x-title": "Zoonk" },
});

/**
 * The provider apps register as the AI SDK's default (`AI_SDK_DEFAULT_PROVIDER`), which resolves
 * every task's model id: the gateway, with each call's system prompt marked for Anthropic's prompt
 * cache (`promptCacheMiddleware`), and every text and image call kept away from providers that
 * train on prompts (`noPromptTrainingMiddleware`).
 */
export const zoonkDefaultProvider = wrapProvider({
  imageModelMiddleware: noPromptTrainingImageMiddleware,
  languageModelMiddleware: [noPromptTrainingMiddleware, promptCacheMiddleware],
  provider: zoonkGateway,
});
