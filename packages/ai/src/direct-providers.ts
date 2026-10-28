import { createOpenAI } from "@ai-sdk/openai";
import { blockTestProviderFetch } from "./_utils/block-test-provider-fetch";
import { isTestEnvironment } from "./_utils/is-test-environment";

const isTest = isTestEnvironment();

/** For models AI Gateway doesn't list, such as gpt-transcribe. */
export const directOpenAI = createOpenAI({
  apiKey: isTest ? "test-disabled" : undefined,
  fetch: isTest ? blockTestProviderFetch : undefined,
});
