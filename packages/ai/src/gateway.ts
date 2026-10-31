import { createGateway } from "@ai-sdk/gateway";
// By package name, not path, so the API's E2E build can swap the kill switch (its next.config.ts).
import { blockTestGatewayFetch } from "@zoonk/ai/block-test-gateway-fetch";
import { wrapProvider } from "ai";
import { isTestEnvironment } from "./_utils/is-test-environment";
import { noPromptTrainingImageMiddleware, noPromptTrainingMiddleware } from "./data-protection";
import { promptCacheMiddleware } from "./prompt-cache";

const isTest = isTestEnvironment();

export const zoonkGateway = createGateway({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestGatewayFetch : undefined,
  headers: { "http-referer": "https://www.zoonk.com", "x-title": "Zoonk" },
});

export const zoonkDefaultProvider = wrapProvider({
  imageModelMiddleware: noPromptTrainingImageMiddleware,
  languageModelMiddleware: [noPromptTrainingMiddleware, promptCacheMiddleware],
  provider: zoonkGateway,
});
