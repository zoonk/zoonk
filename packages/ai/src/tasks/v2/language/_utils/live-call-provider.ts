import { createOpenAI } from "@ai-sdk/openai";
import { blockTestProviderFetch } from "../../../../_utils/block-test-provider-fetch";
import { isTestEnvironment } from "../../../../_utils/is-test-environment";

/** Admission can safely pause before reserving money when the dedicated key is absent. */
export function isLiveCallAvailable(): boolean {
  return Boolean(process.env.OPENAI_LIVE_API_KEY?.trim());
}

export function getLiveCallModel() {
  const isTest = isTestEnvironment();
  const apiKey = isTest ? "test-disabled" : process.env.OPENAI_LIVE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Live calls need OPENAI_LIVE_API_KEY.");
  }

  return createOpenAI({
    apiKey,
    baseURL: "https://api.openai.com/v1",
    fetch: isTest ? blockTestProviderFetch : undefined,
  }).experimental_realtime("gpt-live-1");
}
