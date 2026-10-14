import { createOpenAI } from "@ai-sdk/openai";
import { blockTestProviderFetch } from "./_utils/block-test-provider-fetch";
import { isTestEnvironment } from "./_utils/is-test-environment";

const isTest = isTestEnvironment();

/**
 * Models AI Gateway doesn't list (gpt-transcribe, gpt-realtime-2.1-mini) are called on OpenAI
 * directly. Like the gateway, these calls fail before a request leaves the process during tests
 * (a realtime session starts with a fetch for its client secret), so a missed mock never spends
 * credits.
 */
export const directOpenAI = createOpenAI({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestProviderFetch : undefined,
});
